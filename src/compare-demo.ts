import type { HistoryRow } from "./history";
import type { Env } from "./env";

/** Beta-only review aid: made-up members and watch history so the Compare page can be seen with data. Never active in prod (see isDemo). */
export const isDemo = (env: Pick<Env, "ENVIRONMENT" | "DEMO_COMPARE">) => env.ENVIRONMENT === "beta" && env.DEMO_COMPARE === "1";

/** A made-up poster: a gradient with the title written on it (data: URL, so nothing is fetched). */
export function demoPoster(title: string, hue: number) {
  const lines = title.split(" ").reduce<string[]>((l, w) => (l.length && (l[l.length - 1] + " " + w).length <= 11 ? [...l.slice(0, -1), l[l.length - 1] + " " + w] : [...l, w]), []);
  const text = lines.map((t, i) => `<text x="100" y="${150 - (lines.length - 1) * 14 + i * 28}" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="24" fill="#fff">${t}</text>`).join("");
  return "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 55% 38%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360} 50% 18%)"/></linearGradient></defs><rect width="200" height="300" fill="url(#g)"/>${text}<text x="100" y="280" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#fff" opacity=".6">DEMO</text></svg>`);
}

/** Demo members who appear as "watching now". */
export const demoOthers = [
  { id: "d".repeat(32), name: "Demo Sam", title: "Demo Detectives", subtitle: "S2E5", paused: false, posterUrl: demoPoster("Demo Detectives", 190) },
  { id: "e".repeat(32), name: "Demo Alex", title: "Demo Film Night", subtitle: "", paused: true, posterUrl: demoPoster("Demo Film Night", 300) },
];
export const demoPeople = [...demoOthers.map((p) => ({ id: p.id, name: p.name })), { id: "f".repeat(32), name: "Demo Robin" }];
export const demoSeed = (id: string) => ({ d: 2, e: 3, f: 4 } as Record<string, number>)[id[0]] ?? 5;

// kind, title, minutes per episode or film, genres, hue
const catalog: Array<["tv" | "film", string, number, string[], number]> = [
  ["tv", "Demo Detectives", 55, ["Crime", "Drama"], 190], ["film", "Night Harbour", 118, ["Thriller", "Drama"], 220], ["tv", "The Quiet Orchard", 42, ["Drama", "Mystery"], 120],
  ["tv", "Paper Kingdoms", 60, ["Fantasy", "Adventure"], 330], ["film", "Last Train to Nowhere", 104, ["Thriller", "Action"], 20], ["tv", "Cooking With Fire", 30, ["Reality", "Food"], 35],
  ["tv", "Moon Shift", 48, ["Sci-Fi", "Drama"], 260], ["film", "Glass Tide", 96, ["Sci-Fi", "Adventure"], 170], ["tv", "Laugh Track", 22, ["Comedy"], 50],
  ["film", "Sunday Roast", 88, ["Comedy", "Family"], 80], ["tv", "Deep Field", 50, ["Documentary", "Science"], 205], ["film", "Iron Garden", 131, ["Action", "Adventure"], 5],
  ["tv", "Small Hours", 45, ["Crime", "Mystery"], 280], ["film", "The Long Way Up", 110, ["Drama", "Romance"], 340],
];

/** Deterministic history for a demo member (seed picks which titles, how often, and when). */
export function demoRows(seed: number, now = new Date()): HistoryRow[] {
  let x = seed * 9301 + 49297;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const rows: HistoryRow[] = [];
  catalog.forEach(([kind, title, minutes, genres, hue], i) => {
    if ((i + seed) % 3 === 0 && i > 1) return; // each member skips some titles; the first two are common to everyone
    const count = kind === "film" ? 1 : 3 + Math.floor(rnd() * 10);
    for (let e = 0; e < count; e++) {
      rows.push({ id: `demo-${seed}-${i}-${e}`, linkId: "demo", kind, title, subtitle: kind === "film" ? "2023" : `S1E${e + 1} · Episode`, posterUrl: demoPoster(title, hue),
        lastPlayed: new Date(now.getTime() - Math.floor(rnd() * 90 * 86400_000)).toISOString(), playCount: rnd() > 0.8 ? 2 : 1, resumePct: null, runtimeMinutes: minutes, genres });
    }
  });
  return rows;
}
