import type { HistoryRow } from "./history";

const TZ = "Europe/London"; // every member is in the UK; times of day are shown the way they experienced them
const parts = (iso: string) => {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const g = (t: string) => f.find((p) => p.type === t)!.value;
  return { year: Number(g("year")), month: g("month"), day: g("day"), hour: Number(g("hour")) };
};
const hrs = (minutes: number) => Math.round(minutes / 6) / 10;

export const PERSONAS = {
  night: { key: "night", label: "Night owl", text: "Most of your watching happened after dark." },
  early: { key: "early", label: "Early bird", text: "You like to get your watching in before the day gets going." },
  day: { key: "day", label: "Daytime viewer", text: "Lunch breaks and quiet afternoons are your prime time." },
  prime: { key: "prime", label: "Prime-timer", text: "Evenings are when you settle in and press play." },
} as const;

/** A calendar-year review in the style of a music "wrapped". Estimates: Jellyfin keeps each title's last play, so a rewatch counts once. */
export function buildWrapped(rows: HistoryRow[], year: number, now = new Date()) {
  const mine = rows.filter((r) => r.lastPlayed && Number.isFinite(Date.parse(r.lastPlayed)) && parts(r.lastPlayed).year === year);
  const minutes = (xs: HistoryRow[]) => xs.reduce((a, r) => a + (r.runtimeMinutes ?? 0), 0);
  const films = mine.filter((r) => r.kind === "film"), eps = mine.filter((r) => r.kind === "tv");
  const byTitle = new Map<string, { title: string; minutes: number; plays: number; posterUrl: string | null; kind: "film" | "tv" }>();
  for (const r of mine) { const t = byTitle.get(r.title) ?? { title: r.title, minutes: 0, plays: 0, posterUrl: null, kind: r.kind }; t.minutes += r.runtimeMinutes ?? 0; t.plays += 1; t.posterUrl ??= r.posterUrl; byTitle.set(r.title, t); }
  const top = (kind: "film" | "tv") => [...byTitle.values()].filter((t) => t.kind === kind).sort((a, b) => b.minutes - a.minutes || b.plays - a.plays || a.title.localeCompare(b.title)).slice(0, 5).map((t) => ({ title: t.title, hours: hrs(t.minutes), plays: t.plays, posterUrl: t.posterUrl }));
  const genre = new Map<string, number>();
  for (const r of mine) for (const g of r.genres ?? []) genre.set(g, (genre.get(g) ?? 0) + (r.runtimeMinutes ?? 0));
  const months = Array.from({ length: 12 }, (_, i) => ({ month: `${year}-${String(i + 1).padStart(2, "0")}`, minutes: 0 }));
  const days = new Map<string, { minutes: number; titles: number; episodes: number }>();
  const slots = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  let weekendMinutes = 0;
  const weekday = Array(7).fill(0) as number[]; // Monday first
  for (const r of mine) {
    const p = parts(r.lastPlayed!), m = r.runtimeMinutes ?? 0, key = `${p.year}-${p.month}-${p.day}`;
    months[Number(p.month) - 1].minutes += m;
    const dow = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`).getUTCDay();
    weekday[(dow + 6) % 7] += m || 1;
    if ([0, 6].includes(dow)) weekendMinutes += m;
    const d = days.get(key) ?? { minutes: 0, titles: 0, episodes: 0 }; d.minutes += m; d.titles++; if (r.kind === "tv") d.episodes++; days.set(key, d);
    slots[p.hour >= 22 || p.hour < 5 ? "night" : p.hour < 11 ? "morning" : p.hour < 18 ? "afternoon" : "evening"] += m || 1;
  }
  const busiestMonth = [...months].sort((a, b) => b.minutes - a.minutes)[0];
  const busiestDay = [...days].sort((a, b) => b[1].minutes - a[1].minutes || (a[0] < b[0] ? 1 : -1))[0];
  const binge = [...days].sort((a, b) => b[1].episodes - a[1].episodes || (a[0] < b[0] ? 1 : -1))[0];
  // longest run of consecutive days with something watched
  const keys = [...days.keys()].sort(); let streak = 0, best = 0, prev = 0;
  for (const k of keys) { const t = Date.parse(k + "T12:00:00Z"); streak = prev && t - prev === 86400_000 ? streak + 1 : 1; best = Math.max(best, streak); prev = t; }
  const slotWinner = (Object.entries({ night: slots.night, early: slots.morning, day: slots.afternoon, prime: slots.evening }).sort((a, b) => b[1] - a[1])[0][0]) as keyof typeof PERSONAS;
  const persona = mine.length >= 3 ? PERSONAS[slotWinner] : null;
  const total = minutes(mine);
  const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const wdTotal = weekday.reduce((a, b) => a + b, 0), wdTop = weekday.indexOf(Math.max(...weekday));
  const slotTotal = slots.night + slots.morning + slots.afternoon + slots.evening;
  const pct = (n: number) => (slotTotal ? Math.round((n / slotTotal) * 100) : 0);
  const byDate = [...mine].sort((a, b) => Date.parse(a.lastPlayed!) - Date.parse(b.lastPlayed!));
  const mark = (r: HistoryRow | undefined) => (r ? { title: r.title, kind: r.kind, date: r.lastPlayed!, posterUrl: r.posterUrl } : null);
  // Rewatches: Jellyfin's play count is the only record, so this is "played more than once", summed per title.
  const again = new Map<string, { title: string; kind: "film" | "tv"; times: number }>();
  for (const r of mine) if (r.playCount > 1) { const t = again.get(r.title) ?? { title: r.title, kind: r.kind, times: 0 }; t.times += r.playCount - 1; again.set(r.title, t); }
  const decades = new Map<string, number>();
  for (const r of films) { const y = Number(r.subtitle); if (y >= 1900 && y <= 2100) decades.set(`${Math.floor(y / 10) * 10}s`, (decades.get(`${Math.floor(y / 10) * 10}s`) ?? 0) + 1); }
  const topDecade = [...decades].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0];
  const prevTotal = minutes(rows.filter((r) => r.lastPlayed && Number.isFinite(Date.parse(r.lastPlayed)) && parts(r.lastPlayed).year === year - 1));
  const longestFilm = [...films].sort((a, b) => (b.runtimeMinutes ?? 0) - (a.runtimeMinutes ?? 0))[0];
  const posters = [...byTitle.values()].filter((t) => t.posterUrl).sort((a, b) => b.minutes - a.minutes).slice(0, 18).map((t) => t.posterUrl as string);
  const elapsedDays = year === now.getUTCFullYear() ? Math.max(1, Math.ceil((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - Date.UTC(year, 0, 1)) / 86400_000)) : (year % 4 === 0 ? 366 : 365);
  return {
    year, partial: year === now.getUTCFullYear() && now.getUTCMonth() < 11, hasData: mine.length > 0,
    totalHours: hrs(total), totalDays: Math.round((total / 60 / 24) * 10) / 10, titles: byTitle.size, plays: mine.length,
    films: films.length, episodes: eps.length, filmsHours: hrs(minutes(films)), tvHours: hrs(minutes(eps)),
    topShows: top("tv"), topFilms: top("film"),
    topGenres: [...genre].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([name, m]) => ({ name, hours: hrs(m) })),
    months: months.map((m) => ({ month: m.month, hours: hrs(m.minutes) })),
    busiestMonth: busiestMonth && busiestMonth.minutes > 0 ? { month: busiestMonth.month, hours: hrs(busiestMonth.minutes) } : null,
    busiestDay: busiestDay ? { date: busiestDay[0], hours: hrs(busiestDay[1].minutes), titles: busiestDay[1].titles } : null,
    bingeDay: binge && binge[1].episodes >= 2 ? { date: binge[0], episodes: binge[1].episodes } : null,
    longestStreak: best,
    persona, posters,
    weekdays: WEEKDAYS.map((name, i) => ({ name, share: wdTotal ? Math.round((weekday[i] / wdTotal) * 100) : 0 })), busiestWeekday: wdTotal ? WEEKDAYS[wdTop] : null,
    dayparts: { morning: pct(slots.morning), afternoon: pct(slots.afternoon), evening: pct(slots.evening), night: pct(slots.night) },
    opening: mark(byDate[0]), closing: byDate.length > 1 ? mark(byDate[byDate.length - 1]) : null,
    rewatches: { total: [...again.values()].reduce((a, t) => a + t.times, 0), top: [...again.values()].sort((a, b) => b.times - a.times || a.title.localeCompare(b.title)).slice(0, 3) },
    topDecade: topDecade && films.length >= 3 ? { decade: topDecade[0], films: topDecade[1] } : null, genreCount: genre.size,
    previousYearHours: hrs(prevTotal), weekendShare: total ? Math.round((weekendMinutes / total) * 100) : 0,
    perDayMinutes: Math.round(total / elapsedDays),
    longestFilm: longestFilm?.runtimeMinutes ? { title: longestFilm.title, minutes: longestFilm.runtimeMinutes } : null,
    quietestMonth: (() => { const upTo = year === now.getUTCFullYear() ? now.getUTCMonth() + 1 : 12; const seen = months.slice(0, upTo).filter((m) => m.minutes > 0).sort((a, b) => a.minutes - b.minutes)[0]; return seen ? { month: seen.month, hours: hrs(seen.minutes) } : null; })(),
  };
}

// Well-known running times, for comparisons that are easy to picture. Approximate on purpose ("about").
const REFS = [
  { name: "every Harry Potter film", hours: 19.4 }, { name: "the Lord of the Rings extended trilogy", hours: 11.4 },
  { name: "a flight from London to New York", hours: 8 }, { name: "Titanic", hours: 3.2 },
];
export interface Fact { key: string; title: string; text: string }
/** Short, comparable facts about the stats. Only what the data supports, never a made-up number. */
export function wrappedFacts(w: ReturnType<typeof buildWrapped>, year = w.year): Fact[] {
  if (!w.hasData) return [];
  const out: Fact[] = [];
  const ref = REFS.find((r) => w.totalHours >= r.hours);
  if (ref) { const n = Math.floor(w.totalHours / ref.hours); out.push({ key: "ref", title: "In perspective", text: `That is about ${n} time${n === 1 ? "" : "s"} through ${ref.name}.` }); }
  if (w.perDayMinutes >= 1) out.push({ key: "perday", title: "Every single day", text: `You averaged about ${w.perDayMinutes} minutes of watching a day${w.partial ? " so far this year" : ""}.` });
  if (w.filmsHours > 0 && w.tvHours > 0) { const big = Math.max(w.tvHours, w.filmsHours), small = Math.min(w.tvHours, w.filmsHours), x = Math.round((big / small) * 10) / 10; out.push({ key: "ratio", title: w.tvHours >= w.filmsHours ? "TV beats films" : "Films beat TV", text: `You watched ${x}x more ${w.tvHours >= w.filmsHours ? "TV than films" : "films than TV"}.` }); }
  const top = w.topShows[0] ?? w.topFilms[0];
  if (top && w.totalHours > 0) { const pct = Math.round((top.hours / w.totalHours) * 100); if (pct >= 5) out.push({ key: "share", title: "Your number one", text: `${top.title} alone made up ${pct}% of everything you watched.` }); }
  if (w.busiestMonth && w.quietestMonth && w.busiestMonth.month !== w.quietestMonth.month && w.quietestMonth.hours > 0) { const x = Math.round((w.busiestMonth.hours / w.quietestMonth.hours) * 10) / 10; if (x >= 1.5) out.push({ key: "months", title: "Busy and quiet", text: `${new Date(w.busiestMonth.month + "-01T12:00:00Z").toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" })} was ${x}x busier than ${new Date(w.quietestMonth.month + "-01T12:00:00Z").toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" })}.` }); }
  if (w.weekendShare > 0) out.push({ key: "weekend", title: "Weekends", text: `${w.weekendShare}% of your watching happened on a Saturday or Sunday${w.weekendShare > 29 ? ", more than your fair 2 days in 7" : ""}.` });
  if (w.previousYearHours > 0) { const pct = Math.round(((w.totalHours - w.previousYearHours) / w.previousYearHours) * 100); out.push({ key: "yoy", title: `Compared with ${year - 1}`, text: `${Math.abs(pct)}% ${pct >= 0 ? "more" : "less"} than ${year - 1} (${w.previousYearHours} h then, ${w.totalHours} h now).` }); }
  if (w.longestFilm && w.longestFilm.minutes >= 100) out.push({ key: "longest", title: "Longest film", text: `${w.longestFilm.title} ran ${Math.floor(w.longestFilm.minutes / 60)} h ${w.longestFilm.minutes % 60} min.` });
  return out.slice(0, 8);
}
export const wrappedYears = (rows: HistoryRow[]) => [...new Set(rows.filter((r) => r.lastPlayed && Number.isFinite(Date.parse(r.lastPlayed))).map((r) => parts(r.lastPlayed!).year))].sort((a, b) => b - a);
