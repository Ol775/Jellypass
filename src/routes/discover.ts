import { Hono } from "hono";
import type { Context } from "hono";
import { requireSession, type AppEnv } from "../auth";
import { run } from "../db";
import { getMember } from "../members";
import { getPreset } from "../presets";

class BetaSeerrError extends Error {}
export const discoverRoutes = new Hono<AppEnv>();
discoverRoutes.use("/api/discover/*", requireSession);

/** The Seerr user for the signed-in member: stored id, else found in Seerr, else imported. Never taken from the request. */
async function seerrUserFor(c: Context<AppEnv>): Promise<number> {
  const s = c.get("session");
  // Seerr is shared with production and the beta guard only covers Jellyfin, so in beta a real (non beta-) member may use an
  // account Seerr already has, but beta never CREATES or changes Seerr users for them.
  const betaOnly = c.env.ENVIRONMENT === "beta" && !s.username.startsWith("beta-");
  const m = await getMember(c.env.DB, s.jellyfinId);
  if (m?.seerr_user_id) return m.seerr_user_id;
  const found = await c.var.seerr.findUserByJellyfinId(s.jellyfinId);
  if (found !== null) {
    // An account Seerr already has may be an admin or hold rights set inside Seerr: remember it, never change it.
    await run(c.env.DB, "UPDATE members SET seerr_user_id = ? WHERE jellyfin_id = ?", found, s.jellyfinId);
    return found;
  }
  if (betaOnly) throw new BetaSeerrError("in beta, Discover only works for accounts Seerr already knows, or beta- test accounts");
  // We are creating it: Seerr's default rights may be wider than this member's access level, so set them from the preset
  // (none if there is no preset) before the id is stored or used. Fail closed.
  const preset = m?.preset_id ? await getPreset(c.env.DB, m.preset_id) : null;
  const id = await c.var.seerr.importUser(s.jellyfinId);
  try { await c.var.seerr.setPermissions(id, preset?.requestRights ?? "none"); }
  catch (e) { await c.var.seerr.deleteUser(id).catch(() => {}); throw e; }
  await run(c.env.DB, "UPDATE members SET seerr_user_id = ? WHERE jellyfin_id = ?", id, s.jellyfinId);
  return id;
}

const mediaStatus = (st?: number) => (st === 5 ? "available" : st === 4 ? "partial" : st === 2 || st === 3 ? "requested" : "none");
const REQUEST_STATUS: Record<number, string> = { 1: "pending", 2: "approved", 3: "declined" };
const POSTER_PATH = /^\/[A-Za-z0-9_-]{1,60}\.(jpg|png)$/;

const shape = (r: any) => ({
  id: r.id, mediaType: r.mediaType, title: r.title ?? r.name, year: String(r.releaseDate ?? r.firstAirDate ?? "").slice(0, 4),
  overview: r.overview ?? "", status: mediaStatus(r.mediaInfo?.status), rating: "",
  quality: r.mediaInfo?.status4k >= 4 ? "4K" : r.mediaInfo?.status >= 4 ? "HD" : null, // what the library holds; Seerr only says standard or 4K
  posterUrl: r.posterPath ? `/api/discover/poster?path=${encodeURIComponent(r.posterPath)}` : null, // fetched by the Worker, so TMDB never sees the member's IP
});
const splitResults = (results: any[]) => ({ films: results.filter((r) => r.mediaType === "movie").map(shape), tv: results.filter((r) => r.mediaType === "tv").map(shape) });
/** Real resolution from Jellyfin when the title is in the library; any failure keeps Seerr's HD/4K. */
async function libraryItem(c: Context<AppEnv>, mediaType: string, tmdbId: number): Promise<{ id: string | null; quality: string | null }> {
  try { return mediaType === "movie" || mediaType === "tv" ? await c.var.jf.libraryItem(mediaType, tmdbId) : { id: null, quality: null }; } catch { return { id: null, quality: null }; }
}
const libraryQuality = async (c: Context<AppEnv>, mediaType: string, tmdbId: number) => (await libraryItem(c, mediaType, tmdbId)).quality;
/** Adds the BBFC certificate to each result (one cached, best-effort detail lookup each; a miss just shows no badge). */
async function withRatings(c: Context<AppEnv>, groups: ReturnType<typeof splitResults>) {
  await Promise.all([...groups.films, ...groups.tv].map(async (r) => {
    r.rating = (await c.var.seerr.summary(r.mediaType, r.id).catch(() => null))?.rating ?? "";
    if (r.status === "available" || r.status === "partial") r.quality = await libraryQuality(c, r.mediaType, r.id) ?? r.quality;
  }));
  return groups;
}

discoverRoutes.get("/api/discover/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (q.length < 2 || q.length > 100) return c.json({ error: "type at least two letters" }, 400);
  let results;
  try { results = await c.var.seerr.search(q, await seerrUserFor(c)); } catch (e) { return e instanceof BetaSeerrError ? c.json({ error: e.message }, 403) : c.json({ error: "search is unavailable right now" }, 502); }
  return c.json(await withRatings(c, splitResults(results)));
});

/** What is popular right now (Seerr's own front page), shown before the member has searched for anything. */
discoverRoutes.get("/api/discover/trending", async (c) => {
  let results;
  const asked = parseInt(c.req.query("limit") ?? "", 10);
  try { results = (await c.var.seerr.trending(await seerrUserFor(c))).slice(0, asked >= 1 ? Math.min(asked, 40) : 40); } catch (e) { return e instanceof BetaSeerrError ? c.json({ error: e.message }, 403) : c.json({ error: "trending is unavailable right now" }, 502); }
  return c.json(await withRatings(c, splitResults(results)));
});

discoverRoutes.post("/api/discover/request", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const seasonsOk = b.seasons === undefined || b.seasons === "all" || (Array.isArray(b.seasons) && b.seasons.length > 0 && b.seasons.length < 100 && b.seasons.every((n: unknown) => Number.isInteger(n) && (n as number) >= 0));
  if ((b.mediaType !== "movie" && b.mediaType !== "tv") || !Number.isInteger(b.mediaId) || b.mediaId <= 0 || !seasonsOk) return c.json({ error: "that request does not look right" }, 400);
  const m = await getMember(c.env.DB, c.get("session").jellyfinId);
  const preset = m?.preset_id ? await getPreset(c.env.DB, m.preset_id) : null;
  // Admins have no access level (it would overwrite their own rights), so they request under their own Seerr permissions, which Seerr enforces.
  // The cached session flag can be minutes stale, so confirm live; any doubt means no exemption.
  const live = await c.var.jf.getUser(c.get("session").jellyfinId).catch(() => null);
  if (!(live && live.isAdmin && !live.isDisabled)) {
    if (!preset) return c.json({ error: "an admin needs to set up your access before you can request titles" }, 403);
    if (preset.requestRights === "none") return c.json({ error: "your access does not include requesting titles" }, 403);
  }
  const body = b.mediaType === "tv" ? { mediaType: "tv" as const, mediaId: b.mediaId, ...(b.seasons !== undefined ? { seasons: b.seasons } : {}) } : { mediaType: "movie" as const, mediaId: b.mediaId };
  try { await c.var.seerr.request(body, await seerrUserFor(c)); }
  catch (e) {
    if (e instanceof BetaSeerrError) return c.json({ error: e.message }, 403);
    const st = (e as { status?: number }).status;
    if (st === 409) return c.json({ error: "that has already been requested" }, 409);
    if (st === 403) return c.json({ error: "you have reached your request limit or cannot request this" }, 403);
    return c.json({ error: "could not send the request right now" }, 502);
  }
  return c.json({ ok: true }, 201);
});

discoverRoutes.get("/api/discover/requests", async (c) => {
  try {
    const asked = parseInt(c.req.query("limit") ?? "", 10), limit = asked >= 1 ? Math.min(asked, 20) : 20;
    const rows = (await c.var.seerr.userRequests(await seerrUserFor(c))).slice(0, limit);
    const shaped = rows.map((r) => ({ id: r.id, status: REQUEST_STATUS[r.status] ?? "pending", mediaType: r.media?.mediaType, tmdbId: r.media?.tmdbId, available: r.media?.status === 5, createdAt: r.createdAt, jellyfinId: null as string | null, title: null as string | null, posterUrl: null as string | null, year: "", rating: "", quality: (r.is4k ? "4K" : "HD") as string }));
    // One best-effort lookup per returned row (at most 20), shared by title, poster and year.
    await Promise.all(shaped.map(async (r) => {
      if (r.available) { const it = await libraryItem(c, r.mediaType, r.tmdbId); r.quality = it.quality ?? r.quality; r.jellyfinId = it.id; }
      const summary = await c.var.seerr.summary(r.mediaType, r.tmdbId).catch(() => null);
      if (!summary) return;
      r.title = summary.title;
      r.year = summary.year;
      r.rating = summary.rating ?? "";
      if (summary.posterPath && POSTER_PATH.test(summary.posterPath)) r.posterUrl = `/api/discover/poster?path=${encodeURIComponent(summary.posterPath)}`;
    }));
    return c.json(shaped);
  } catch (e) { return e instanceof BetaSeerrError ? c.json({ error: e.message }, 403) : c.json({ error: "could not load your requests right now" }, 502); }
});

discoverRoutes.get("/api/discover/poster", async (c) => {
  const path = c.req.query("path") ?? "";
  if (!POSTER_PATH.test(path)) return c.json({ error: "bad path" }, 400);
  let res: Response;
  try { res = await c.var.fetch(`https://image.tmdb.org/t/p/w342${path}`); } catch { return c.json({ error: "image unavailable" }, 502); }
  if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) return c.json({ error: "not found" }, 404);
  return new Response(res.body, { headers: { "content-type": res.headers.get("content-type")!, "cache-control": "private, max-age=604800" } });
});
