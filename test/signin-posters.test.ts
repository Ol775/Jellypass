import { env } from "cloudflare:workers";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createApp } from "../src/index";
import { resetSigninPosterCache } from "../src/routes/signin-posters";

const trending = vi.fn();
const fetchImage = vi.fn();
const app = createApp({ seerr: (() => ({ trending })) as never, fetch: fetchImage });
const get = (path = "/api/signin-posters") => app.request(path, {}, env);
const img = (path: string) => get(`/api/signin-posters/img?path=${encodeURIComponent(path)}`);
afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  resetSigninPosterCache();
  vi.restoreAllMocks();
  trending.mockReset().mockResolvedValue([{ mediaType: "movie", posterPath: "/film.jpg" }]);
  fetchImage.mockReset().mockImplementation(async function (this: unknown) {
    expect(this).toBeDefined();
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg", "set-cookie": "upstream=secret" } });
  });
});

test("without a session, lists at most 24 distinct, interleaved films and TV with safe paths", async () => {
  trending.mockResolvedValue([
    ...["/../bad.jpg", "/a/b.jpg", "https://evil.test/a.jpg", "/x.svg", "/" + "a".repeat(61) + ".jpg", null].map(posterPath => ({ mediaType: "movie", posterPath })),
    { mediaType: "person", posterPath: "/person.jpg" },
    ...Array.from({ length: 20 }, (_, i) => ({ mediaType: "movie", posterPath: `/film-${i}.jpg` })),
    { mediaType: "movie", posterPath: "/film-0.jpg" },
    ...Array.from({ length: 20 }, (_, i) => ({ mediaType: "tv", posterPath: `/tv_${i}.png` })),
  ]);
  const res = await get();
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  const { posters } = await res.json() as any;
  expect(posters).toEqual(Array.from({ length: 24 }, (_, i) => ({
    kind: i % 2 ? "tv" : "movie",
    url: `/api/signin-posters/img?path=${encodeURIComponent(i % 2 ? `/tv_${Math.floor(i / 2)}.png` : `/film-${Math.floor(i / 2)}.jpg`)}`,
  })));
  expect(trending).toHaveBeenCalledWith();
  expect(fetchImage).not.toHaveBeenCalled();
});

test("Seerr failure gives an empty list with 200 and denies images", async () => {
  trending.mockRejectedValue(new Error("unavailable"));
  const res = await get();
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ posters: [] });
  expect((await img("/film.jpg")).status).toBe(404);
  expect(fetchImage).not.toHaveBeenCalled();
});

test("rejects malformed and unlisted paths without fetching an image", async () => {
  for (const path of ["", "/../film.jpg", "/a/b.jpg", "https://evil.test/x.jpg", "/x.svg", "/unlisted.jpg"]) {
    expect((await img(path)).status).toBe(404);
  }
  expect(fetchImage).not.toHaveBeenCalled();
});

test("serves listed image bytes anonymously, fetching only TMDB with explicit public caching", async () => {
  const res = await img("/film.jpg");
  expect(res.status).toBe(200);
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  expect(res.headers.get("content-type")).toBe("image/jpeg");
  expect(res.headers.get("cache-control")).toBe("public, max-age=86400");
  expect(res.headers.get("set-cookie")).toBeNull();
  expect(fetchImage.mock.calls).toEqual([["https://image.tmdb.org/t/p/w342/film.jpg", { redirect: "manual" }]]);
  expect(trending).toHaveBeenCalledWith();
});

test("rejects non-images, upstream errors and fetch failures", async () => {
  fetchImage.mockResolvedValueOnce(new Response("html", { headers: { "content-type": "text/html" } }));
  expect((await img("/film.jpg")).status).toBe(404);
  fetchImage.mockResolvedValueOnce(new Response("missing", { status: 404 }));
  expect((await img("/film.jpg")).status).toBe(404);
  fetchImage.mockRejectedValueOnce(new Error("offline"));
  expect((await img("/film.jpg")).status).toBe(502);
});

test("caches the list for an hour, then checks membership against the refreshed list", async () => {
  let now = 1000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  await get();
  now += 3600000 - 1;
  await img("/film.jpg");
  expect(trending).toHaveBeenCalledTimes(1);
  trending.mockResolvedValue([{ mediaType: "tv", posterPath: "/new.png" }]);
  now += 1;
  expect((await img("/film.jpg")).status).toBe(404);
  expect(trending).toHaveBeenCalledTimes(2);
  expect(fetchImage).toHaveBeenCalledTimes(1);
});

test("serves a Jellyfin login backdrop stylesheet with absolute poster URLs", async () => {
  const res = await get("/api/signin-posters/jellyfin.css");
  expect(res.headers.get("content-type")).toContain("text/css");
  const css = await res.text();
  expect(css).toContain("/api/signin-posters/img?path=%2Ffilm.jpg");
  expect(css).toContain(".loginDisclaimer>p:has(.jp-card){order:2"); // the Jellypass card moves under the profile icons
  expect(css).toContain("html.layout-tv body #loginPage .jp-card{display:none!important}"); // but TVs keep the normal layout
});
