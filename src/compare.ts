import type { HistoryRow } from "./history";

export interface Shared { title: string; kind: "film" | "tv"; posterUrl: string | null; subtitle: string; linkId?: string }
export interface Comparison { shared: Shared[]; mine: number; theirs: number; matchPct: number }

/** One entry per film or show (episodes collapse to their series). */
const titles = (rows: HistoryRow[]) => {
  const m = new Map<string, Shared>();
  for (const r of rows) { const k = `${r.kind}:${r.title.trim().toLowerCase()}`; if (!m.has(k)) m.set(k, { title: r.title, kind: r.kind, posterUrl: r.posterUrl, subtitle: r.kind === "film" ? r.subtitle : "", linkId: r.linkId }); }
  return m;
};

/** Privacy: only titles BOTH members watched are returned, never anything the other member watched alone. */
export function compareHistories(mine: HistoryRow[], theirs: HistoryRow[]): Comparison {
  const a = titles(mine), b = titles(theirs);
  const shared = [...a].filter(([k]) => b.has(k)).map(([, v]) => v).sort((x, y) => x.title.localeCompare(y.title));
  const union = a.size + b.size - shared.length;
  return { shared, mine: a.size, theirs: b.size, matchPct: union ? Math.round((shared.length / union) * 100) : 0 };
}

export interface PersonStats {
  totalHours: number; filmHours: number; tvHours: number; films: number; shows: number; episodes: number;
  last30Hours: number; rewatches: number; topGenres: string[]; topTitle: { title: string; hours: number } | null;
  busiestDay: string | null; usualTime: string | null;
}
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const part = (h: number) => (h >= 5 && h < 12 ? "Morning" : h >= 12 && h < 17 ? "Afternoon" : h >= 17 && h < 22 ? "Evening" : "Late night");
const top = <K>(m: Map<K, number>) => [...m].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
const hrs = (minutes: number) => Math.round(minutes / 6) / 10;

/** Fun numbers from a member's history. Estimates: Jellyfin keeps the last play and a play count, not every session. Only aggregates leave this function. */
export function personStats(rows: HistoryRow[], now = new Date()): PersonStats {
  let film = 0, tv = 0, last30 = 0, rewatches = 0, episodes = 0, films = 0;
  const shows = new Set<string>(), genres = new Map<string, number>(), titleMinutes = new Map<string, number>(), days = new Map<string, number>(), times = new Map<string, number>();
  for (const r of rows) {
    const minutes = Math.max(0, r.playCount) * (r.runtimeMinutes ?? 0);
    if (r.playCount <= 0) continue;
    if (r.kind === "film") { film += minutes; films++; } else { tv += minutes; episodes++; shows.add(r.title.trim().toLowerCase()); }
    if (r.playCount > 1) rewatches++;
    for (const g of r.genres) genres.set(g, (genres.get(g) ?? 0) + minutes);
    titleMinutes.set(r.title, (titleMinutes.get(r.title) ?? 0) + minutes);
    const t = r.lastPlayed ? new Date(r.lastPlayed) : null;
    if (t && Number.isFinite(+t)) {
      if (now.getTime() - +t < 30 * 86400_000) last30 += r.runtimeMinutes ?? 0;
      const local = new Date(t.toLocaleString("en-US", { timeZone: "Europe/London" }));
      days.set(DAYS[local.getDay()], (days.get(DAYS[local.getDay()]) ?? 0) + 1);
      times.set(part(local.getHours()), (times.get(part(local.getHours())) ?? 0) + 1);
    }
  }
  const best = [...titleMinutes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {
    totalHours: hrs(film + tv), filmHours: hrs(film), tvHours: hrs(tv), films, shows: shows.size, episodes, last30Hours: hrs(last30), rewatches,
    topGenres: [...genres].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([g]) => g),
    topTitle: best && best[1] > 0 ? { title: best[0], hours: hrs(best[1]) } : null, busiestDay: top(days), usualTime: top(times),
  };
}

/** Titles every one of the members has watched. Privacy: nothing watched by only some of them is returned. */
export function sharedByAll(all: HistoryRow[][]): Shared[] {
  const maps = all.map(titles);
  if (!maps.length) return [];
  return [...maps[0]].filter(([k]) => maps.every((m) => m.has(k))).map(([, v]) => v).sort((x, y) => x.title.localeCompare(y.title));
}
