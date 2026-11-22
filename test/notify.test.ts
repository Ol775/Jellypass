import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { all, first, run } from "../src/db";
import { adminDigest, readyRequests, streamWarnings, weeklySummaries } from "../src/cron/notify";
import { secureToken } from "../src/signins";

let passwords: Array<[string, string]> = [], sent: Array<{ to: string; subject: string }>, devices: string[], sessions: any[], requests: any[];
const jf = {
  deleteDevices: async (id: string) => void devices.push(id),
  setPassword: async (id: string, p: string) => void passwords.push([id, p]),
  sessions: async () => sessions,
  userItems: async () => [{ Name: "Slow Horses", DateCreated: new Date().toISOString() }],
  resume: async () => [],
  libraryItem: async () => ({ id: "a1b2c3d4e5f60718293a4b5c6d7e8f90", quality: "1080p" }),
  authenticate: async (n: string, p: string) => (n === "maya" && p === "pw" ? { id: "u1", name: "maya", isAdmin: false } : null),
  getUser: async () => ({ id: "u1", name: "maya", isAdmin: false, isDisabled: false }),
};
const seerr = { userRequests: async () => requests, summary: async () => ({ title: "Heat", posterPath: null, year: "1995", rating: "" }) };
const mailer = { send: async (to: string, subject: string) => void sent.push({ to, subject }) };
const d = () => ({ env, db: env.DB, jf: jf as never, seerr: seerr as never, mailer, baseUrl: "https://jp.test" });
const app = createApp({ jellyfin: (() => jf) as never, seerr: (() => seerr) as never, mailer: (() => mailer) as never });
const call = (method: string, path: string, body?: unknown, h: Record<string, string> = {}) => app.request(path, { method, headers: { "content-type": "application/json", ...h }, body: body === undefined ? undefined : JSON.stringify(body) }, env);

beforeEach(async () => {
  sent = []; devices = []; passwords = []; requests = []; sessions = [];
  for (const t of ["members", "sessions", "notice_log", "signin_failures", "signins", "settings", "rate_limits", "audit"]) await run(env.DB, `DELETE FROM ${t}`);
  await run(env.DB, "INSERT INTO members (jellyfin_id, username, contact_email, email_verified, alerts_email, weekly_on, ready_on, seerr_user_id) VALUES ('u1','maya','maya@example.com',1,1,1,1,7)");
});
const playing = (ip: string) => ({ id: ip, userName: "maya", deviceName: "TV", remoteIp: ip, itemId: "i1" });

describe("This wasn't me", () => {
  test("the page only asks; pressing the button signs out everywhere, stamps the member and audits", async () => {
    const t = await secureToken(env.SESSION_SECRET, "u1");
    await run(env.DB, "INSERT INTO sessions (id, jellyfin_id, username, is_admin, expires_at, checked_at, csrf) VALUES ('s','u1','maya',0,'2999-01-01','2999-01-01','c')");
    const page = await call("GET", `/secure/${t}`);
    expect(page.status).toBe(200); expect(await page.text()).toContain("secure my account");
    expect(devices).toEqual([]); expect(await first(env.DB, "SELECT 1 AS x FROM sessions")).not.toBeNull(); // a mail scanner opening the link changes nothing
    expect((await call("POST", `/secure/${t}`)).status).toBe(200);
    expect(devices).toEqual(["u1"]); expect(passwords).toHaveLength(1); expect(passwords[0][1]).toHaveLength(48); expect(await all(env.DB, "SELECT 1 FROM sessions")).toHaveLength(0);
    expect((await first<any>(env.DB, "SELECT secured_at FROM members"))!.secured_at).toBeTruthy();
    expect(await all(env.DB, "SELECT 1 FROM audit WHERE action = 'account.secured_not_me'")).toHaveLength(1);
  });
  test("a forged, tampered or expired token does nothing", async () => {
    const t = await secureToken(env.SESSION_SECRET, "u1");
    expect((await call("POST", `/secure/${t.slice(0, -2)}aa`)).status).toBe(400);
    expect((await call("POST", "/secure/u1.9999999999999.deadbeef")).status).toBe(400);
    expect((await call("POST", "/secure/u1.1.abc")).status).toBe(400);
    expect(devices).toEqual([]);
  });
});

describe("notification switches", () => {
  const login = async () => { const r = await call("POST", "/api/signin", { username: "maya", password: "pw" }); return { cookie: r.headers.get("set-cookie")!.split(";")[0], "x-csrf-token": ((await r.json()) as any).csrf as string }; };
  test("banner is free, email-based ones need a verified email, junk is refused", async () => {
    const a = await login();
    expect((await call("PUT", "/api/account/notify", { key: "banner", on: true }, a)).status).toBe(200);
    expect((await call("PUT", "/api/account/notify", { key: "weekly", on: false }, a)).status).toBe(200);
    expect((await call("PUT", "/api/account/notify", { key: "weekly", on: true }, a)).status).toBe(200);
    await run(env.DB, "UPDATE members SET email_verified = 0");
    expect((await call("PUT", "/api/account/notify", { key: "ready", on: true }, a)).status).toBe(409);
    expect((await call("PUT", "/api/account/notify", { key: "nope", on: true }, a)).status).toBe(400);
    const acc: any = await (await app.request("/api/account", { headers: a }, env)).json();
    expect(acc).toMatchObject({ alertsBanner: true, weeklyOn: true });
  });
  test("failed sign-ins are recorded for the digest", async () => {
    await call("POST", "/api/signin", { username: "maya", password: "wrong" });
    expect(await all(env.DB, "SELECT username FROM signin_failures")).toEqual([{ username: "maya" }]);
  });
});

describe("stream sharing warning", () => {
  test("two places at once warns an opted-in member once a day and flags it for the digest", async () => {
    sessions = [playing("1.1.1.1"), playing("2.2.2.2")];
    expect(await streamWarnings(d())).toEqual({ warned: 1 });
    expect(await streamWarnings(d())).toEqual({ warned: 0 });
    expect(sent).toHaveLength(1);
    expect(await all(env.DB, "SELECT 1 FROM notice_log WHERE key LIKE 'streamflag:u1:%'")).toHaveLength(1);
  });
  test("one place, or a member who has not opted in, sends nothing (but a non-opted-in one is still flagged)", async () => {
    sessions = [playing("1.1.1.1"), playing("1.1.1.1")];
    await streamWarnings(d()); expect(sent).toHaveLength(0);
    await run(env.DB, "UPDATE members SET alerts_email = 0");
    sessions = [playing("1.1.1.1"), playing("2.2.2.2")];
    await streamWarnings(d()); expect(sent).toHaveLength(0);
    expect(await all(env.DB, "SELECT 1 FROM notice_log WHERE key LIKE 'streamflag:%'")).toHaveLength(1);
  });
});

describe("weekly summary and ready requests", () => {
  test("weekly goes to opted-in members once", async () => {
    expect(await weeklySummaries(d())).toEqual({ sent: 1 });
    expect(await weeklySummaries(d())).toEqual({ sent: 0 });
    expect(sent[0]).toMatchObject({ to: "maya@example.com", subject: "Your week on Jellyfin" });
    await run(env.DB, "DELETE FROM notice_log"); await run(env.DB, "UPDATE members SET weekly_on = 0");
    expect(await weeklySummaries(d())).toEqual({ sent: 0 });
  });
  test("a request that became available in the last day is emailed once; an old one is not", async () => {
    requests = [{ id: 1, media: { status: 5, mediaType: "movie", tmdbId: 1, updatedAt: new Date().toISOString() } }, { id: 2, media: { status: 5, mediaType: "movie", tmdbId: 2, updatedAt: "2026-01-01T00:00:00Z" } }, { id: 3, media: { status: 3, mediaType: "movie", tmdbId: 3, updatedAt: new Date().toISOString() } }];
    expect(await readyRequests(d())).toEqual({ sent: 1 });
    expect(await readyRequests(d())).toEqual({ sent: 0 });
    expect(sent[0].subject).toBe("Heat is ready to watch");
  });
});

describe("admin digest", () => {
  test("nothing without an address, nothing on a quiet day, one email on an odd day and not again the same day", async () => {
    for (let i = 0; i < 6; i++) await run(env.DB, "INSERT INTO signin_failures (username, ip, at) VALUES ('maya','9.9.9.9',?)", new Date().toISOString());
    expect(await adminDigest(d())).toEqual({ sent: false });
    await run(env.DB, "INSERT INTO settings (key, value) VALUES ('digest_email','me@example.com')");
    await run(env.DB, "DELETE FROM signin_failures");
    expect(await adminDigest(d())).toEqual({ sent: false }); await run(env.DB, "DELETE FROM notice_log");
    for (let i = 0; i < 6; i++) await run(env.DB, "INSERT INTO signin_failures (username, ip, at) VALUES ('maya','9.9.9.9',?)", new Date().toISOString());
    expect(await adminDigest(d())).toEqual({ sent: true });
    expect(await adminDigest(d())).toEqual({ sent: false });
    expect(sent).toEqual([{ to: "me@example.com", subject: "Jellypass daily security digest" }]);
  });
});
