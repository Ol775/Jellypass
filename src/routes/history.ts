import { Hono } from "hono";
import { requireSession, type AppEnv } from "../auth";
import { all, first, run } from "../db";
import { getHistory, historyPage, historyRange, historyStats, RANGES, type Range } from "../history";
import { getMember } from "../members";
import { buildWrapped, wrappedFacts, wrappedYears } from "../wrapped";

export const historyRoutes = new Hono<AppEnv>();
historyRoutes.use("/api/history/*", requireSession);
historyRoutes.use("/api/history", requireSession);
historyRoutes.use("/api/wrapped", requireSession);
const hiddenOf = (json: string | undefined): string[] => { try { return JSON.parse(json ?? "[]"); } catch { return []; } };

historyRoutes.get("/api/history", async (c) => {
  const s = c.get("session");
  const k = c.req.query("kind");
  const m = await getMember(c.env.DB, s.jellyfinId);
  const asked = parseInt(c.req.query("limit") ?? "", 10), limit = asked >= 1 ? Math.min(asked, 200) : 200, offset = Math.max(parseInt(c.req.query("offset") ?? "", 10) || 0, 0);
  try { return c.json((await getHistory(c.var.jf, c.env, s.jellyfinId, new Set(hiddenOf(m?.hidden_history_json)), k === "film" || k === "tv" ? k : undefined)).slice(offset, offset + limit)); }
  catch { return c.json({ error: "could not load your history right now" }, 502); }
});

historyRoutes.get("/api/history/stats", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const s = c.get("session"), m = await getMember(c.env.DB, s.jellyfinId);
  try { return c.json(historyStats(await getHistory(c.var.jf, c.env, s.jellyfinId, new Set(hiddenOf(m?.hidden_history_json))))); }
  catch { return c.json({ error: "could not load your history right now" }, 502); }
});

const rangeOf = (v: string | undefined): Range | undefined => (RANGES as string[]).includes(v ?? "") ? (v as Range) : undefined;
/** Watch time and a chart for the last week, 30 days, 90 days or 12 months. */
historyRoutes.get("/api/history/summary", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const s = c.get("session"), m = await getMember(c.env.DB, s.jellyfinId);
  try { return c.json(historyRange(await getHistory(c.var.jf, c.env, s.jellyfinId, new Set(hiddenOf(m?.hidden_history_json))), rangeOf(c.req.query("range")) ?? "month")); }
  catch { return c.json({ error: "could not load your history right now" }, 502); }
});
/** Paged list so the page never has to load everything: ?kind=film|tv&range=week|month|90d|year (omit for all time)&page=1&size=20. */
historyRoutes.get("/api/history/list", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const s = c.get("session"), m = await getMember(c.env.DB, s.jellyfinId), k = c.req.query("kind");
  try {
    const rows = await getHistory(c.var.jf, c.env, s.jellyfinId, new Set(hiddenOf(m?.hidden_history_json)), k === "film" || k === "tv" ? k : undefined);
    const page = historyPage(rows, { range: rangeOf(c.req.query("range")), page: parseInt(c.req.query("page") ?? "", 10) || 1, size: parseInt(c.req.query("size") ?? "", 10) || 20 });
    const stars = new Map((await all<{ item_id: string; stars: number }>(c.env.DB, "SELECT item_id, stars FROM ratings WHERE jellyfin_id = ?", s.jellyfinId)).map((r) => [r.item_id, r.stars]));
    return c.json({ ...page, items: page.items.map((r) => ({ ...r, rating: stars.get(r.id) ?? null })) });
  } catch { return c.json({ error: "could not load your history right now" }, 502); }
});

/** A calendar-year review ("Wrapped"). ?year=2026 (defaults to this year); `years` lists years that have any history. */
historyRoutes.get("/api/wrapped", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const s = c.get("session"), m = await getMember(c.env.DB, s.jellyfinId), thisYear = new Date().getUTCFullYear();
  const asked = parseInt(c.req.query("year") ?? "", 10), year = asked >= 2000 && asked <= thisYear ? asked : thisYear;
  try {
    const rows = await getHistory(c.var.jf, c.env, s.jellyfinId, new Set(hiddenOf(m?.hidden_history_json)));
    const w = buildWrapped(rows, year);
    return c.json({ ...w, facts: wrappedFacts(w), years: wrappedYears(rows), name: s.username });
  } catch { return c.json({ error: "could not load your history right now" }, 502); }
});

historyRoutes.post("/api/history/clear", async (c) => {
  const s = c.get("session"), m = await getMember(c.env.DB, s.jellyfinId);
  let rows;
  try { rows = await getHistory(c.var.jf, c.env, s.jellyfinId, new Set(hiddenOf(m?.hidden_history_json))); }
  catch { return c.json({ error: "could not load your history right now" }, 502); }
  const hidden = [...new Set([...hiddenOf(m?.hidden_history_json), ...rows.map(r => r.id)])].slice(-500);
  await run(c.env.DB, "UPDATE members SET hidden_history_json = ? WHERE jellyfin_id = ?", JSON.stringify(hidden), s.jellyfinId);
  await Promise.all(rows.filter(r => r.resumePct != null && r.resumePct < 100).map(r => c.var.jf.clearResume(s.jellyfinId, r.id).catch(() => {})));
  return c.json({ ok: true, cleared: rows.length });
});

/** Hides the title in Jellypass and clears the resume point. It does not touch Jellyfin's watched state. */
historyRoutes.post("/api/history/:itemId/remove", async (c) => {
  const id = c.req.param("itemId");
  if (!/^[0-9a-f]{32}$/i.test(id)) return c.json({ error: "bad item id" }, 400);
  const s = c.get("session");
  const m = await getMember(c.env.DB, s.jellyfinId);
  const hidden = [...new Set([...hiddenOf(m?.hidden_history_json), id])].slice(-500);
  await run(c.env.DB, "UPDATE members SET hidden_history_json = ? WHERE jellyfin_id = ?", JSON.stringify(hidden), s.jellyfinId);
  await c.var.jf.clearResume(s.jellyfinId, id).catch(() => {});
  return c.json({ ok: true });
});

const ITEM = /^[0-9a-f]{32}$/i;
/** Your own 1-5 star rating for a title; stars 0 clears it. Kept in Jellypass, never sent to Jellyfin. */
historyRoutes.put("/api/history/:itemId/rating", async (c) => {
  const id = c.req.param("itemId"), stars = Number((await c.req.json().catch(() => ({}))).stars);
  if (!ITEM.test(id)) return c.json({ error: "bad item id" }, 400);
  if (!Number.isInteger(stars) || stars < 0 || stars > 5) return c.json({ error: "stars must be 0 to 5" }, 400);
  const s = c.get("session");
  if (stars === 0) await run(c.env.DB, "DELETE FROM ratings WHERE jellyfin_id = ? AND item_id = ?", s.jellyfinId, id);
  else {
    if (((await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM ratings WHERE jellyfin_id = ?", s.jellyfinId))?.n ?? 0) >= 2000) return c.json({ error: "too many ratings" }, 400);
    await run(c.env.DB, "INSERT INTO ratings (jellyfin_id, item_id, stars, at) VALUES (?, ?, ?, ?) ON CONFLICT(jellyfin_id, item_id) DO UPDATE SET stars = excluded.stars, at = excluded.at", s.jellyfinId, id, stars, new Date().toISOString());
  }
  return c.json({ ok: true, stars: stars || null });
});

/** Marks a title watched (resume point cleared) or unwatched in Jellyfin: body { played: boolean }. */
historyRoutes.post("/api/history/:itemId/watched", async (c) => {
  const id = c.req.param("itemId"), b = await c.req.json().catch(() => ({}));
  if (!ITEM.test(id)) return c.json({ error: "bad item id" }, 400);
  if (typeof b.played !== "boolean") return c.json({ error: "played must be true or false" }, 400);
  const s = c.get("session");
  try { await c.var.jf.setPlayed(s.jellyfinId, id, b.played); if (b.played) await c.var.jf.clearResume(s.jellyfinId, id).catch(() => {}); }
  catch { return c.json({ error: "could not update Jellyfin right now" }, 502); }
  return c.json({ ok: true });
});
