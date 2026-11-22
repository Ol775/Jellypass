import type { Env } from "./env";
import type { Jellyfin } from "./jellyfin";
import { jellyfinForMembers } from "./addresses";

export interface HistoryRow { id: string; kind: "film" | "tv"; title: string; subtitle: string; posterUrl: string | null; lastPlayed: string | null; playCount: number; resumePct: number | null; runtimeMinutes: number | null; genres: string[]; /** The film's id, or the series' id for an episode: where "Open in Jellyfin" goes. */ linkId?: string }

const FIELDS = "PrimaryImageAspectRatio,SeriesPrimaryImageTag,Genres";
/** One row per title from Jellyfin's own user data (last played, resume point, play count). Not a play-by-play log. */
export async function getHistory(jf: Pick<Jellyfin, "userItems" | "resume">, env: Env, userId: string, hidden: Set<string>, kind?: "film" | "tv"): Promise<HistoryRow[]> {
  const [played, resuming] = await Promise.all([
    jf.userItems(userId, { filters: "IsPlayed", includeItemTypes: "Movie,Episode", recursive: "true", sortBy: "DatePlayed", sortOrder: "Descending", limit: "1000", fields: FIELDS }),
    jf.resume(userId),
  ]);
  const base = jellyfinForMembers(env);
  const byId = new Map<string, any>();
  for (const it of [...played, ...resuming]) {
    const prev = byId.get(it.Id);
    // The resume entry carries the live position; keep the freshest user data per title.
    if (!prev || (it.UserData?.PlaybackPositionTicks ?? 0) > 0) byId.set(it.Id, it);
  }
  const rows: HistoryRow[] = [];
  for (const it of byId.values()) {
    if (hidden.has(it.Id) || (it.Type !== "Movie" && it.Type !== "Episode")) continue;
    const isEp = it.Type === "Episode", ud = it.UserData ?? {};
    const art = isEp ? (it.SeriesPrimaryImageTag ? { id: it.SeriesId, tag: it.SeriesPrimaryImageTag } : null) : it.ImageTags?.Primary ? { id: it.Id, tag: it.ImageTags.Primary } : null;
    const pos = ud.PlaybackPositionTicks ?? 0;
    rows.push({
      id: it.Id, linkId: isEp ? it.SeriesId ?? it.Id : it.Id, kind: isEp ? "tv" : "film", title: isEp ? it.SeriesName ?? it.Name : it.Name,
      subtitle: isEp ? `S${it.ParentIndexNumber ?? "?"}E${it.IndexNumber ?? "?"} · ${it.Name}` : String(it.ProductionYear ?? ""),
      posterUrl: art ? `${base}/Items/${art.id === it.Id || !art.id ? it.Id : art.id}/Images/Primary?maxHeight=300&tag=${encodeURIComponent(art.tag)}` : null,
      lastPlayed: ud.LastPlayedDate ?? null, playCount: ud.PlayCount ?? 0, genres: Array.isArray(it.Genres) ? it.Genres.filter((g: unknown) => typeof g === "string").slice(0, 6) : [],
      runtimeMinutes: it.RunTimeTicks > 0 ? Math.max(1, Math.round(it.RunTimeTicks / 600_000_000)) : null,
      resumePct: pos > 0 && it.RunTimeTicks > 0 ? Math.min(100, Math.round((pos / it.RunTimeTicks) * 100)) : null,
    });
  }
  return rows.filter((r) => !kind || r.kind === kind).sort((a, b) => (b.lastPlayed ?? "").localeCompare(a.lastPlayed ?? ""));
}

/** UTC calendar estimates: Jellyfin records last play, not individual watch sessions. */
export function historyStats(rows: HistoryRow[], now = new Date()) {
  const month = now.toISOString().slice(0, 7);
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const days = Array.from({ length: 14 }, (_, i) => ({ date: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 13 + i)).toISOString().slice(0, 10), hours: 0 }));
  let thisMonth = 0, lastMonth = 0, filmsMinutes = 0, tvMinutes = 0, films = 0, episodes = 0;
  const watched = new Map<string, number>();
  const hours = (minutes: number) => Math.round(minutes / 6) / 10;
  for (const r of rows.slice(0, 1000)) {
    const minutes = r.runtimeMinutes ?? 0;
    const parsed = r.lastPlayed ? new Date(r.lastPlayed) : null;
    const date = parsed && Number.isFinite(+parsed) ? parsed.toISOString().slice(0, 10) : "";
    if (date.slice(0, 7) === month) {
      thisMonth += minutes;
      if (r.kind === "film") { filmsMinutes += minutes; films++; }
      else { tvMinutes += minutes; episodes++; }
    }
    if (date.slice(0, 7) === previous) lastMonth += minutes;
    const day = days.find(d => d.date === date);
    if (day) day.hours += minutes;
    const total = Math.max(0, r.playCount) * minutes;
    if (total > 0) watched.set(r.title, (watched.get(r.title) ?? 0) + total);
  }
  return { thisMonthHours: hours(thisMonth), lastMonthHours: hours(lastMonth), filmsHours: hours(filmsMinutes), tvHours: hours(tvMinutes), films, episodes,
    days: days.map(d => ({ ...d, hours: hours(d.hours) })),
    mostWatched: [...watched].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([title, minutes]) => ({ title, hours: hours(minutes) })) };
}

export type Range = "week" | "month" | "90d" | "year";
export const RANGES: Range[] = ["week", "month", "90d", "year"];
const DAY = 86400_000;
const utcDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** [from, to) in UTC ms for the period ending today, plus the equal period before it. Year = the last 12 calendar months (this month included). */
export function rangeWindow(range: Range, now = new Date()) {
  const today = startOfDay(now), to = today + DAY;
  if (range === "year") {
    const from = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1), prevFrom = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 23, 1);
    return { from, to, prevFrom, prevTo: from };
  }
  const days = { week: 7, month: 30, "90d": 90 }[range];
  const from = to - days * DAY;
  return { from, to, prevFrom: from - days * DAY, prevTo: from };
}
const playedAt = (r: HistoryRow) => { const t = r.lastPlayed ? Date.parse(r.lastPlayed) : NaN; return Number.isFinite(t) ? t : null; };
const toHours = (minutes: number) => Math.round(minutes / 6) / 10;

/** Watch time for a period with a bar chart that suits its length: days (week, month), weeks (90 days) or months (year). Estimates: Jellyfin keeps the last play of each title, not every session. */
export function historyRange(rows: HistoryRow[], range: Range, now = new Date()) {
  const w = rangeWindow(range, now);
  const inWin = (r: HistoryRow, from: number, to: number) => { const t = playedAt(r); return t !== null && t >= from && t < to; };
  const cur = rows.filter((r) => inWin(r, w.from, w.to)), prev = rows.filter((r) => inWin(r, w.prevFrom, w.prevTo));
  const minutes = (xs: HistoryRow[]) => xs.reduce((a, r) => a + (r.runtimeMinutes ?? 0), 0);
  let buckets: Array<{ start: string; label: string; hours: number }>;
  if (range === "year") {
    buckets = Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1)); return { start: d.toISOString().slice(0, 10), label: d.toISOString().slice(0, 7), hours: 0 }; });
    for (const r of cur) { const b = buckets.find((x) => x.label === new Date(playedAt(r)!).toISOString().slice(0, 7)); if (b) b.hours += r.runtimeMinutes ?? 0; }
  } else {
    const size = range === "90d" ? 7 : 1, count = Math.ceil((w.to - w.from) / DAY / size);
    // buckets end today, so the last one is always "this week" / "today"
    buckets = Array.from({ length: count }, (_, i) => { const start = w.to - (count - i) * size * DAY; return { start: utcDay(Math.max(start, w.from)), label: utcDay(Math.max(start, w.from)), hours: 0 }; });
    for (const r of cur) { const idx = Math.min(count - 1, Math.max(0, Math.floor((playedAt(r)! - (w.to - count * size * DAY)) / (size * DAY)))); buckets[idx].hours += r.runtimeMinutes ?? 0; }
  }
  buckets = buckets.map((b) => ({ ...b, hours: toHours(b.hours) }));
  const byTitle = new Map<string, number>();
  for (const r of cur) if (r.runtimeMinutes) byTitle.set(r.title, (byTitle.get(r.title) ?? 0) + r.runtimeMinutes);
  const days = Math.max(1, Math.round((w.to - w.from) / DAY));
  const films = cur.filter((r) => r.kind === "film"), eps = cur.filter((r) => r.kind === "tv");
  return {
    range, from: utcDay(w.from), to: utcDay(w.to - DAY),
    totalHours: toHours(minutes(cur)), previousHours: toHours(minutes(prev)), perDayHours: Math.round((minutes(cur) / days / 60) * 10) / 10,
    titles: new Set(cur.map((r) => r.title)).size, films: films.length, episodes: eps.length, filmsHours: toHours(minutes(films)), tvHours: toHours(minutes(eps)),
    buckets,
    mostWatched: [...byTitle].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([title, m]) => ({ title, hours: toHours(m) })),
  };
}

/** One page of history, optionally limited to a period, newest first. */
export function historyPage(rows: HistoryRow[], opts: { range?: Range; page?: number; size?: number }, now = new Date()) {
  const w = opts.range ? rangeWindow(opts.range, now) : null;
  const all = w ? rows.filter((r) => { const t = playedAt(r); return t !== null && t >= w.from && t < w.to; }) : rows;
  const size = Math.min(50, Math.max(5, Math.floor(opts.size ?? 20))), pages = Math.max(1, Math.ceil(all.length / size));
  const page = Math.min(pages, Math.max(1, Math.floor(opts.page ?? 1)));
  return { items: all.slice((page - 1) * size, page * size), total: all.length, page, pages, size };
}
