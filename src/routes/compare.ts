import { Hono } from "hono";
import { rateReserve, requireSession, type AppEnv } from "../auth";
import { all, first, run } from "../db";
import { audit } from "../audit";
import { compareHistories, personStats, sharedByAll } from "../compare";
import { demoOthers, demoPeople, demoPoster, demoRows, demoSeed, isDemo } from "../compare-demo";
import { getHistory } from "../history";
import { jellyfinForMembers } from "../addresses";

export const compareRoutes = new Hono<AppEnv>();
compareRoutes.use("/api/compare", requireSession);
compareRoutes.use("/api/compare/*", requireSession);
const hidden = (json: string | undefined): Set<string> => { try { return new Set(JSON.parse(json ?? "[]")); } catch { return new Set(); } };
const optedIn = async (db: D1Database, id: string) => (await first<{ compare_on: number }>(db, "SELECT compare_on FROM members WHERE jellyfin_id = ?", id))?.compare_on === 1;

compareRoutes.get("/api/compare", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const s = c.get("session");
  const enabled = await optedIn(c.env.DB, s.jellyfinId);
  if (!enabled) return c.json({ enabled: false, people: [] });
  const people = await all<{ jellyfin_id: string; username: string }>(c.env.DB, "SELECT jellyfin_id, username FROM members WHERE compare_on = 1 AND jellyfin_id != ? ORDER BY username COLLATE NOCASE", s.jellyfinId);
  return c.json({ enabled: true, people: [...people.map((p) => ({ id: p.jellyfin_id, name: p.username })), ...(isDemo(c.env) ? demoPeople : [])] });
});

compareRoutes.put("/api/compare/optin", async (c) => {
  const s = c.get("session"), b = await c.req.json().catch(() => ({}));
  if (typeof b.on !== "boolean") return c.json({ error: "on must be true or false" }, 400);
  await run(c.env.DB, "UPDATE members SET compare_on = ? WHERE jellyfin_id = ?", b.on ? 1 : 0, s.jellyfinId);
  await audit(c.env.DB, s.username, b.on ? "compare.on" : "compare.off", s.jellyfinId);
  return c.json({ ok: true, enabled: b.on });
});

/** Who is watching right now. Part of the same opt-in: only members who have turned comparing on appear, and only to members who have too. Name and title only. */
compareRoutes.get("/api/compare/now", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const s = c.get("session");
  if (!(await optedIn(c.env.DB, s.jellyfinId))) return c.json({ error: "turn on history comparing in Settings first" }, 403);
  if (!(await rateReserve(c.env.DB, `compare-now:${s.jellyfinId}`, 120, 900))) return c.json({ error: "too many checks, try again later" }, 429);
  const people = await all<{ jellyfin_id: string; username: string }>(c.env.DB, "SELECT jellyfin_id, username FROM members WHERE compare_on = 1 AND jellyfin_id != ?", s.jellyfinId);
  const byId = new Map(people.map((p) => [p.jellyfin_id.replace(/-/g, "").toLowerCase(), p]));
  try {
    const seen = new Set<string>();
    const playing = await c.var.jf.nowPlaying();
    // The member's own stream comes first, with its start and end time only: no address, ISP or device.
    const mine = playing.find((x) => x.userId === s.jellyfinId.replace(/-/g, "").toLowerCase());
    const own: object[] = [];
    if (mine) {
      let startedAt: string | null = null;
      try { startedAt = (await c.var.tracearr.liveStreams()).find((t) => t.username.toLowerCase() === s.username.toLowerCase())?.startedAt ?? null; } catch { /* the start time is a nicety; Tracearr may be down */ }
      const base = jellyfinForMembers(c.env);
      own.push({ you: true, id: s.jellyfinId.replace(/-/g, "").toLowerCase(), posterUrl: mine.posterId ? `${base}/Items/${encodeURIComponent(mine.posterId)}/Images/Primary?maxHeight=300` : null, url: mine.itemId ? `${base}/web/#/details?id=${encodeURIComponent(mine.itemId)}` : null, name: s.username, title: mine.title, subtitle: mine.subtitle, episodeName: mine.episodeName, year: mine.year, rating: mine.rating, genres: mine.genres, runtimeMinutes: mine.runtimeMinutes, progressPct: mine.progressPct, paused: mine.paused, startedAt, endsAt: mine.remainingSeconds == null ? null : new Date(Date.now() + mine.remainingSeconds * 1000).toISOString() });
    }
    const demo = isDemo(c.env); // beta review aid, see DEMO_COMPARE in env.ts
    if (demo && !mine) own.push(demoOwnStream(s.jellyfinId, s.username, jellyfinForMembers(c.env)));
    return c.json([...own, ...(demo ? demoOthers : []), ...playing.flatMap((x) => {
      const p = byId.get(x.userId);
      if (!p || seen.has(x.userId)) return [];
      seen.add(x.userId);
      return [{ id: p.jellyfin_id, name: p.username, title: x.title, subtitle: x.subtitle, paused: x.paused, posterUrl: x.posterId ? `${jellyfinForMembers(c.env)}/Items/${encodeURIComponent(x.posterId)}/Images/Primary?maxHeight=300` : null }];
    })]);
  } catch { return c.json({ error: "could not check who is watching right now" }, 502); }
});

/** Compare with up to 4 members at once: stats side by side, plus the titles everyone has watched. Everyone must have opted in; anyone who has not is "not found". Only aggregates and shared titles are returned. */
compareRoutes.get("/api/compare/group", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const s = c.get("session"), me = s.jellyfinId.replace(/-/g, "").toLowerCase();
  const ids = [...new Set((c.req.query("ids") ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean))];
  if (!ids.length || ids.length > 4 || ids.some((id) => !/^[0-9a-f]{32}$/.test(id) || id === me)) return c.json({ error: "choose between 1 and 4 other members" }, 400);
  if (!(await optedIn(c.env.DB, s.jellyfinId))) return c.json({ error: "turn on history comparing in Settings first" }, 403);
  const demo = isDemo(c.env), demoIds = new Set(demoPeople.map((p) => p.id));
  const realIds = ids.filter((id) => !(demo && demoIds.has(id)));
  const others = realIds.length ? await all<{ jellyfin_id: string; username: string; compare_on: number; hidden_history_json: string }>(c.env.DB, `SELECT jellyfin_id, username, compare_on, hidden_history_json FROM members WHERE compare_on = 1 AND lower(replace(jellyfin_id, '-', '')) IN (${realIds.map(() => "?").join(",")})`, ...realIds) : [];
  if (others.length !== realIds.length) return c.json({ error: "not found" }, 404);
  if (!(await rateReserve(c.env.DB, `compare:${s.jellyfinId}`, 30, 900))) return c.json({ error: "too many comparisons, try again later" }, 429);
  const mineRow = await first<{ hidden_history_json: string }>(c.env.DB, "SELECT hidden_history_json FROM members WHERE jellyfin_id = ?", s.jellyfinId);
  try {
    const rowsOf = (id: string, name: string, hiddenJson?: string) => demo && demoIds.has(id) ? Promise.resolve(demoRows(demoSeed(id))) : getHistory(c.var.jf, c.env, id, hidden(hiddenJson));
    const people = await Promise.all([
      getHistory(c.var.jf, c.env, s.jellyfinId, hidden(mineRow?.hidden_history_json)).then((rows) => ({ id: me, name: s.username, you: true, rows: demo && rows.length < 5 ? demoRows(1) : rows })),
      ...ids.map(async (id) => { const o = others.find((x) => x.jellyfin_id.replace(/-/g, "").toLowerCase() === id); const name = o?.username ?? demoPeople.find((p) => p.id === id)!.name; return { id, name, you: false, rows: await rowsOf(id, name, o?.hidden_history_json) }; }),
    ]);
    const shared = sharedByAll(people.map((p) => p.rows));
    return c.json({
      people: people.map((p) => ({ id: p.id, name: p.name, you: p.you, stats: personStats(p.rows) })),
      matches: people.slice(1).map((p) => ({ id: p.id, name: p.name, ...(({ matchPct, shared }) => ({ matchPct, shared: shared.length }))(compareHistories(people[0].rows, p.rows)) })),
      shared: withLinks(shared, jellyfinForMembers(c.env)),
    });
  } catch { return c.json({ error: "could not load the comparison right now" }, 502); }
});

/** Both members must have opted in. A member who has not is reported as "not found" so nothing is revealed about them. */
compareRoutes.get("/api/compare/:id", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const s = c.get("session"), id = c.req.param("id");
  if (!/^[0-9a-f]{32}$/i.test(id) || id.toLowerCase() === s.jellyfinId.toLowerCase()) return c.json({ error: "not found" }, 404);
  if (!(await optedIn(c.env.DB, s.jellyfinId))) return c.json({ error: "turn on history comparing in Settings first" }, 403);
  const other = await first<{ username: string; compare_on: number; hidden_history_json: string }>(c.env.DB, "SELECT username, compare_on, hidden_history_json FROM members WHERE jellyfin_id = ?", id);
  if (!other || other.compare_on !== 1) return c.json({ error: "not found" }, 404);
  if (!(await rateReserve(c.env.DB, `compare:${s.jellyfinId}`, 30, 900))) return c.json({ error: "too many comparisons, try again later" }, 429);
  const mine = await first<{ hidden_history_json: string }>(c.env.DB, "SELECT hidden_history_json FROM members WHERE jellyfin_id = ?", s.jellyfinId);
  try {
    const [a, b] = await Promise.all([getHistory(c.var.jf, c.env, s.jellyfinId, hidden(mine?.hidden_history_json)), getHistory(c.var.jf, c.env, id, hidden(other.hidden_history_json))]);
    const r = compareHistories(a, b);
    return c.json({ name: other.username, ...r, shared: withLinks(r.shared, jellyfinForMembers(c.env)) });
  } catch { return c.json({ error: "could not load the comparison right now" }, 502); }
});

// ---------- beta demo rows (DEMO_COMPARE=1, beta only; data in compare-demo.ts) ----------
function demoOwnStream(id: string, name: string, jellyfinUrl: string) {
  const now = Date.now();
  return { you: true, id: id.replace(/-/g, "").toLowerCase(), posterUrl: demoPoster("Demo Detectives", 190), url: jellyfinUrl.replace(/\/$/, "") + "/web/", name, title: "Demo Detectives", subtitle: "S1E3", episodeName: "The Long Weekend", year: 2024, rating: "TV-14", genres: ["Crime", "Drama"], runtimeMinutes: 58, progressPct: 35, paused: false, startedAt: new Date(now - 20 * 60000).toISOString(), endsAt: new Date(now + 38 * 60000).toISOString() };
}

/** Adds the Jellyfin page URL ("Open in Jellyfin") and drops the raw id. */
function withLinks<T extends { linkId?: string }>(items: T[], jellyfinUrl: string) {
  const base = jellyfinUrl.replace(/\/$/, "");
  return items.map(({ linkId, ...rest }) => ({ ...rest, url: linkId ? (linkId === "demo" ? `${base}/web/` : `${base}/web/#/details?id=${encodeURIComponent(linkId)}`) : null }));
}
