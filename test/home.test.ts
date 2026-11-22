import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { run } from "../src/db";

const day = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();
let items: any[], asked: Array<Record<string, string>>;
const app = createApp({
  jellyfin: (() => ({
    authenticate: async () => ({ id: "u1", name: "maya", isAdmin: false }),
    getUser: async () => ({ id: "u1", name: "maya", isAdmin: false, isDisabled: false }),
    userItems: async (_u: string, q: Record<string, string>) => { asked.push(q); return items; },
    nextUp: async () => [{ Id: "e1", Type: "Episode", Name: "Reptile Dysfunction", SeriesName: "Slow Horses", SeriesId: "s1", SeriesPrimaryImageTag: "t", ParentIndexNumber: 2, IndexNumber: 3 }, { Id: "m1", Type: "Movie", Name: "Not an episode" }],
  })) as never,
});
async function login() {
  const r = await app.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "maya", password: "x" }) }, env);
  return { cookie: r.headers.get("set-cookie")!.split(";")[0] };
}
beforeEach(async () => { items = []; asked = []; for (const t of ["members", "sessions", "rate_limits", "signins"]) await run(env.DB, `DELETE FROM ${t}`); });

describe("home summary", () => {
  test("counts films and series added in the last 7 days", async () => {
    items = [{ DateCreated: day(1) }, { DateCreated: day(6.5) }, { DateCreated: day(8) }, { DateCreated: day(30) }];
    const a = await login();
    const res = await app.request("/api/home", { headers: { cookie: a.cookie } }, env);
    expect(await res.json()).toMatchObject({ recentlyAdded: 2 });
    expect(asked[0]).toMatchObject({ includeItemTypes: "Movie,Series", sortBy: "DateCreated", sortOrder: "Descending" });
    expect(res.headers.get("cache-control")).toMatch(/private/);
  });
  test("lists this week's titles (newest first, max 12) with posters served from the member's Jellyfin", async () => {
    items = Array.from({ length: 14 }, (_, i) => ({ Id: `i${i}`, Name: `Title ${i}`, Type: i % 2 ? "Series" : "Movie", ProductionYear: 2024, DateCreated: day(1), ImageTags: i === 0 ? {} : { Primary: `tag${i}` } }));
    items.push({ Id: "old", Name: "Old", Type: "Movie", DateCreated: day(20), ImageTags: { Primary: "x" } });
    const a = await login();
    const j: any = await (await app.request("/api/home", { headers: { cookie: a.cookie } }, env)).json();
    expect(j.recentlyAdded).toBe(14);
    expect(j.items).toHaveLength(12);
    expect(j.items[1]).toEqual({ id: "i1", title: "Title 1", kind: "tv", subtitle: "TV show · 2024", posterUrl: "https://jf.test/Items/i1/Images/Primary?maxHeight=300&tag=tag1" });
    expect(j.items[0]).toMatchObject({ id: "i0", kind: "film", subtitle: "Film · 2024", posterUrl: null });
    expect(asked[0].fields).toContain("ProductionYear");
  });
  test("an unreachable Jellyfin gives a null count, not an error page", async () => {
    const bad = createApp({ jellyfin: (() => ({ authenticate: async () => ({ id: "u1", name: "maya", isAdmin: false }), getUser: async () => ({ id: "u1", name: "maya", isAdmin: false, isDisabled: false }), userItems: async () => { throw new Error("down"); } })) as never });
    const r = await bad.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "maya", password: "x" }) }, env);
    const res = await bad.request("/api/home", { headers: { cookie: r.headers.get("set-cookie")!.split(";")[0] } }, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ recentlyAdded: null, items: [] });
  });
  test("it needs a session", async () => { expect((await app.request("/api/home", {}, env)).status).toBe(401); });
});

describe("home page matches the mockup", () => {
  test("it has the header action, the pick-up shelf, requests and devices cards and the recently-added line, and not the old status/shortcuts cards", async () => {
    const a = await login();
    await run(env.DB, "UPDATE members SET onboarding_state = '{\"done\":true}' WHERE jellyfin_id = 'u1'");
    const res = await app.request("/", { headers: { cookie: a.cookie } }, env);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain("Welcome back, maya");
    expect(html).toContain("Open Jellyfin");
    expect(html).toContain("Pick up where you left off");
    expect(html).toContain('id="shelf"');
    expect(html).toContain("Your requests");
    expect(html).toContain("via Seerr");
    expect(html).toContain("Surprise me");
    expect(html).toContain('id="recent-line"');
    expect(html).toContain('id="status-line"');
    expect(html.indexOf('id="status-line"')).toBeGreaterThan(html.indexOf('id="recent-line"'));
    expect(html.indexOf('id="announcements"')).toBeLessThan(html.indexOf('id="shelf"'));
    expect(html).not.toContain("Shortcuts");
    expect(html).not.toContain("View service status");
  });
});

test('home shares the mockup navigation sprite and page header spacing',async()=>{
 const a=await login();await run(env.DB,"UPDATE members SET onboarding_state = '{\"done\":true}' WHERE jellyfin_id = 'u1'");
 const body=await(await app.request('/',{headers:{cookie:a.cookie}},env)).text();
 expect(body).toContain('<symbol id="home"');expect(body).toContain('<div class="page-content"><div class="top">');expect(body).toContain('data-nav-count="devices"');
});

describe("home extras", () => {
  test("up next lists episodes only, with the series poster from the member's own Jellyfin", async () => {
    const a = await login();
    const rows = (await (await app.request("/api/home/up-next", { headers: { cookie: a.cookie } }, env)).json()) as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "e1", title: "Slow Horses", subtitle: "S2E3 · Reptile Dysfunction" });
    expect(rows[0].posterUrl).toContain("/Items/s1/Images/Primary");
    expect((await app.request("/api/home/up-next", {}, env)).status).toBe(401);
  });
  test("the Home page has every extra section and Help offers the extend-access subject", async () => {
    const a = await login();
    await run(env.DB, `UPDATE members SET onboarding_state = '{"done":true}'`);
    const body = await (await app.request("/", { headers: { cookie: a.cookie } }, env)).text();
    for (const id of ["home-account", "upnext-line", "recent-line", "popular-line", "week-card", "qc-card", "home-quickconnect"]) expect(body).toContain(`id="${id}"`);
    expect(await (await app.request("/help", { headers: { cookie: a.cookie } }, env)).text()).toContain("<option>Extend my access</option>");
  });
});

describe("home alerts banner", () => {
  test("shows recent unusual sign-ins (place and device, no IP) only to members who switched it on", async () => {
    const a = await login();
    const get = (h: { cookie: string }, path: string) => app.request(path, { headers: h }, env);
    await run(env.DB, "INSERT INTO signins (source, jellyfin_id, device, ip, city, seen_at, unusual) VALUES ('activity','u1','Safari','8.8.8.8','Paris',?,1),('activity','u1','Old','7.7.7.7','Rome',?,1),('activity','u1','Fine','1.1.1.1','Leeds',?,0)", new Date().toISOString(), "2020-01-01T00:00:00Z", new Date().toISOString());
    expect(await (await get(a, "/api/home/alerts")).json()).toEqual([]);
    await run(env.DB, "UPDATE members SET alerts_banner = 1 WHERE jellyfin_id = 'u1'");
    const rows: any[] = await (await get(a, "/api/home/alerts")).json();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ device: "Safari", city: "Paris" });
    expect(JSON.stringify(rows)).not.toContain("8.8.8.8");
  });
});

describe("surprise me", () => {
  test("asks Jellyfin for one random unwatched film and returns title, place-holder-free poster URL, no extras; null when nothing is left", async () => {
    items = [{ Id: "m1", Name: "Heat", ProductionYear: 1995, OfficialRating: "15", Genres: ["Crime", "Thriller", "Drama", "X"], Overview: "A thief.", ImageTags: { Primary: "t" } }];
    const a = await login();
    const body: any = await (await app.request("/api/home/surprise", { headers: a }, env)).json();
    expect(asked[0]).toMatchObject({ includeItemTypes: "Movie", filters: "IsUnplayed", sortBy: "Random", limit: "1" });
    expect(body).toMatchObject({ id: "m1", title: "Heat", year: "1995", rating: "15", genres: ["Crime", "Thriller", "Drama"] });
    expect(body.posterUrl).toContain("/Items/m1/Images/Primary");
    await app.request("/api/home/surprise?kind=tv", { headers: a }, env);
    expect(asked[1]).toMatchObject({ includeItemTypes: "Series", filters: "IsUnplayed" });
    items = [];
    expect(await (await app.request("/api/home/surprise", { headers: a }, env)).json()).toBeNull();
  });
});
