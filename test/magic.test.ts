import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { all, first, run } from "../src/db";

const users: Record<string, any> = { maya: { id: "u1", name: "maya", isAdmin: false, isDisabled: false }, olivia: { id: "a1", name: "olivia", isAdmin: true, isDisabled: false } };
let sent: Array<{ to: string; text: string }>;
const app = createApp({
  jellyfin: (() => ({
    authenticate: async (n: string, p: string) => (users[n] && p === "pw" ? { id: users[n].id, name: n, isAdmin: users[n].isAdmin } : null),
    getUser: async (id: string) => Object.values(users).find((u: any) => u.id === id) ?? null,
    activity: async () => [], setPassword: async () => {}, deleteDevices: async () => {},
  })) as never,
  mailer: (() => ({ send: async (to: string, _s: string, _h: string, text: string) => void sent.push({ to, text }) })) as never,
});
const call = (method: string, path: string, body?: unknown, h: any = {}) => app.request(path, { method, headers: { "content-type": "application/json", ...h }, body: body === undefined ? undefined : JSON.stringify(body) }, env);
const login = async (n: string) => { const r = await call("POST", "/api/signin", { username: n, password: "pw" }); return { cookie: r.headers.get("set-cookie")!.split(";")[0], "x-csrf-token": ((await r.json()) as any).csrf as string }; };
const ask = (identifier = "maya") => call("POST", "/api/magic/request", { identifier });
const tokenOf = () => sent.at(-1)!.text.match(/\/magic\/([0-9a-f]{64})/)![1];
const verified = () => run(env.DB, "UPDATE members SET contact_email = 'maya@example.com', email_verified = 1 WHERE jellyfin_id = 'u1'");

beforeEach(async () => {
  sent = [];
  for (const t of ["members", "sessions", "rate_limits", "magic_links", "own_auths", "signins", "audit"]) await run(env.DB, `DELETE FROM ${t}`);
});

describe("turning it on", () => {
  test("needs a verified email and the current password, and is refused for admins; off is free", async () => {
    const a = await login("maya");
    expect((await call("PUT", "/api/account/magic", { on: true, password: "pw" }, a)).status).toBe(409); // no verified email yet
    await verified();
    expect((await call("PUT", "/api/account/magic", { on: true, password: "wrong" }, a)).status).toBe(403);
    expect((await call("PUT", "/api/account/magic", { on: true }, a)).status).toBe(403);
    expect((await call("PUT", "/api/account/magic", { on: true, password: "pw" }, a)).status).toBe(200);
    expect(((await (await call("GET", "/api/account", undefined, a)).json()) as any).magicOn).toBe(true);
    expect((await call("PUT", "/api/account/magic", { on: false }, a)).status).toBe(200);
    const o = await login("olivia");
    expect((await call("PUT", "/api/account/magic", { on: true, password: "pw" }, o)).status).toBe(400);
  });
});

describe("asking for and using a link", () => {
  const enable = async () => { const a = await login("maya"); await verified(); await call("PUT", "/api/account/magic", { on: true, password: "pw" }, a); return a; };
  test("a member who turned it on gets one email; everyone else gets the same answer and no email", async () => {
    const r0 = await ask(); expect(sent).toHaveLength(0); // not turned on
    await enable();
    await run(env.DB, "DELETE FROM rate_limits");
    const r1 = await ask(); expect(sent).toHaveLength(1); expect(sent[0].to).toBe("maya@example.com");
    expect(await r1.json()).toEqual(await r0.json());
    expect((await ask("nobody@example.com")).status).toBe(200); expect(sent).toHaveLength(1);
    expect((await ask()).status).toBe(429); // 30 second cool-down
  });
  test("never for an account that has not signed in with its password yet", async () => {
    await enable(); await run(env.DB, "DELETE FROM rate_limits"); await run(env.DB, "DELETE FROM own_auths");
    await ask(); expect(sent).toHaveLength(0);
  });
  test("opening the link only shows a button; pressing it signs in once and a second try fails", async () => {
    await enable(); await run(env.DB, "DELETE FROM rate_limits"); await ask();
    const t = tokenOf();
    const page = await app.request(`/magic/${t}`, {}, env);
    expect(page.status).toBe(200); expect(await page.text()).toContain("Signing in as");
    expect(await first(env.DB, "SELECT 1 AS x FROM magic_links")).not.toBeNull(); // a mail scanner did not use it up
    await run(env.DB, "DELETE FROM sessions");
    const go = await app.request(`/magic/${t}`, { method: "POST" }, env);
    expect(go.status).toBe(303); expect(go.headers.get("location")).toBe("/");
    const cookie = go.headers.get("set-cookie")!.split(";")[0];
    expect((await app.request("/api/me", { headers: { cookie } }, env)).status).toBe(200);
    expect((await app.request(`/magic/${t}`, { method: "POST" }, env)).status).toBe(400);
    expect((await app.request(`/magic/${t}`, {}, env)).status).toBe(400);
  });
  test("an expired or made-up link, turning it off, or a password change kills outstanding links", async () => {
    const a = await enable(); await run(env.DB, "DELETE FROM rate_limits"); await ask();
    const t = tokenOf();
    expect((await app.request(`/magic/${"0".repeat(64)}`, { method: "POST" }, env)).status).toBe(400);
    await run(env.DB, "UPDATE magic_links SET expires_at = '2000-01-01T00:00:00Z'");
    expect((await app.request(`/magic/${t}`, { method: "POST" }, env)).status).toBe(400);
    await run(env.DB, "UPDATE magic_links SET expires_at = '2999-01-01T00:00:00Z'");
    await call("POST", "/api/account/password", { current: "pw", next: "a-brand-new-one" }, a);
    expect(await all(env.DB, "SELECT 1 FROM magic_links")).toHaveLength(0);
  });
  test("turning it off blocks a link already sent", async () => {
    const a = await enable(); await run(env.DB, "DELETE FROM rate_limits"); await ask();
    const t = tokenOf();
    await call("PUT", "/api/account/magic", { on: false }, a);
    expect((await app.request(`/magic/${t}`, { method: "POST" }, env)).status).toBe(400);
  });
});
