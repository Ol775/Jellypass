import { Hono } from "hono";
import { requireSession, type AppEnv } from "../auth";
import { all, first } from "../db";
import { heightLabel } from "../jellyfin";

export const homeRoutes = new Hono<AppEnv>();

/** "Recently added this week" for the Home page: films and series created in the last 7 days. */
homeRoutes.get("/api/home", requireSession, async (c) => {
  const week = Date.now() - 7 * 86400_000;
  let recentlyAdded: number | null = null;
  let titles: Array<{ id: string; title: string; kind: "film" | "tv"; subtitle: string; posterUrl: string | null }> = [];
  const base = c.env.JELLYFIN_URL.replace(/\/$/, "");
  try {
    const items = await c.var.jf.userItems(c.get("session").jellyfinId, { includeItemTypes: "Movie,Series", recursive: "true", sortBy: "DateCreated", sortOrder: "Descending", limit: "300", fields: "DateCreated,ProductionYear,PrimaryImageAspectRatio" });
    const fresh = items.filter((i) => Date.parse(i.DateCreated) >= week);
    recentlyAdded = fresh.length;
    // Posters load from the member's own Jellyfin (same as Watch history), never a third party.
    titles = fresh.slice(0, 12).map((i) => ({ id: i.Id, title: i.Name, kind: i.Type === "Series" ? "tv" : "film", subtitle: `${i.Type === "Series" ? "TV show" : "Film"}${i.ProductionYear ? ` · ${i.ProductionYear}` : ""}`,
      posterUrl: i.ImageTags?.Primary ? `${base}/Items/${i.Id}/Images/Primary?maxHeight=300&tag=${encodeURIComponent(i.ImageTags.Primary)}` : null }));
  } catch { /* Home still works without the count */ }
  return c.json({ recentlyAdded, items: titles }, 200, { "cache-control": "private, max-age=300" });
});

/** "Up next": the next episode for each show the member has started. Posters come from their own Jellyfin, like Recently added. */
homeRoutes.get("/api/home/up-next", requireSession, async (c) => {
  const base = c.env.JELLYFIN_URL.replace(/\/$/, "");
  try {
    const items = await c.var.jf.nextUp(c.get("session").jellyfinId);
    return c.json(items.filter((i) => i.Type === "Episode").slice(0, 12).map((i) => {
      const art = i.SeriesPrimaryImageTag && i.SeriesId ? { id: i.SeriesId, tag: i.SeriesPrimaryImageTag } : i.ImageTags?.Primary ? { id: i.Id, tag: i.ImageTags.Primary } : null;
      return { id: i.Id, title: i.SeriesName ?? i.Name, subtitle: `S${i.ParentIndexNumber ?? "?"}E${i.IndexNumber ?? "?"} · ${i.Name}`, kind: "tv", posterUrl: art ? `${base}/Items/${art.id}/Images/Primary?maxHeight=300&tag=${encodeURIComponent(art.tag)}` : null };
    }), 200, { "cache-control": "private, max-age=120" });
  } catch { return c.json([], 200); }
});

/** Home banner for members who switched it on: sign-ins from somewhere new in the last week. Place and device only, never an IP. */
homeRoutes.get("/api/home/alerts", requireSession, async (c) => {
  const id = c.get("session").jellyfinId;
  if ((await first<{ alerts_banner: number }>(c.env.DB, "SELECT alerts_banner FROM members WHERE jellyfin_id = ?", id))?.alerts_banner !== 1) return c.json([]);
  const rows = await all<{ id: number; device: string | null; city: string | null; seen_at: string }>(c.env.DB, "SELECT id, device, city, seen_at FROM signins WHERE jellyfin_id = ? AND unusual = 1 AND seen_at > ? ORDER BY seen_at DESC LIMIT 3", id, new Date(Date.now() - 7 * 86400_000).toISOString());
  return c.json(rows.map((r) => ({ id: r.id, device: r.device, city: r.city, seenAt: r.seen_at })));
});

/** "Surprise me": one random film or show (?kind=film|tv) this member has not watched, from their own library. Poster comes from their own Jellyfin. */
homeRoutes.get("/api/home/surprise", requireSession, async (c) => {
  const base = c.env.JELLYFIN_URL.replace(/\/$/, "");
  try {
    const i = (await c.var.jf.userItems(c.get("session").jellyfinId, { includeItemTypes: c.req.query("kind") === "tv" ? "Series" : "Movie", recursive: "true", filters: "IsUnplayed", sortBy: "Random", limit: "1", fields: "Overview,Genres,OfficialRating,PrimaryImageAspectRatio" }))[0];
    if (!i) return c.json(null);
    return c.json({ id: i.Id, title: i.Name, year: i.ProductionYear ? String(i.ProductionYear) : "", rating: i.OfficialRating ?? "", genres: Array.isArray(i.Genres) ? i.Genres.filter((g: unknown) => typeof g === "string").slice(0, 3) : [],
      overview: String(i.Overview ?? "").slice(0, 240), posterUrl: i.ImageTags?.Primary ? `${base}/Items/${i.Id}/Images/Primary?maxHeight=300&tag=${encodeURIComponent(i.ImageTags.Primary)}` : null });
  } catch { return c.json(null); }
});

const BBFC = /^(U|PG|12A|12|15|18|R18)$/;
/** UK age rating and real picture quality for posters the page already shows: ?ids=<up to 30 Jellyfin item ids>. Ids are looked up as the signed-in member, so nobody can probe items they cannot see. */
homeRoutes.get("/api/badges", requireSession, async (c) => {
  const ids = [...new Set((c.req.query("ids") ?? "").split(",").filter((x) => /^[0-9a-f]{32}$/i.test(x)))].slice(0, 30);
  if (!ids.length) return c.json({});
  const uid = c.get("session").jellyfinId, out: Record<string, { rating: string; quality: string | null }> = {};
  try {
    const items = await c.var.jf.userItems(uid, { ids: ids.join(","), fields: "ProviderIds,MediaStreams,OfficialRating,SeriesId" });
    // Episodes carry their own picture quality but the show's TMDB id and age rating.
    const seriesIds = [...new Set(items.filter((i) => i.Type === "Episode" && i.SeriesId).map((i) => String(i.SeriesId)))];
    const series = new Map((seriesIds.length ? await c.var.jf.userItems(uid, { ids: seriesIds.join(","), fields: "ProviderIds,OfficialRating" }) : []).map((s) => [String(s.Id), s]));
    await Promise.all(items.map(async (i) => {
      const parent = i.Type === "Episode" ? series.get(String(i.SeriesId)) : i;
      const kind = i.Type === "Movie" ? "movie" : "tv", tmdb = Number(parent?.ProviderIds?.Tmdb) || 0;
      const v = (i.MediaStreams ?? []).find((x: any) => x.Type === "Video");
      let quality: string | null = v?.Height ? heightLabel(Number(v.Width) || 0, Number(v.Height)) : null;
      if (!quality && tmdb) quality = await c.var.jf.libraryQuality(kind, tmdb).catch(() => null);
      let rating = tmdb ? ((await c.var.seerr.summary(kind, tmdb).catch(() => null))?.rating ?? "") : "";
      if (!rating && BBFC.test(String(parent?.OfficialRating ?? ""))) rating = String(parent.OfficialRating);
      out[String(i.Id)] = { rating, quality };
    }));
  } catch { /* posters simply show without badges */ }
  return c.json(out, 200, { "cache-control": "private, max-age=3600" });
});
