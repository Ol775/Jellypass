import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { run, first } from "../src/db";
import type { Env } from "../src/env";

type U = { id: string; name: string; isAdmin: boolean; isDisabled: boolean; pw: string };
let users: Record<string, U>;
let authCalls = 0;
const jf = () => ({
  authenticate: async (n: string, p: string) => {
    authCalls++;
    const u = Object.values(users).find((x) => x.name === n && x.pw === p);
    return u ? { id: u.id, name: u.name, isAdmin: u.isAdmin } : null;
  },
  getUser: async (id: string) => (users[id] ? { id, name: users[id].name, isAdmin: users[id].isAdmin, isDisabled: users[id].isDisabled } : null),
});
const app = createApp({ jellyfin: jf as never });

beforeEach(async () => {
  authCalls = 0;
  users = {
    u1: { id: "u1", name: "maya", isAdmin: false, isDisabled: false, pw: "pw" },
    u2: { id: "u2", name: "olivia", isAdmin: true, isDisabled: false, pw: "pw" },
  };
  for (const t of ["sessions", "rate_limits"]) await run(env.DB, `DELETE FROM ${t}`);
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }, env);
const signin = (name: string, pw: string, ip = "9.9.9.9") => post("/api/signin", { username: name, password: pw }, { "cf-connecting-ip": ip });
const cookieOf = (res: Response) => res.headers.get("set-cookie")!.split(";")[0];
const me = (cookie: string) => app.request("/api/me", { headers: { cookie } }, env);

describe("sign-in", () => {
  test("valid credentials set a session cookie", async () => {
    const res = await signin("maya", "pw");
    expect(res.status).toBe(200);
    expect((await res.json() as any).user).toMatchObject({ name: "maya", isAdmin: false });
    expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(res.headers.get("set-cookie")).toMatch(/SameSite=Lax/i);
  });
  test("wrong password is 401", async () => {
    expect((await signin("maya", "nope")).status).toBe(401);
  });
  test("6th failure for one user is 429 even from different IPs", async () => {
    for (let i = 0; i < 5; i++) expect((await signin("maya", "x", `1.1.1.${i}`)).status).toBe(401);
    expect((await signin("maya", "x", "1.1.1.99")).status).toBe(429);
    expect((await signin("maya", "pw", "1.1.1.98")).status).toBe(429);
  });
  test("6th failure from one IP is 429 across different usernames", async () => {
    for (let i = 0; i < 5; i++) expect((await signin(`nobody${i}`, "x", "2.2.2.2")).status).toBe(401);
    expect((await signin("another", "x", "2.2.2.2")).status).toBe(429);
  });
  test("parallel wrong guesses cannot exceed the attempt limit", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => signin("maya", "x", "3.3.3.3")));
    expect(results.filter((r) => r.status === 429).length).toBeGreaterThanOrEqual(7);
    expect(authCalls).toBeLessThanOrEqual(5);
  });
  test("a successful sign-in clears the user's counter", async () => {
    for (let i = 0; i < 3; i++) await signin("maya", "x", `4.4.4.${i}`);
    expect((await signin("maya", "pw", "4.4.4.9")).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await signin("maya", "x", `4.4.5.${i}`)).status).toBe(401);
  });
  test("production requires a Turnstile token", async () => {
    const res = await app.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "maya", password: "pw" }) }, { ...env, ENVIRONMENT: "prod" } as Env);
    expect(res.status).toBe(400);
  });
});

describe("session", () => {
  test("a good cookie identifies the member and exposes a csrf token", async () => {
    const c = cookieOf(await signin("maya", "pw"));
    const res = await me(c);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ user: { id: "u1", name: "maya" }, csrf: expect.any(String) });
  });
  test("no cookie is 401", async () => {
    expect((await me("")).status).toBe(401);
  });
  test("a tampered cookie is rejected", async () => {
    const c = cookieOf(await signin("maya", "pw"));
    expect((await me(c.slice(0, -2) + "xx")).status).toBe(401);
  });
  test("a session older than 12 hours is rejected", async () => {
    const c = cookieOf(await signin("maya", "pw"));
    await run(env.DB, "UPDATE sessions SET expires_at = '2020-01-01T00:00:00Z'");
    expect((await me(c)).status).toBe(401);
  });
  test("a user disabled in Jellyfin is rejected at the 5 minute re-check and the session is removed", async () => {
    const c = cookieOf(await signin("maya", "pw"));
    users.u1.isDisabled = true;
    await run(env.DB, "UPDATE sessions SET checked_at = '2020-01-01T00:00:00Z'");
    expect((await me(c)).status).toBe(401);
    expect(await first(env.DB, "SELECT id FROM sessions")).toBeNull();
  });
  test("a recent check does not call Jellyfin again", async () => {
    const c = cookieOf(await signin("maya", "pw"));
    users.u1.isDisabled = true;
    expect((await me(c)).status).toBe(200);
  });
});

describe("admin and csrf", () => {
  test("admin route allows a Jellyfin administrator", async () => {
    const c = cookieOf(await signin("olivia", "pw"));
    expect((await app.request("/api/admin/ping", { headers: { cookie: c } }, env)).status).toBe(200);
  });
  test("admin route denies a member even when the stored flag is forged", async () => {
    const c = cookieOf(await signin("maya", "pw"));
    await run(env.DB, "UPDATE sessions SET is_admin = 1");
    expect((await app.request("/api/admin/ping", { headers: { cookie: c } }, env)).status).toBe(403);
  });
  test("an admin demoted in Jellyfin loses admin access immediately", async () => {
    const c = cookieOf(await signin("olivia", "pw"));
    users.u2.isAdmin = false;
    expect((await app.request("/api/admin/ping", { headers: { cookie: c } }, env)).status).toBe(403);
  });
  test("a state-changing request without the csrf token is 403, and with it succeeds", async () => {
    const res = await signin("maya", "pw");
    const c = cookieOf(res);
    const csrf = ((await res.json()) as any).csrf as string;
    expect((await post("/api/signout", {}, { cookie: c })).status).toBe(403);
    expect((await post("/api/signout", {}, { cookie: c, "x-csrf-token": csrf })).status).toBe(200);
    expect((await me(c)).status).toBe(401);
  });
});
