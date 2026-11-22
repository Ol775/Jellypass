import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { historyStats, historyRange, historyPage } from "../src/history";
import { buildWrapped, wrappedFacts, wrappedYears } from "../src/wrapped";
import { first, run } from "../src/db";

const ID = (n: number) => n.toString(16).padStart(32, "0");
const day = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();
let failClear = false;
let played: any[], resume: any[], cleared: Array<[string, string]>, setPlayed: Array<[string, string, boolean]> = [];
const users: Record<string, any> = { u1: { id: "u1", name: "maya", isAdmin: false, isDisabled: false }, u2: { id: "u2", name: "ben", isAdmin: false, isDisabled: false } };
const app = createApp({
  jellyfin: (() => ({
    authenticate: async (n: string) => { const u = Object.values(users).find((x: any) => x.name === n); return u ? { id: u.id, name: u.name, isAdmin: false } : null; },
    getUser: async (id: string) => users[id] ?? null,
    userItems: async () => played,
    resume: async () => resume,
    setPlayed: async (u: string, i: string, p: boolean) => void setPlayed.push([u, i, p]),
    clearResume: async (u: string, i: string) => { cleared.push([u, i]); if (failClear) throw new Error("offline"); },
  })) as never,
});
async function login(name = "maya") {
  const r = await app.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: name, password: "x" }) }, env);
  return { cookie: r.headers.get("set-cookie")!.split(";")[0], "x-csrf-token": ((await r.json()) as any).csrf as string };
}
const film = (n: number, d: number, extra: any = {}) => ({ Id: ID(n), Name: `Film ${n}`, Type: "Movie", ProductionYear: 2020, RunTimeTicks: 1000, ImageTags: { Primary: "t" }, UserData: { PlayCount: 1, LastPlayedDate: day(d), PlaybackPositionTicks: 0, Played: true }, ...extra });
const ep = (n: number, d: number) => ({ Id: ID(n), Name: "Pilot", Type: "Episode", SeriesName: "Slow Horses", ParentIndexNumber: 1, IndexNumber: 2, RunTimeTicks: 1000, ImageTags: {}, SeriesPrimaryImageTag: "s", SeriesId: ID(900), UserData: { PlayCount: 2, LastPlayedDate: day(d), PlaybackPositionTicks: 0, Played: true } });

beforeEach(async () => {
  played = []; resume = []; cleared = []; failClear = false;
  setPlayed = [];
  for (const t of ["members", "sessions", "rate_limits", "audit", "ratings"]) await run(env.DB, `DELETE FROM ${t}`);
});
const history = async (a: any, q = "") => ((await (await app.request(`/api/history${q}`, { headers: { cookie: a.cookie } }, env)).json()) as any[]);

describe("history", () => {
  test("films and episodes are mapped, newest first, with poster links and no tokens", async () => {
    played = [film(1, 3), ep(2, 0), film(3, 1)];
    const a = await login();
    const rows = await history(a);
    expect(rows.map((r) => r.title)).toEqual(["Slow Horses", "Film 3", "Film 1"]);
    expect(rows[0]).toMatchObject({ kind: "tv", subtitle: "S1E2 · Pilot", playCount: 2 });
    expect(rows[1]).toMatchObject({ kind: "film", subtitle: "2020" });
    expect(rows[1].posterUrl).toContain(`/Items/${ID(3)}/Images/Primary`);
    expect(JSON.stringify(rows)).not.toMatch(/api_key|Token|X-Emby/i);
  });
  test("each row carries the runtime in minutes, and null when unknown", async () => {
    played = [film(1, 1, { RunTimeTicks: 27_000_000_000 }), film(2, 2, { RunTimeTicks: 0 }), film(3, 3, { RunTimeTicks: undefined })];
    const a = await login();
    const rows = await history(a);
    expect(rows.map((r) => r.runtimeMinutes)).toEqual([45, null, null]);
  });
  test("limit and offset page through the list, newest first", async () => {
    played = [1, 2, 3, 4, 5].map((n) => film(n, n));
    const a = await login();
    expect((await history(a, "?limit=2")).map((r) => r.title)).toEqual(["Film 1", "Film 2"]);
    expect((await history(a, "?limit=2&offset=2")).map((r) => r.title)).toEqual(["Film 3", "Film 4"]);
    expect((await history(a, "?limit=2&offset=4")).map((r) => r.title)).toEqual(["Film 5"]);
    expect((await history(a, "?limit=9999")).length).toBe(5);
    expect((await history(a, "?limit=-3&offset=abc")).length).toBe(5);
  });
  test("the kind filter splits films and TV", async () => {
    played = [film(1, 3), ep(2, 0)];
    const a = await login();
    expect((await history(a, "?kind=film")).map((r) => r.kind)).toEqual(["film"]);
    expect((await history(a, "?kind=tv")).map((r) => r.kind)).toEqual(["tv"]);
  });
  test("in-progress items show resume progress and are merged without duplicates", async () => {
    played = [film(1, 2)];
    resume = [film(1, 2, { UserData: { PlayCount: 1, LastPlayedDate: day(2), PlaybackPositionTicks: 250, Played: false } }), film(4, 0, { UserData: { PlayCount: 0, LastPlayedDate: day(0), PlaybackPositionTicks: 500, Played: false } })];
    const a = await login();
    const rows = await history(a);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.title === "Film 1").resumePct).toBe(25);
    expect(rows.find((r) => r.title === "Film 4").resumePct).toBe(50);
  });
  test("items without a play date or with zero runtime do not break the list", async () => {
    played = [film(1, 1, { RunTimeTicks: 0, UserData: { PlayCount: 1, PlaybackPositionTicks: 10 } })];
    const a = await login();
    const rows = await history(a);
    expect(rows[0].resumePct).toBeNull();
  });
  test("removing a row hides it, clears the resume point and leaves the watched state alone", async () => {
    played = [film(1, 1), film(2, 2)];
    const a = await login();
    expect((await app.request(`/api/history/${ID(1)}/remove`, { method: "POST", headers: a }, env)).status).toBe(200);
    expect((await history(a)).map((r) => r.title)).toEqual(["Film 2"]);
    expect(cleared).toEqual([["u1", ID(1)]]);
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'history.remove'")).toBeNull(); // personal data actions are not admin-audited
  });
  test("a malformed item id is rejected", async () => {
    const a = await login();
    expect((await app.request("/api/history/not-an-id/remove", { method: "POST", headers: a }, env)).status).toBe(400);
  });
  test("it needs a session", async () => {
    expect((await app.request("/api/history", {}, env)).status).toBe(401);
  });
});


describe("history statistics and clearing", () => {
  const stats = async (a: any) => {
    const res = await app.request("/api/history/stats", { headers: a }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("private");
    return await res.json() as any;
  };
  test("estimates calendar months, daily hours, types and most watched, excluding hidden rows", async () => {
    const now = new Date();
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)).toISOString();
    played = [film(1, 0, { RunTimeTicks: 72_000_000_000 }),
      { ...ep(2, 0), RunTimeTicks: 36_000_000_000 },
      film(3, 0, { RunTimeTicks: 108_000_000_000, UserData: { LastPlayedDate: lastMonth, PlayCount: 3 } }),
      film(4, 0, { RunTimeTicks: 360_000_000_000 })];
    const a = await login();
    await app.request(`/api/history/${ID(4)}/remove`, { method: "POST", headers: a }, env);
    const s = await stats(a);
    expect(s).toMatchObject({ thisMonthHours: 3, lastMonthHours: 3, filmsHours: 2, tvHours: 1, films: 1, episodes: 1 });
    expect(s.days).toHaveLength(14);
    expect(s.days[13]).toEqual({ date: now.toISOString().slice(0, 10), hours: 3 });
    expect(s.days[0].date < s.days[13].date).toBe(true);
    expect(s.mostWatched).toEqual([{ title: "Film 3", hours: 9 }, { title: "Film 1", hours: 2 }, { title: "Slow Horses", hours: 2 }]);
  });
  test("empty history has zero estimates and no most watched titles", async () => {
    const s = await stats(await login());
    expect(s).toMatchObject({ thisMonthHours: 0, lastMonthHours: 0, filmsHours: 0, tvHours: 0, films: 0, episodes: 0, mostWatched: [] });
    expect(s.days).toHaveLength(14);
    expect(s.days.every((d: any) => d.hours === 0)).toBe(true);
  });
  test("clear hides all rows for this member only and clears part-watched resume points", async () => {
    played = [film(1, 0), film(2, 1)];
    resume = [film(3, 0, { UserData: { PlaybackPositionTicks: 500 } })];
    const a = await login(), b = await login("ben");
    const res = await app.request("/api/history/clear", { method: "POST", headers: a }, env);
    expect(await res.json()).toEqual({ ok: true, cleared: 3 });
    expect(await history(a)).toEqual([]);
    expect(await history(b)).toHaveLength(3);
    expect(cleared).toEqual([["u1", ID(3)]]);
    expect((await stats(a)).thisMonthHours).toBe(0);
  });
  test("new endpoints require a session and clear requires CSRF", async () => {
    expect((await app.request("/api/history/stats", {}, env)).status).toBe(401);
    expect((await app.request("/api/history/clear", { method: "POST" }, env)).status).toBe(401);
    const a = await login();
    expect((await app.request("/api/history/clear", { method: "POST", headers: { cookie: a.cookie } }, env)).status).toBe(403);
  });
});


test("clear keeps the newest 500 hidden ids even if Jellyfin resume clearing fails", async () => {
  const a = await login();
  const hidden = Array.from({ length: 500 }, (_, i) => ID(i + 100));
  await run(env.DB, "UPDATE members SET hidden_history_json = ? WHERE jellyfin_id = ?", JSON.stringify(hidden), "u1");
  resume = [film(1, 0, { UserData: { PlaybackPositionTicks: 500 } })];
  failClear = true;
  const res = await app.request("/api/history/clear", { method: "POST", headers: a }, env);
  expect(await res.json()).toEqual({ ok: true, cleared: 1 });
  const member = await first<{ hidden_history_json: string }>(env.DB, "SELECT hidden_history_json FROM members WHERE jellyfin_id = ?", "u1");
  expect(JSON.parse(member!.hidden_history_json)).toEqual([...hidden.slice(1), ID(1)]);
  expect(await history(a)).toEqual([]);
});

test("statistics round once, cross year boundaries and combine episodes by title", () => {
  const row = { id: ID(1), kind: "tv" as const, title: "A series", subtitle: "", posterUrl: null, lastPlayed: "2026-01-01T12:00:00Z", playCount: 2, resumePct: null, runtimeMinutes: 20, genres: [] as string[] };
  const stats = historyStats([row, { ...row, id: ID(2) }, { ...row, id: ID(3), kind: "film", title: "Old film", lastPlayed: "2025-12-31T23:59:59Z", runtimeMinutes: 90 }], new Date("2026-01-01T18:00:00Z"));
  expect(stats).toMatchObject({ thisMonthHours: 0.7, lastMonthHours: 1.5, films: 0, episodes: 2, tvHours: 0.7 });
  expect(stats.days[13]).toEqual({ date: "2026-01-01", hours: 0.7 });
  expect(stats.mostWatched).toEqual([{ title: "Old film", hours: 3 }, { title: "A series", hours: 1.3 }]);
});

describe("history ranges and pages", () => {
  const rows = (...ds: number[]) => ds.map((d, i) => ({ id: ID(i + 1), kind: (i % 2 ? "tv" : "film") as "film" | "tv", title: `T${i % 3}`, subtitle: "", posterUrl: null, lastPlayed: day(d), playCount: 1, resumePct: null, runtimeMinutes: 60, genres: [] }));
  const now = new Date();
  test("week, month, 90 days and year each count only their own period and compare with the one before", () => {
    const r = rows(0, 3, 6, 10, 29, 31, 60, 100, 200, 400);
    expect(historyRange(r, "week", now)).toMatchObject({ totalHours: 3, previousHours: 1, titles: 3 }); // days 0,3,6 | previous: 10
    expect(historyRange(r, "month", now).totalHours).toBe(5); // 0,3,6,10,29
    expect(historyRange(r, "month", now).previousHours).toBe(1); // 31 (day 60 falls in the period before)
    expect(historyRange(r, "90d", now).totalHours).toBe(7); // up to day 60 (and 31) plus 100 is outside
    expect(historyRange(r, "year", now).totalHours).toBeGreaterThanOrEqual(8);
    expect(historyRange(r, "week", now).buckets).toHaveLength(7);
    expect(historyRange(r, "month", now).buckets).toHaveLength(30);
    expect(historyRange(r, "90d", now).buckets).toHaveLength(13);
    expect(historyRange(r, "year", now).buckets).toHaveLength(12);
    for (const range of ["week", "month", "90d", "year"] as const) { const x = historyRange(r, range, now); expect(Math.round(x.buckets.reduce((a, b) => a + b.hours, 0) * 10) / 10).toBeCloseTo(x.totalHours, 0); }
  });
  test("pages are bounded, newest first, filterable by period, and clamp bad page numbers", () => {
    const r = rows(...Array.from({ length: 23 }, (_, i) => i));
    const p1 = historyPage(r, { size: 10 }, now), p3 = historyPage(r, { page: 3, size: 10 }, now);
    expect([p1.items.length, p1.total, p1.pages, p1.page]).toEqual([10, 23, 3, 1]);
    expect(p3.items).toHaveLength(3);
    expect(historyPage(r, { page: 99, size: 10 }, now).page).toBe(3);
    expect(historyPage(r, { page: -4, size: 10 }, now).page).toBe(1);
    expect(historyPage(r, { range: "week", size: 10 }, now).total).toBe(7);
    expect(historyPage(r, { size: 1000 }, now).size).toBe(50);
  });
  test("API: summary and list work, validate their inputs and never leak tokens", async () => {
    played = [film(1, 0), film(2, 2), ep(3, 20), film(4, 200)];
    const a = await login();
    const sum = (await (await app.request("/api/history/summary?range=week", { headers: { cookie: a.cookie } }, env)).json()) as any;
    expect(sum.range).toBe("week"); expect(sum.buckets).toHaveLength(7); expect(sum.titles).toBe(2);
    expect(((await (await app.request("/api/history/summary?range=bogus", { headers: { cookie: a.cookie } }, env)).json()) as any).range).toBe("month");
    const list = (await (await app.request("/api/history/list?range=month&size=5&page=1", { headers: { cookie: a.cookie } }, env)).json()) as any;
    expect(list).toMatchObject({ total: 3, page: 1, pages: 1, size: 5 });
    expect(list.items).toHaveLength(3);
    expect(JSON.stringify(list)).not.toMatch(/api_key|Token|X-Emby/i);
    expect((await app.request("/api/history/list", {}, env)).status).toBe(401);
  });
});

describe("wrapped", () => {
  const at = (iso: string, extra: any = {}) => ({ id: ID(Math.floor(Math.random() * 1e9)), kind: "tv" as const, title: "Slow Horses", subtitle: "", posterUrl: "p", lastPlayed: iso, playCount: 1, resumePct: null, runtimeMinutes: 60, genres: ["Drama"], ...extra });
  test("totals, top titles, genres, busiest month and day, binge, streak and persona for one calendar year", () => {
    const rows = [
      at("2026-03-10T20:30:00Z"), at("2026-03-10T21:30:00Z"), at("2026-03-11T20:00:00Z"), at("2026-03-12T20:00:00Z"),
      at("2026-05-01T09:00:00Z", { kind: "film", title: "Heat", runtimeMinutes: 170, genres: ["Crime", "Drama"] }),
      at("2025-12-31T20:00:00Z", { title: "Last year" }), // other year: ignored
    ];
    const w = buildWrapped(rows, 2026, new Date("2026-11-15T12:00:00Z"));
    expect(w).toMatchObject({ year: 2026, partial: true, hasData: true, titles: 2, plays: 5, films: 1, episodes: 4 });
    expect(w.totalHours).toBeCloseTo(6.8, 1); // 4 x 60 + 170 minutes
    expect(w.topShows[0]).toMatchObject({ title: "Slow Horses", hours: 4, plays: 4 });
    expect(w.topFilms[0].title).toBe("Heat");
    expect(w.topGenres[0]).toMatchObject({ name: "Drama" });
    expect(w.busiestMonth).toMatchObject({ month: "2026-03" });
    expect(w.busiestDay).toMatchObject({ date: "2026-05-01", titles: 1 }); // the 170 minute film beats two episodes
    expect(w.bingeDay).toMatchObject({ date: "2026-03-10", episodes: 2 });
    expect(w.longestStreak).toBe(3);
    expect(w.persona?.key).toBe("prime");
    expect(w.months).toHaveLength(12);
    expect(w.busiestWeekday).toBe("Friday"); // 1 May 2026 is a Friday and the 170 minute film outweighs the Tuesday-Thursday episodes
    expect(w.weekdays).toHaveLength(7);
    expect(w.dayparts.evening).toBeGreaterThan(0);
    expect(w.opening).toMatchObject({ title: "Slow Horses" });
    expect(w.closing).toMatchObject({ title: "Heat" });
    expect(w.genreCount).toBe(2);
  });
  test("rewatches add up extra plays per title, and a favourite decade needs three films", () => {
    const rows = [at("2026-02-01T20:00:00Z", { playCount: 3 }), at("2026-02-02T20:00:00Z", { title: "Heat", kind: "film", subtitle: "1995", playCount: 2 }), at("2026-02-03T20:00:00Z", { title: "Ronin", kind: "film", subtitle: "1998" }), at("2026-02-04T20:00:00Z", { title: "Collateral", kind: "film", subtitle: "2004" })];
    const w = buildWrapped(rows, 2026, new Date("2026-11-15T12:00:00Z"));
    expect(w.rewatches).toEqual({ total: 3, top: [{ title: "Slow Horses", kind: "tv", times: 2 }, { title: "Heat", kind: "film", times: 1 }] });
    expect(w.topDecade).toEqual({ decade: "1990s", films: 2 });
    expect(buildWrapped(rows.slice(0, 2), 2026).topDecade).toBeNull();
  });
  test("an empty or tiny year has no persona and does not invent records; Europe/London decides the day", () => {
    expect(buildWrapped([], 2026)).toMatchObject({ hasData: false, totalHours: 0, persona: null, busiestMonth: null, busiestDay: null, topShows: [] });
    const lateNight = buildWrapped([at("2026-07-01T23:30:00Z", { runtimeMinutes: 30 })], 2026); // 00:30 on 2 July in London
    expect(lateNight.busiestDay?.date).toBe("2026-07-02");
    expect(buildWrapped([at("2026-12-31T23:30:00Z")], 2026, new Date("2026-12-31T23:40:00Z")).hasData).toBe(true);
    expect(buildWrapped([at("2025-12-31T23:30:00Z")], 2026).hasData).toBe(false);
    expect(wrappedYears([at("2026-01-02T12:00:00Z"), at("2024-06-01T12:00:00Z"), at("2026-02-01T12:00:00Z")])).toEqual([2026, 2024]);
  });
  test("API: needs a session, clamps the year, and returns the review plus available years", async () => {
    played = [film(1, 0), film(2, 3)];
    expect((await app.request("/api/wrapped", {}, env)).status).toBe(401);
    const a = await login();
    const w = (await (await app.request("/api/wrapped?year=1999", { headers: { cookie: a.cookie } }, env)).json()) as any;
    expect(w.year).toBe(new Date().getUTCFullYear());
    expect(w.years).toContain(new Date().getUTCFullYear());
    expect(w.name).toBe("maya");
    expect(JSON.stringify(w)).not.toMatch(/api_key|Token|X-Emby/i);
  });
  test("comparison facts are built only from real numbers: references, ratios, shares, year on year", () => {
    const rows = [
      ...Array.from({ length: 12 }, (_, i) => at(`2026-03-${String(i + 1).padStart(2, "0")}T20:00:00Z`, { runtimeMinutes: 60 })),
      at("2026-03-14T20:00:00Z", { kind: "film", title: "Heat", runtimeMinutes: 170, genres: ["Crime"] }),
      at("2026-05-02T20:00:00Z", { kind: "film", title: "Heat 2", runtimeMinutes: 100 }),
      at("2025-06-01T20:00:00Z", { runtimeMinutes: 120 }),
    ];
    const w = buildWrapped(rows, 2026, new Date("2026-11-15T12:00:00Z"));
    const facts = wrappedFacts(w), byKey = Object.fromEntries(facts.map((f) => [f.key, f.text]));
    expect(w.previousYearHours).toBe(2);
    expect(byKey.ref).toMatch(/Lord of the Rings|Harry Potter|flight|Titanic/);
    expect(byKey.ratio).toMatch(/x more TV than films/);
    expect(byKey.share).toContain("Slow Horses");
    expect(byKey.months).toMatch(/March was .*x busier than May/);
    expect(byKey.yoy).toMatch(/more than 2025/);
    expect(byKey.longest).toContain("Heat");
    expect(facts.length).toBeLessThanOrEqual(8);
    expect(w.posters.length).toBeGreaterThan(0);
    expect(wrappedFacts(buildWrapped([], 2026))).toEqual([]);
    expect(wrappedFacts(buildWrapped([at("2026-02-01T20:00:00Z", { runtimeMinutes: 20 })], 2026)).some((f) => f.key === "ref")).toBe(false); // too little to compare
  });
});

describe("ratings and mark as watched", () => {
  const list = async (a: any) => ((await (await app.request("/api/history/list", { headers: { cookie: a.cookie } }, env)).json()) as any).items;
  test("a rating is saved per member, shown in the list, changed, and cleared with 0", async () => {
    played = [film(1, 1)];
    const a = await login();
    const put = (stars: unknown, who = a) => app.request(`/api/history/${ID(1)}/rating`, { method: "PUT", headers: { ...who, "content-type": "application/json" }, body: JSON.stringify({ stars }) }, env);
    expect((await put(4)).status).toBe(200);
    expect((await list(a))[0].rating).toBe(4);
    await put(2);
    expect((await list(a))[0].rating).toBe(2);
    expect((await list(await login("ben")))[0].rating).toBeNull(); // someone else's view has no rating
    await put(0);
    expect((await list(a))[0].rating).toBeNull();
  });
  test("bad stars, bad ids and a missing CSRF token are refused", async () => {
    const a = await login();
    const send = (id: string, stars: unknown, h: any = a) => app.request(`/api/history/${id}/rating`, { method: "PUT", headers: { ...h, "content-type": "application/json" }, body: JSON.stringify({ stars }) }, env);
    expect((await send(ID(1), 6)).status).toBe(400);
    expect((await send(ID(1), 2.5)).status).toBe(400);
    expect((await send("nope", 3)).status).toBe(400);
    expect((await send(ID(1), 3, { cookie: a.cookie })).status).toBe(403);
  });
  test("marking watched sets Jellyfin's watched state and clears the resume point; the body is validated", async () => {
    const a = await login();
    const post = (body: unknown) => app.request(`/api/history/${ID(1)}/watched`, { method: "POST", headers: { ...a, "content-type": "application/json" }, body: JSON.stringify(body) }, env);
    expect((await post({ played: "yes" })).status).toBe(400);
    expect((await post({ played: true })).status).toBe(200);
    expect(setPlayed).toEqual([["u1", ID(1), true]]);
    expect(cleared).toEqual([["u1", ID(1)]]);
  });
});
