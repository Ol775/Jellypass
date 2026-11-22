import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { run, all } from "../src/db";

const vapid = async () => { const { privateKey } = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"])) as CryptoKeyPair; const { kty, crv, x, y, d } = await crypto.subtle.exportKey("jwk", privateKey); return JSON.stringify({ kty, crv, x, y, d }); };
const users: Record<string, any> = { olivia: { id: "a1", name: "olivia", isAdmin: true, isDisabled: false }, maya: { id: "u1", name: "maya", isAdmin: false, isDisabled: false } };
let pushed: string[];
const app = createApp({
  fetch: (async (url: string) => { pushed.push(url); return new Response(null, { status: 201 }); }) as never,
  jellyfin: (() => ({ authenticate: async (n: string) => (users[n] ? { id: users[n].id, name: n, isAdmin: users[n].isAdmin } : null), getUser: async (id: string) => Object.values(users).find((u) => u.id === id) ?? null, activity: async () => [], sessions: async () => [] })) as never,
});
let penv: any;
const call = (method: string, path: string, body?: unknown, h: any = {}) => app.request(path, { method, headers: { "content-type": "application/json", ...h }, body: body === undefined ? undefined : JSON.stringify(body) }, penv);
const login = async (n: string) => { const r = await call("POST", "/api/signin", { username: n, password: "x" }); return { cookie: r.headers.get("set-cookie")!.split(";")[0], "x-csrf-token": ((await r.json()) as any).csrf as string }; };

beforeEach(async () => {
  pushed = []; penv = { ...env, VAPID_KEYS: await vapid() };
  for (const t of ["members", "sessions", "rate_limits", "notices", "push_subscriptions", "audit"]) await run(env.DB, `DELETE FROM ${t}`);
});

describe("admin notices", () => {
  test("members cannot send; an admin's notice shows in every member's bell and can be removed", async () => {
    const maya = await login("maya"), olivia = await login("olivia");
    expect((await call("POST", "/api/admin/notices", { title: "t", body: "b" }, maya)).status).toBe(403);
    expect((await call("POST", "/api/admin/notices", { title: "Server move", body: "Short break tonight.", link: "/status" }, olivia)).status).toBe(201);
    const seen = (await (await call("GET", "/api/notices", undefined, maya)).json()) as any[];
    expect(seen).toMatchObject([{ title: "Server move", body: "Short break tonight.", link: "/status" }]);
    expect(pushed).toEqual([]); // push was not ticked
    const id = seen[0].id;
    expect((await call("DELETE", `/api/admin/notices/${id}`, {}, olivia)).status).toBe(200);
    expect(await (await call("GET", "/api/notices", undefined, maya)).json()).toEqual([]);
    expect(await all(env.DB, "SELECT 1 FROM audit WHERE action = 'notice.send'")).toHaveLength(1);
  });
  test("with push ticked it goes to every member with a device, once per device", async () => {
    const olivia = await login("olivia");
    for (const [m, ep] of [["u1", "https://fcm.googleapis.com/a"], ["u1", "https://fcm.googleapis.com/b"], ["u2", "https://fcm.googleapis.com/c"]]) {
      const k = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
      const raw = new Uint8Array(await crypto.subtle.exportKey("raw", k.publicKey));
      await run(env.DB, "INSERT INTO push_subscriptions (endpoint, jellyfin_id, p256dh, auth, created_at) VALUES (?,?,?,?,?)", ep, m, btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), "AAAAAAAAAAAAAAAAAAAAAA", "now");
    }
    const r = (await (await call("POST", "/api/admin/notices", { title: "Hello", body: "Hi all", push: true }, olivia)).json()) as any;
    expect(r).toMatchObject({ members: 2, devices: 3 });
    expect(pushed.sort()).toEqual(["https://fcm.googleapis.com/a", "https://fcm.googleapis.com/b", "https://fcm.googleapis.com/c"]);
  });
  test("bad titles, long messages and unsafe links are refused", async () => {
    const olivia = await login("olivia");
    const send = (b: any) => call("POST", "/api/admin/notices", { title: "t", body: "b", ...b }, olivia);
    expect((await send({ title: "" })).status).toBe(400);
    expect((await send({ body: "x".repeat(301) })).status).toBe(400);
    for (const link of ["javascript:alert(1)", "//evil.test", "http://evil.test", "data:text/html,x"]) expect((await send({ link })).status).toBe(400);
    expect((await send({ link: "https://example.com/x" })).status).toBe(201);
  });
});
