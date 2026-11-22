import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { run } from "../src/db";

const A = "a".repeat(32), B = "b".repeat(32), C = "c".repeat(32), S = "d".repeat(32);
let asked: Array<Record<string, string>>;
const library: Record<string, any> = {
  [A]: { Id: A, Type: "Movie", ProviderIds: { Tmdb: "10" }, MediaStreams: [{ Type: "Video", Width: 3840, Height: 1600 }] },
  [B]: { Id: B, Type: "Series", ProviderIds: { Tmdb: "20" }, OfficialRating: "TV-MA" },
  [C]: { Id: C, Type: "Episode", SeriesId: S, MediaStreams: [{ Type: "Video", Width: 1920, Height: 1080 }] },
  [S]: { Id: S, Type: "Series", ProviderIds: { Tmdb: "30" }, OfficialRating: "15" },
};
const app = createApp({
  jellyfin: (() => ({
    authenticate: async () => ({ id: "u1", name: "maya", isAdmin: false }), getUser: async () => ({ id: "u1", name: "maya", isAdmin: false, isDisabled: false }),
    userItems: async (_u: string, q: Record<string, string>) => { asked.push(q); return q.ids.split(",").map((i) => library[i]).filter(Boolean); },
    libraryQuality: async (kind: string, tmdb: number) => (kind === "tv" && tmdb === 20 ? "720p" : null),
  })) as never,
  seerr: (() => ({ summary: async (_k: string, id: number) => (id === 10 ? { rating: "12A" } : id === 30 ? { rating: "" } : null) })) as never,
});
const get = async (qs: string) => { const r = await app.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "maya", password: "x" }) }, env); return app.request(`/api/badges?ids=${qs}`, { headers: { cookie: r.headers.get("set-cookie")!.split(";")[0] } }, env); };
beforeEach(async () => { asked = []; for (const t of ["members", "sessions", "rate_limits"]) await run(env.DB, `DELETE FROM ${t}`); });

describe("poster badges", () => {
  test("a film, a show and an episode each get a UK rating and real quality; unknown ratings stay blank", async () => {
    const j = (await (await get([A, B, C].join(","))).json()) as any;
    expect(j[A]).toEqual({ rating: "12A", quality: "4K" });          // Seerr's BBFC, the file's own resolution
    expect(j[B]).toEqual({ rating: "", quality: "720p" });          // TV-MA is not a BBFC rating, so no badge; quality from the library lookup
    expect(j[C]).toEqual({ rating: "15", quality: "1080p" });       // the episode's own picture, the show's rating
  });
  test("junk ids are ignored and the batch is capped", async () => {
    expect(await (await get("nope,../x")).json()).toEqual({});
    await get(Array.from({ length: 40 }, (_, i) => i.toString(16).padStart(32, "0")).join(","));
    expect(asked[0].ids.split(",")).toHaveLength(30);
  });
  test("it needs a session", async () => {
    expect((await app.request("/api/badges?ids=" + A, {}, env)).status).toBe(401);
  });
});
