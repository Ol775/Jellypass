import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { all, first, run } from "../src/db";
import { expireAccounts } from "../src/cron/expiry";
import { sendReminders } from "../src/cron/reminders";
import { runStatusChecks } from "../src/cron/status";
import { prune } from "../src/cron/prune";
import { runScheduled } from "../src/cron";
import { BetaGuardError } from "../src/jellyfin";

const iso = (days: number) => new Date(Date.now() + days * 86400_000).toISOString();
let jfUsers: Record<string, any>, policies: Array<[string, any]>, devices: string[], seerrPerms: Array<[number, string]>, sent: Array<{ to: string; subject: string }>;
let seerrFails = false, jfDown: boolean, jfOk: boolean, seerrOk: boolean, guardFor: string | null, polls: number;
const jf = {
  getUser: async (id: string) => { if (jfDown) throw new Error("down"); return jfUsers[id] ?? null; },
  setPolicy: async (id: string, p: any) => { if (id === guardFor) throw new BetaGuardError("no"); policies.push([id, p]); jfUsers[id].isDisabled = p.IsDisabled; },
  deleteDevices: async (id: string) => void devices.push(id),
  publicInfo: async () => ({ ok: jfOk, latencyMs: 12 }),
  activity: async () => { polls++; return []; },
};
const seerr = { setPermissions: async (id: number, r: string) => { if (seerrFails) throw new Error("seerr down"); seerrPerms.push([id, r]); }, status: async () => ({ ok: seerrOk, latencyMs: 20 }) };
const mailer = { send: async (to: string, subject: string) => void sent.push({ to, subject }) };
const deps = () => ({ env, db: env.DB, jf: jf as never, seerr: seerr as never, mailer, baseUrl: "https://jp.test" });

beforeEach(async () => {
  jfUsers = { u1: { id: "u1", name: "maya", isAdmin: false, isDisabled: false }, u2: { id: "u2", name: "ben", isAdmin: false, isDisabled: false }, u3: { id: "u3", name: "zed", isAdmin: false, isDisabled: true } };
  seerrFails = false; policies = []; devices = []; seerrPerms = []; sent = []; jfDown = false; jfOk = true; seerrOk = true; guardFor = null; polls = 0;
  for (const t of ["members", "sessions", "audit", "status_checks", "signins", "settings", "rate_limits", "reset_codes", "email_codes"]) await run(env.DB, `DELETE FROM ${t}`);
});
const member = (id: string, name: string, over: Record<string, unknown> = {}) => {
  const m = { expires_at: null, contact_email: `${name}@example.com`, email_verified: 1, seerr_user_id: null, reminders_on: 1, reminder_days_sent: "[]", ...over };
  return run(env.DB, "INSERT INTO members (jellyfin_id, username, contact_email, email_verified, expires_at, seerr_user_id, reminders_on, reminder_days_sent) VALUES (?,?,?,?,?,?,?,?)", id, name, m.contact_email as string, m.email_verified as number, m.expires_at as string | null, m.seerr_user_id as number | null, m.reminders_on as number, m.reminder_days_sent as string);
};

describe("expiry", () => {
  test("an expired member is disabled, signed out everywhere, loses Seerr rights and is audited; others are left alone", async () => {
    await member("u1", "maya", { expires_at: iso(-1), seerr_user_id: 9 }); await member("u2", "ben", { expires_at: iso(5) });
    await run(env.DB, "INSERT INTO sessions (id, jellyfin_id, username, is_admin, expires_at, checked_at, csrf) VALUES ('s','u1','maya',0,'2999-01-01','2999-01-01','c')");
    const r = await expireAccounts(deps());
    expect(r).toEqual({ expired: 1, failed: 0 });
    expect(policies).toEqual([["u1", { IsDisabled: true }]]);
    expect(devices).toEqual(["u1"]);
    expect(seerrPerms).toEqual([[9, "none"]]);
    expect(await first(env.DB, "SELECT id FROM sessions")).toBeNull();
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'user.expire' AND target = 'u1'")).not.toBeNull();
  });
  test("an account that is already disabled still gets the rest of the revocation, once", async () => {
    await member("u3", "zed", { expires_at: iso(-3), seerr_user_id: 4 });
    expect(await expireAccounts(deps())).toEqual({ expired: 1, failed: 0 });
    expect(devices).toEqual(["u3"]);
    expect(seerrPerms).toEqual([[4, "none"]]);
    expect(await expireAccounts(deps())).toEqual({ expired: 0, failed: 0 }); // done is remembered in Jellypass, not inferred from Jellyfin
    expect(devices).toEqual(["u3"]);
  });
  test("a step that fails part-way is retried on the next run even though Jellyfin already shows the account disabled", async () => {
    await member("u1", "maya", { expires_at: iso(-1), seerr_user_id: 9 });
    seerrFails = true;
    expect(await expireAccounts(deps())).toEqual({ expired: 0, failed: 1 });
    expect(jfUsers.u1.isDisabled).toBe(true);
    seerrFails = false;
    expect(await expireAccounts(deps())).toEqual({ expired: 1, failed: 0 });
    expect(seerrPerms).toEqual([[9, "none"]]);
    expect(devices).toEqual(["u1", "u1"]);
  });
  test("extending a membership re-arms expiry", async () => {
    await member("u1", "maya", { expires_at: iso(-1) });
    await expireAccounts(deps());
    await run(env.DB, "UPDATE members SET expires_at = ?, expiry_done = 0 WHERE jellyfin_id = 'u1'", iso(-0.5));
    jfUsers.u1.isDisabled = false;
    expect(await expireAccounts(deps())).toEqual({ expired: 1, failed: 0 });
  });
  test("with Jellyfin down nothing is marked done, and the next run finishes the job", async () => {
    await member("u1", "maya", { expires_at: iso(-1) });
    jfDown = true;
    expect(await expireAccounts(deps())).toEqual({ expired: 0, failed: 1 });
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'user.expire'")).toBeNull();
    jfDown = false;
    expect(await expireAccounts(deps())).toEqual({ expired: 1, failed: 0 });
  });
  test("a beta guard refusal counts as a failure and does not stop the others", async () => {
    await member("u1", "maya", { expires_at: iso(-1) }); await member("u2", "ben", { expires_at: iso(-1) });
    guardFor = "u1";
    expect(await expireAccounts(deps())).toEqual({ expired: 1, failed: 1 });
  });
  test("a persistent failure is recorded for admins, once a day per member", async () => {
    await member("u1", "maya", { expires_at: iso(-1), seerr_user_id: 9 });
    seerrFails = true;
    await expireAccounts(deps()); await expireAccounts(deps());
    expect(await all(env.DB, "SELECT * FROM audit WHERE action = 'expiry.failed' AND target = 'u1'")).toHaveLength(1);
  });
  test("an admin is never expired, even with a stale expiry date", async () => {
    jfUsers.u1.isAdmin = true;
    await member("u1", "maya", { expires_at: iso(-1) });
    expect(await expireAccounts(deps())).toEqual({ expired: 0, failed: 0 });
    expect(policies).toHaveLength(0);
  });
  test("an expired member whose Jellyfin account no longer exists is ignored", async () => {
    await member("gone", "gone", { expires_at: iso(-1) });
    expect(await expireAccounts(deps())).toEqual({ expired: 0, failed: 0 });
  });
});

describe("reminders", () => {
  const dayCount = (r: Array<{ subject: string }>) => r.map((x) => x.subject);
  test("a reminder goes out at 7 days and again at 1 day, each once", async () => {
    await member("u1", "maya", { expires_at: iso(6.5) });
    await sendReminders(deps()); await sendReminders(deps());
    expect(dayCount(sent)).toEqual(["Your access ends in 7 days"]);
    await run(env.DB, "UPDATE members SET expires_at = ?", iso(0.5));
    await sendReminders(deps()); await sendReminders(deps());
    expect(dayCount(sent)).toEqual(["Your access ends in 7 days", "Your access ends in 1 day"]);
  });
  test("nothing for members far from expiry, opted out, without a verified address, or already expired", async () => {
    await member("u1", "maya", { expires_at: iso(30) }); await member("u2", "ben", { expires_at: iso(2), reminders_on: 0 });
    await member("u3", "zed", { expires_at: iso(2), email_verified: 0 }); await member("u4", "old", { expires_at: iso(-1) });
    await sendReminders(deps());
    expect(sent).toHaveLength(0);
  });
  test("extending the membership resets the reminders so they can go out again", async () => {
    await member("u1", "maya", { expires_at: iso(6), reminder_days_sent: "[7]" });
    await sendReminders(deps());
    expect(sent).toHaveLength(0);
    await run(env.DB, "UPDATE members SET reminder_days_sent = '[]'");
    await sendReminders(deps());
    expect(sent).toHaveLength(1);
  });
});

describe("status checks and outage emails", () => {
  const latest = (s: string) => first<any>(env.DB, "SELECT ok FROM status_checks WHERE service = ? ORDER BY id DESC LIMIT 1", s);
  test("records each service's result", async () => {
    seerrOk = false;
    await runStatusChecks(deps());
    expect(await latest("jellyfin")).toEqual({ ok: 1 });
    expect(await latest("seerr")).toEqual({ ok: 0 });
    expect(await latest("portal")).toEqual({ ok: 1 });
  });
  test("two failed checks in a row with the setting on email each member once; recovery re-arms it", async () => {
    await member("u1", "maya"); await member("u2", "ben", { email_verified: 0 });
    await run(env.DB, "INSERT INTO settings (key, value) VALUES ('outage_email','1')");
    jfOk = false;
    await runStatusChecks(deps()); expect(sent).toHaveLength(0);          // one blip is not an outage
    await runStatusChecks(deps()); expect(sent).toHaveLength(1);          // confirmed
    await runStatusChecks(deps()); expect(sent).toHaveLength(1);          // not again
    expect(sent[0]).toMatchObject({ to: "maya@example.com", subject: "Jellyfin is having problems" });
    jfOk = true; await runStatusChecks(deps());
    jfOk = false; await runStatusChecks(deps()); await runStatusChecks(deps());
    expect(sent).toHaveLength(2);
  });
  test("with the setting off, no outage email is sent", async () => {
    await member("u1", "maya"); jfOk = false;
    await runStatusChecks(deps()); await runStatusChecks(deps());
    expect(sent).toHaveLength(0);
  });
});

describe("pruning", () => {
  test("keeps what is inside retention and removes the rest", async () => {
    const old = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();
    await run(env.DB, "INSERT INTO signins (source, jellyfin_id, device, ip, seen_at) VALUES ('portal','u1','d','1.1.1.1',?),('portal','u1','d','1.1.1.2',?)", old(91), old(89));
    await run(env.DB, "INSERT INTO status_checks (service, ok, at) VALUES ('x',1,?),('x',1,?)", old(91), old(1));
    await run(env.DB, "INSERT INTO audit (actor, action, at) VALUES ('a','old',?),('a','new',?)", old(366), old(364));
    await run(env.DB, "INSERT INTO sessions (id, jellyfin_id, username, is_admin, expires_at, checked_at, csrf) VALUES ('s1','u1','m',0,?,?,'c'),('s2','u1','m',0,?,?,'c')", old(1), old(2), iso(1), old(0));
    await prune(env.DB);
    expect((await all<any>(env.DB, "SELECT ip FROM signins")).map((r) => r.ip)).toEqual(["1.1.1.2"]);
    expect(await all(env.DB, "SELECT * FROM status_checks")).toHaveLength(1);
    expect((await all<any>(env.DB, "SELECT action FROM audit")).map((r) => r.action)).toEqual(["new"]);
    expect((await all<any>(env.DB, "SELECT id FROM sessions")).map((r) => r.id)).toEqual(["s2"]);
  });
});

describe("scheduled dispatch", () => {
  const at = (h: number, m: number) => new Date(Date.UTC(2026, 10, 14, h, m));
  test("every run does the core jobs; reminders and pruning only in their windows", async () => {
    await member("u1", "maya", { expires_at: iso(6.5) });
    await runScheduled(deps(), at(12, 20));
    expect(polls).toBe(1); expect(sent).toHaveLength(0);
    await runScheduled(deps(), at(8, 2));
    expect(sent).toHaveLength(1);
    await run(env.DB, "INSERT INTO audit (actor, action, at) VALUES ('a','old',?)", new Date(Date.now() - 400 * 86400_000).toISOString());
    await runScheduled(deps(), at(3, 1));
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'old'")).toBeNull();
  });
  test("one failing job does not stop the others", async () => {
    await member("u1", "maya", { expires_at: iso(-1) });
    jfDown = true;
    await expect(runScheduled(deps(), at(12, 20))).resolves.toBeDefined();
    expect(polls).toBe(1);
  });
});

describe("status page API", () => {
  const app = createApp({ jellyfin: (() => ({ authenticate: async () => ({ id: "u1", name: "maya", isAdmin: false }), getUser: async (id: string) => jfUsers[id] ?? null })) as never });
  test("shows 90 days per service, uptime, the latest state and active incident posts", async () => {
    await run(env.DB, "INSERT INTO status_checks (service, ok, latency_ms, at) VALUES ('jellyfin',1,10,?),('jellyfin',0,10,?),('jellyfin',1,10,?)", new Date(Date.now() - 180_000).toISOString(), new Date(Date.now() - 120_000).toISOString(), new Date().toISOString());
    await run(env.DB, "INSERT INTO announcements (title, body, kind, created_by) VALUES ('Jellyfin restarting','Back soon','incident','olivia'),('Hello','x','info','olivia')");
    const r = await app.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "maya", password: "x" }) }, env);
    const res = await app.request("/api/status", { headers: { cookie: r.headers.get("set-cookie")!.split(";")[0] } }, env);
    const body = (await res.json()) as any;
    const j = body.services.find((s: any) => s.service === "jellyfin");
    expect(j.days).toHaveLength(90);
    expect(j.ok).toBe(true);
    expect(j.uptime).toBeCloseTo(66.7, 0);
    expect(j.days.at(-1)).toMatchObject({ ok: false, checks: 3, failed: 1 });
    expect(j.days.find((d: any) => d.ok === null)).toMatchObject({ checks: 0, failed: 0 });
    expect(body.since).toBe(new Date().toISOString().slice(0, 10)); // the first check recorded, for "monitoring since"
    expect(body.incidents.map((i: any) => i.title)).toEqual(["Jellyfin restarting"]);
  });
  test("email delivery reads as ready on quiet days after the first send, and is not blank when nothing was ever sent", async () => {
    await run(env.DB, "DELETE FROM status_checks");
    const r = await app.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "maya", password: "x" }) }, env);
    const get = async () => ((await (await app.request("/api/status", { headers: { cookie: r.headers.get("set-cookie")!.split(";")[0] } }, env)).json()) as any).services.find((s: any) => s.service === "email");
    expect((await get()).ok).toBe(true); // never sent: ready, not "?"
    await run(env.DB, "INSERT INTO status_checks (service, ok, latency_ms, at) VALUES ('email',1,900,?)", new Date(Date.now() - 3 * 86400_000).toISOString());
    const e = await get();
    expect(e.days.at(-1)).toMatchObject({ quiet: true, checks: 0 });
    expect(e.days.at(-4)).toMatchObject({ checks: 1 });
    expect(e.days.at(-4).quiet).toBeUndefined();
    expect(e.days.at(-60).quiet).toBeUndefined(); // before the first send there is genuinely no data
  });
  test("needs a session", async () => {
    expect((await app.request("/api/status", {}, env)).status).toBe(401);
  });
});
