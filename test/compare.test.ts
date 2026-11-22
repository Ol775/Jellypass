import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { compareHistories, personStats } from "../src/compare";
import { compareDefault } from "../src/members";
import { first, run } from "../src/db";
import migration from "../migrations/0009_compare_default_on.sql?raw";

const A = "a".repeat(32), B = "b".repeat(32), C = "c".repeat(32);
const users: Record<string, any> = { [A]: { id: A, name: "maya" }, [B]: { id: B, name: "ben" }, [C]: { id: C, name: "cat" } };
const watched: Record<string, any[]> = {
  [A]: [{ Id: "1", Name: "Heat", Type: "Movie", ProductionYear: 1995, UserData: { PlayCount: 1 } }, { Id: "2", Name: "Pilot", Type: "Episode", SeriesName: "Slow Horses", SeriesId: "s", UserData: { PlayCount: 1 } }, { Id: "3", Name: "Secret Film", Type: "Movie", UserData: { PlayCount: 1 } }],
  [B]: [{ Id: "9", Name: "Heat", Type: "Movie", ProductionYear: 1995, UserData: { PlayCount: 1 } }, { Id: "8", Name: "Ep 4", Type: "Episode", SeriesName: "Slow Horses", SeriesId: "s", UserData: { PlayCount: 1 } }, { Id: "7", Name: "Only Ben", Type: "Movie", UserData: { PlayCount: 1 } }],
  [C]: [],
};
const app = createApp({ jellyfin: (() => ({
  authenticate: async (n: string) => { const u = Object.values(users).find((x: any) => x.name === n); return u ? { ...u, isAdmin: false } : null; },
  getUser: async (id: string) => (users[id] ? { ...users[id], isAdmin: false, isDisabled: false } : null),
  userItems: async (id: string) => watched[id], resume: async () => [],
  nowPlaying: async () => [{ userId: A, title: "Heat", subtitle: "", paused: false, remainingSeconds: 3600, itemId: "e1", posterId: "p1", progressPct: 40, year: 1995 }, { userId: B, title: "Slow Horses", subtitle: "S1E2", paused: false }, { userId: C, title: "Hidden", subtitle: "", paused: false }],
})) as never });
async function login(name: string) {
  const r = await app.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: name, password: "x" }) }, env);
  return { cookie: r.headers.get("set-cookie")!.split(";")[0], "x-csrf-token": ((await r.json()) as any).csrf as string };
}
const call = (path: string, h: Record<string, string>, method = "GET", body?: unknown) => app.request(path, { method, headers: { ...h, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }, env);

test("compareHistories returns only shared titles, collapsing episodes into their show", () => {
  const row = (title: string, kind: "film" | "tv") => ({ id: title, kind, title, subtitle: "", posterUrl: null, lastPlayed: null, playCount: 1, resumePct: null, runtimeMinutes: null, genres: [] }) as never;
  const r = compareHistories([row("Heat", "film"), row("Show", "tv"), row("Show", "tv"), row("Mine", "film")], [row("heat", "film"), row("Show", "tv"), row("Theirs", "film")]);
  expect(r.shared.map((s) => s.title)).toEqual(["Heat", "Show"]);
  expect([r.mine, r.theirs, r.matchPct]).toEqual([3, 3, 50]);
});

describe("compare routes", () => {
  test("opt-in is required on both sides and nothing else of the other member leaks", async () => {
    const a = await login("maya"), b = await login("ben");
    await run(env.DB, `UPDATE members SET onboarding_state = '{"done":true}', compare_on = 0`);
    expect((await call(`/api/compare/${B}`, a)).status).toBe(403); // caller opted out
    expect(await (await call("/api/compare", a)).json()).toEqual({ enabled: false, people: [] });
    expect((await call("/compare", a)).headers.get("location")).toBe("/settings");
    expect((await call("/api/compare/optin", a, "PUT", { on: true })).status).toBe(200);
    expect((await call(`/api/compare/${B}`, a)).status).toBe(404); // other member has not opted in
    expect((await call("/api/compare/optin", a, "PUT", { on: "yes" })).status).toBe(400);
    await call("/api/compare/optin", b, "PUT", { on: true });
    expect(((await (await call("/api/compare", a)).json()) as any).people).toEqual([{ id: B, name: "ben" }]);
    const r = (await (await call(`/api/compare/${B}`, a)).json()) as any;
    expect(r.shared.map((s: any) => s.title)).toEqual(["Heat", "Slow Horses"]);
    expect(JSON.stringify(r)).not.toContain("Only Ben");
    expect(JSON.stringify(r)).not.toContain("Secret Film");
    expect((await call(`/api/compare/${A}`, a)).status).toBe(404); // not yourself
    const page = await (await call("/discover", a)).text();
    expect(page).toContain('href="/compare"');
    await run(env.DB, "UPDATE members SET compare_on = 0");
  });
  test("the menu has no Compare entry for a member who switched it off", async () => {
    const c = await login("cat");
    await run(env.DB, `UPDATE members SET onboarding_state = '{"done":true}', compare_on = 0`);
    expect(await (await call("/discover", c)).text()).not.toContain('href="/compare"');
  });
});

test("watching now is part of the compare opt-in: both sides must have it on, and only name and title are shared", async () => {
  const a = await login("maya"), b = await login("ben");
  await run(env.DB, `UPDATE members SET compare_on = 0`);
  expect((await call("/api/compare/now", a)).status).toBe(403);
  await call("/api/compare/optin", a, "PUT", { on: true });
  const alone = (await (await call("/api/compare/now", a)).json()) as any[]; // ben has not opted in; cat is not opted in either
  expect(alone).toHaveLength(1);
  expect(alone[0]).toMatchObject({ you: true, name: "maya", title: "Heat" }); // my own stream: times only, never an address, ISP or device
  expect(Object.keys(alone[0]).sort()).toEqual(["endsAt", "id", "name", "paused", "posterUrl", "progressPct", "startedAt", "subtitle", "title", "url", "year", "you"]);
  expect(alone[0].posterUrl).toContain("/Items/p1/Images/Primary"); expect(alone[0].url).toContain("/web/#/details?id=e1"); // poster and a direct Jellyfin link, own stream only
  expect(Date.parse(alone[0].endsAt) - Date.now()).toBeGreaterThan(3500_000);
  await call("/api/compare/optin", b, "PUT", { on: true });
  const rows = (await (await call("/api/compare/now", a)).json()) as any[];
  expect(rows.slice(1)).toEqual([{ id: B, name: "ben", title: "Slow Horses", subtitle: "S1E2", paused: false, posterUrl: null }]); // others: name, title and poster only
  await run(env.DB, `UPDATE members SET compare_on = 0`);
});

test("demo Watching now rows appear only in beta with DEMO_COMPARE=1, never in prod", async () => {
  const a = await login("maya");
  await run(env.DB, `UPDATE members SET compare_on = 0`);
  await call("/api/compare/optin", a, "PUT", { on: true });
  const get = async (e: any) => (await (await app.request("/api/compare/now", { headers: a }, e)).json()) as any[];
  expect((await get({ ...env, ENVIRONMENT: "beta", DEMO_COMPARE: "1" })).some((r) => r.name === "Demo Sam")).toBe(true);
  expect((await get({ ...env, ENVIRONMENT: "prod", DEMO_COMPARE: "1" })).some((r) => String(r.name).startsWith("Demo"))).toBe(false);
  expect((await get({ ...env, ENVIRONMENT: "beta" })).some((r) => String(r.name).startsWith("Demo"))).toBe(false);
  const people = async (e: any) => ((await (await app.request("/api/compare", { headers: a }, e)).json()) as any).people as any[];
  const grp = (e: any) => app.request("/api/compare/group?ids=" + "d".repeat(32) + "," + "e".repeat(32), { headers: a }, e);
  const shown = (await (await grp({ ...env, ENVIRONMENT: "beta", DEMO_COMPARE: "1" })).json()) as any;
  expect(shown.people.map((p: any) => p.name)).toEqual(["maya", "Demo Sam", "Demo Alex"]);
  expect(shown.people[1].stats.totalHours).toBeGreaterThan(0);
  expect(shown.shared.length).toBeGreaterThan(0);
  expect((await grp({ ...env, ENVIRONMENT: "prod", DEMO_COMPARE: "1" })).status).toBe(404);
  await run(env.DB, `UPDATE members SET compare_on = 0`);
});

test("group compare: stats per person and only titles everyone watched; not-opted-in is 'not found'; at most 4", async () => {
  const a = await login("maya"), b = await login("ben");
  await run(env.DB, `UPDATE members SET compare_on = 0`);
  await call("/api/compare/optin", a, "PUT", { on: true });
  expect((await call(`/api/compare/group?ids=${B}`, a)).status).toBe(404); // ben has not opted in
  await call("/api/compare/optin", b, "PUT", { on: true });
  const r = (await (await call(`/api/compare/group?ids=${B}`, a)).json()) as any;
  expect(r.people.map((p: any) => p.name)).toEqual(["maya", "ben"]);
  expect(r.people[0].you).toBe(true);
  expect(r.shared.map((t: any) => t.title)).toEqual(["Heat", "Slow Horses"]);
  expect(r.shared.find((t: any) => t.title === "Heat").url).toBe("https://jf.test/web/#/details?id=1"); // Open in Jellyfin target
  expect(r.shared.find((t: any) => t.title === "Slow Horses").url).toBe("https://jf.test/web/#/details?id=s"); // a show links to the series
  expect(r.shared.every((t: any) => !("linkId" in t))).toBe(true);
  expect(Object.keys(r.people[1])).toEqual(["id", "name", "you", "stats"]); // no history rows leak
  expect((await call(`/api/compare/group?ids=${[B, C, "1".repeat(32), "2".repeat(32), "3".repeat(32)].join(",")}`, a)).status).toBe(400);
  expect((await call(`/api/compare/group?ids=${A}`, a)).status).toBe(400); // not yourself
  await run(env.DB, `UPDATE members SET compare_on = 0`);
});

test("personStats totals hours, genres, busiest day and usual time", () => {
  const row = (o: any) => ({ id: "i", kind: "tv", title: "Show", subtitle: "", posterUrl: null, lastPlayed: "2026-11-15T20:30:00Z", playCount: 1, resumePct: null, runtimeMinutes: 60, genres: ["Drama"], ...o });
  const s = personStats([row({}), row({ id: "j", playCount: 2 }), row({ id: "k", kind: "film", title: "Film", runtimeMinutes: 120, genres: ["Action"] })], new Date("2026-11-17T12:00:00Z"));
  expect(s).toMatchObject({ totalHours: 5, tvHours: 3, filmHours: 2, films: 1, shows: 1, episodes: 2, rewatches: 1, topGenres: ["Drama", "Action"], busiestDay: "Sunday", usualTime: "Evening", last30Hours: 4 });
  expect(s.topTitle).toEqual({ title: "Show", hours: 3 });
});

test("Compare is on by default for new members, and the migration keeps explicit opt-outs", async () => {
  await run(env.DB, "DELETE FROM members WHERE jellyfin_id = ?", A);
  await login("maya"); // first sign-in creates the member row
  expect((await first<{ compare_on: number }>(env.DB, "SELECT compare_on FROM members WHERE jellyfin_id = ?", A))?.compare_on).toBe(1); // new member: on
  // Existing members (all 0 before the migration): maya never chose, ben switched off, cat switched off then on again.
  await run(env.DB, "UPDATE members SET compare_on = 0");
  await run(env.DB, "DELETE FROM audit WHERE action LIKE 'compare.%'");
  for (const [action, target] of [["compare.off", B], ["compare.on", C], ["compare.off", C], ["compare.on", C]]) await run(env.DB, "INSERT INTO audit (actor, action, target) VALUES ('x', ?, ?)", action, target);
  await login("ben"); await login("cat"); await run(env.DB, "UPDATE members SET compare_on = 0");
  await env.DB.prepare(migration.split("\n").filter((l) => !l.startsWith("--")).join(" ")).run();
  const on = async (id: string) => (await first<{ compare_on: number }>(env.DB, "SELECT compare_on FROM members WHERE jellyfin_id = ?", id))?.compare_on;
  expect([await on(A), await on(B), await on(C)]).toEqual([1, 0, 1]); // maya on, ben stays off, cat's latest choice was on
  await run(env.DB, "DELETE FROM audit WHERE action LIKE 'compare.%'");
  await run(env.DB, "UPDATE members SET compare_on = 0");
});

test("service and test accounts are not switched on for Compare by default", () => {
  expect(["admin", "Admin", "zTest", "zTest1", "ztest22"].map(compareDefault)).toEqual([0, 0, 0, 0, 0]);
  expect(["Olivia", "adminsam", "testing", "zebra"].map(compareDefault)).toEqual([1, 1, 1, 1]);
});
