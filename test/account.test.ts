import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { run } from "../src/db";

import { BetaGuardError } from "../src/jellyfin";
let deleted: string[] = [], guardDelete = false;
let pw: Record<string, string>, pwSet: Array<[string, string]>, devices: string[], sent: string[];
const users: Record<string, any> = { u1: { id: "u1", name: "maya", isAdmin: false, isDisabled: false } };
const app = createApp({
  jellyfin: (() => ({
    authenticate: async (n: string, p: string) => (n === "maya" && p === pw.u1 ? { id: "u1", name: "maya", isAdmin: users.u1.isAdmin } : null),
    getUser: async (id: string) => users[id] ?? null,
    setPassword: async (id: string, p: string) => { pw[id] = p; pwSet.push([id, p]); },
    deleteDevices: async (id: string) => void devices.push(id),
    activity: async () => [],
    userItems: async () => [{ Id: "a".repeat(32), Name: "Heat", Type: "Movie", ProductionYear: 1995, UserData: { PlayCount: 2, LastPlayedDate: "2026-11-01T00:00:00Z" } }],
    resume: async () => [],
    deleteUser: async (id: string) => { if (guardDelete) throw new BetaGuardError("x"); deleted.push(id); },
  })) as never,
  mailer: (() => ({ send: async (to: string, s: string) => void sent.push(`${to}|${s}`) })) as never,
});
const post = (path: string, body: unknown, h: Record<string, string> = {}) => app.request(path, { method: "POST", headers: { "content-type": "application/json", ...h }, body: JSON.stringify(body) }, env);
async function login(password = pw.u1) {
  const r = await post("/api/signin", { username: "maya", password });
  return { cookie: r.headers.get("set-cookie")!.split(";")[0], "x-csrf-token": ((await r.json()) as any).csrf as string };
}
beforeEach(async () => {
  deleted = []; pw = { u1: "old-password" }; pwSet = []; devices = []; sent = [];
  for (const t of ["members", "sessions", "rate_limits", "audit", "signins", "ratings", "push_subscriptions"]) await run(env.DB, `DELETE FROM ${t}`);
});

describe("changing the password", () => {
  test("needs the current password, enforces a minimum length, and is rate limited", async () => {
    const a = await login();
    expect((await post("/api/account/password", { current: "nope", next: "a-brand-new-one" }, a)).status).toBe(403);
    expect((await post("/api/account/password", { current: pw.u1, next: "short" }, a)).status).toBe(400);
    expect(pwSet).toHaveLength(0);
    for (let i = 0; i < 6; i++) await post("/api/account/password", { current: "nope", next: "a-brand-new-one" }, a);
    expect((await post("/api/account/password", { current: pw.u1, next: "a-brand-new-one" }, a)).status).toBe(429);
  });
  test("a good change signs out other devices and sessions but keeps this one, and emails a notice", async () => {
    await run(env.DB, "UPDATE members SET contact_email = 'm@example.com', email_verified = 1 WHERE jellyfin_id = 'u1'").catch(() => {});
    const a = await login();
    await run(env.DB, "UPDATE members SET contact_email = 'm@example.com', email_verified = 1 WHERE jellyfin_id = 'u1'");
    const other = await login();
    expect((await post("/api/account/password", { current: "old-password", next: "a-brand-new-one" }, a)).status).toBe(200);
    expect(pwSet).toEqual([["u1", "a-brand-new-one"]]);
    expect(devices).toEqual(["u1"]);
    expect((await app.request("/api/me", { headers: { cookie: a.cookie } }, env)).status).toBe(200);
    expect((await app.request("/api/me", { headers: { cookie: other.cookie } }, env)).status).toBe(401);
    expect(sent).toEqual(["m@example.com|Your Jellypass password was changed"]);
  });
});

describe("account overview and sign-out controls", () => {
  const get = (a: any, path: string) => app.request(path, { headers: { cookie: a.cookie } }, env);
  test("overview shows access level, end date, email state, other browsers and the last sign-in; needs a session", async () => {
    expect((await app.request("/api/account", {}, env)).status).toBe(401);
    const a = await login();
    await login(); // a second browser
    await run(env.DB, "UPDATE members SET contact_email = 'm@example.com', email_verified = 1, expires_at = '2027-01-01T00:00:00.000Z', preset_id = 'preset-standard' WHERE jellyfin_id = 'u1'");
    await run(env.DB, "INSERT INTO signins (source, jellyfin_id, device, ip, city, lat, lng, seen_at) VALUES ('portal','u1','Safari','1.2.3.4','London',51.5,-0.1,?)", new Date().toISOString());
    const j: any = await (await get(a, "/api/account")).json();
    expect(j).toMatchObject({ username: "maya", accessLevel: expect.any(String), expiresAt: "2027-01-01T00:00:00.000Z", emailVerified: true, otherSessions: 1, lastSignin: { device: "Safari", city: "London" } });
    expect(JSON.stringify(j)).not.toContain("1.2.3.4"); // overview carries no IP
  });
  test("sign out other browsers ends only the other portal sessions", async () => {
    const a = await login(); await login();
    expect((await post("/api/account/sign-out-others", {})).status).toBe(401);
    expect((await post("/api/account/sign-out-others", {}, a)).status).toBe(200);
    const left = await env.DB.prepare("SELECT COUNT(*) n FROM sessions WHERE jellyfin_id = 'u1'").first<{ n: number }>();
    expect(left!.n).toBe(1);
    expect((await get(a, "/api/account")).status).toBe(200);
    expect(devices).toHaveLength(0); // Jellyfin devices untouched
  });
  test("sign out all Jellyfin devices removes them and other portal sessions, keeps this browser, and is audited", async () => {
    const a = await login(); await login();
    expect((await post("/api/account/sign-out-devices", {}, a)).status).toBe(200);
    expect(devices).toEqual(["u1"]);
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM sessions WHERE jellyfin_id = 'u1'").first<{ n: number }>())!.n).toBe(1);
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM audit WHERE action = 'account.sign_out_devices'").first<{ n: number }>())!.n).toBe(1);
  });
});

describe("sessions list, alerts setting, password date", () => {
  const get = (a: any, path: string) => app.request(path, { headers: { cookie: a.cookie } }, env);
  const del = (a: any, path: string) => app.request(path, { method: "DELETE", headers: { ...a } }, env);
  const put = (a: any, path: string, body: unknown) => app.request(path, { method: "PUT", headers: { "content-type": "application/json", ...a }, body: JSON.stringify(body) }, env);
  const signinUa = async (ua: string) => {
    const r = await app.request("/api/signin", { method: "POST", headers: { "content-type": "application/json", "user-agent": ua }, body: JSON.stringify({ username: "maya", password: pw.u1 }) }, env);
    return { cookie: r.headers.get("set-cookie")!.split(";")[0], "x-csrf-token": ((await r.json()) as any).csrf as string };
  };
  test("lists my browsers with a label, marks this one, and lets me end another one (not someone else's)", async () => {
    const other = await signinUa("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1");
    const a = await signinUa("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15");
    const j: any = await (await get(a, "/api/account")).json();
    expect(j.sessions).toHaveLength(2);
    expect(j.sessions.filter((s: any) => s.current)).toHaveLength(1);
    expect(j.sessions.every((s: any) => typeof s.label === "string" && s.label.length > 0 && s.createdAt)).toBe(true);
    const target = j.sessions.find((s: any) => !s.current);
    expect((await del(a, "/api/account/sessions/" + target.id)).status).toBe(200);
    expect((await get(other, "/api/account")).status).toBe(401); // that browser is signed out
    expect((await del(a, "/api/account/sessions/not-mine")).status).toBe(404);
    await run(env.DB, "INSERT INTO sessions (id, jellyfin_id, username, is_admin, expires_at, checked_at, csrf) VALUES ('theirs','u9','zed',0,?, ?, 'c')", new Date(Date.now() + 3600_000).toISOString(), new Date().toISOString());
    expect((await del(a, "/api/account/sessions/theirs")).status).toBe(404);
  });
  test("alerts can be turned on freely, but turning them off needs the current password", async () => {
    const a = await login();
    expect(((await (await get(a, "/api/account")).json()) as any).alertsOn).toBe(false); // opt-in: starts off
    await run(env.DB, "UPDATE members SET contact_email = 'm@example.com', email_verified = 0 WHERE jellyfin_id = 'u1'");
    expect((await put(a, "/api/account/alerts", { on: true })).status).toBe(409); // needs a verified email
    await run(env.DB, "UPDATE members SET email_verified = 1 WHERE jellyfin_id = 'u1'");
    expect((await put(a, "/api/account/alerts", { on: true })).status).toBe(200);
    expect((await put(a, "/api/account/alerts", { on: false })).status).toBe(403);
    expect((await put(a, "/api/account/alerts", { on: false, password: "wrong" })).status).toBe(403);
    expect((await put(a, "/api/account/alerts", { on: false, password: pw.u1 })).status).toBe(200);
    expect(((await (await get(a, "/api/account")).json()) as any).alertsOn).toBe(false);
    expect((await put(a, "/api/account/alerts", { on: true })).status).toBe(200);
    expect(((await (await get(a, "/api/account")).json()) as any).alertsOn).toBe(true);
  });
  test("a password change stamps the date shown on the overview", async () => {
    const a = await login();
    expect(((await (await get(a, "/api/account")).json()) as any).passwordChangedAt).toBeNull();
    expect((await post("/api/account/password", { current: pw.u1, next: "a-brand-new-one" }, a)).status).toBe(200);
    expect(((await (await get(a, "/api/account")).json()) as any).passwordChangedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("your data: download and delete", () => {
  test("the download holds the member's own rows (history, ratings, sign-ins) and nobody else's", async () => {
    const a = await login();
    await run(env.DB, "INSERT INTO ratings (jellyfin_id, item_id, stars, at) VALUES ('u1', ?, 5, 'now'), ('u2', ?, 1, 'now')", "a".repeat(32), "b".repeat(32));
    const res = await app.request("/api/account/export", { headers: { cookie: a.cookie } }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("jellypass-maya-data.json");
    const j = (await res.json()) as any;
    expect(j.profile.username).toBe("maya");
    expect(j.ratings).toEqual([{ itemId: "a".repeat(32), stars: 5, at: "now" }]);
    expect(j.watchHistory[0].title).toBe("Heat");
    expect(JSON.stringify(j)).not.toMatch(/csrf|token|secret|password"/i);
    expect((await app.request("/api/account/export", {}, env)).status).toBe(401);
  });
  test("deleting needs the typed username and the password, then removes the user and their rows", async () => {
    const a = await login();
    await run(env.DB, "INSERT INTO ratings (jellyfin_id, item_id, stars, at) VALUES ('u1', ?, 5, 'now')", "a".repeat(32));
    expect((await post("/api/account/delete", { confirm: "someone", password: pw.u1 }, a)).status).toBe(400);
    expect((await post("/api/account/delete", { confirm: "maya", password: "wrong" }, a)).status).toBe(403);
    expect(deleted).toEqual([]);
    expect((await post("/api/account/delete", { confirm: "maya", password: pw.u1 }, a)).status).toBe(200);
    expect(deleted).toEqual(["u1"]);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM ratings WHERE jellyfin_id = 'u1'").first<{ n: number }>()).toEqual({ n: 0 });
    expect((await app.request("/api/me", { headers: { cookie: a.cookie } }, env)).status).toBe(401);
    expect((await env.DB.prepare("SELECT action FROM audit WHERE action = 'account.self_delete'").first())).not.toBeNull();
  });
  test("the beta guard's refusal is explained, not shown as a failure", async () => {
    guardDelete = true;
    try {
      const r = await post("/api/account/delete", { confirm: "maya", password: pw.u1 }, await login());
      expect(r.status).toBe(403);
      expect(((await r.json()) as any).error).toContain("beta-");
    } finally { guardDelete = false; }
  });
  test("admins cannot delete themselves here", async () => {
    users.u1.isAdmin = true;
    try {
      const r = await post("/api/signin", { username: "maya", password: pw.u1 });
      const a = { cookie: r.headers.get("set-cookie")!.split(";")[0], "x-csrf-token": ((await r.json()) as any).csrf as string };
      expect((await post("/api/account/delete", { confirm: "maya", password: pw.u1 }, a)).status).toBe(400);
    } finally { users.u1.isAdmin = false; }
  });
});

describe("libraries on the account summary", () => {
  const libApp = (fn: () => Promise<string[]>) => createApp({ jellyfin: (() => ({ authenticate: async () => ({ id: "u1", name: "maya", isAdmin: false }), getUser: async () => users.u1, userLibraries: fn })) as never, mailer: (() => ({ send: async () => {} })) as never });
  const summary = async (a: ReturnType<typeof libApp>) => {
    const r = await a.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "maya", password: "x" }) }, env);
    return (await (await a.request("/api/account", { headers: { cookie: r.headers.get("set-cookie")!.split(";")[0] } }, env)).json()) as any;
  };
  test("lists the library names, or null when Jellyfin does not answer", async () => {
    expect((await summary(libApp(async () => ["Films", "TV"]))).libraries).toEqual(["Films", "TV"]);
    expect((await summary(libApp(async () => { throw new Error("down"); }))).libraries).toBeNull();
  });
});
