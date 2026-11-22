import type { Env } from "./env";

type Summary = { title: string | null; posterPath: string | null; year: string; rating: string };
// Cache per fetch implementation: production shares the global fetch, so lookups are reused across requests.
const caches = new WeakMap<object, Map<string, Summary>>();
const BBFC = /^(U|PG|12A|12|15|18|R18)$/;
/** UK (BBFC) certificate from a Seerr detail payload: films carry release_dates, shows carry content ratings. */
function bbfc(mediaType: string, j: any): string {
  const gb = (mediaType === "movie" ? j.releases?.results : j.contentRatings?.results)?.find((x: any) => x.iso_3166_1 === "GB");
  const rating = mediaType === "movie" ? gb?.release_dates?.find((d: any) => BBFC.test(d.certification))?.certification : gb?.rating;
  return typeof rating === "string" && BBFC.test(rating) ? rating : "";
}

export function makeSeerr(env: Env, fetchImpl: typeof fetch = fetch) {
  const summaries = caches.get(fetchImpl) ?? caches.set(fetchImpl, new Map()).get(fetchImpl)!;
  async function call(method: string, path: string, body?: unknown, asUser?: number) {
    const headers: Record<string, string> = { "X-Api-Key": env.SEERR_API_KEY };
    if (env.UPSTREAM_KEY) headers["X-Jellypass-Key"] = env.UPSTREAM_KEY;
    if (body !== undefined) headers["content-type"] = "application/json";
    if (asUser !== undefined) headers["X-API-User"] = String(asUser);
    const base = env.SEERR_URL.replace(/\/$/, "") + "/api/v1";
    const res = await fetchImpl(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok) {
      const why = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 160); // Seerr's own reason, for the admin audit log
      throw Object.assign(new Error(`Seerr ${method} ${path} failed (${res.status})${why ? `: ${why}` : ""}`), { status: res.status });
    }
    return res;
  }
  return {
    /** New Jellyfin users must exist in Seerr before they can request. Returns the Seerr user id. */
    async importUser(jellyfinId: string): Promise<number> {
      const users: Array<{ id: number }> = await (await call("POST", "/user/import-from-jellyfin", { jellyfinUserIds: [jellyfinId] })).json();
      if (!users[0]) throw new Error("Seerr did not import the user");
      return users[0].id;
    },
    async search(query: string, asUser: number): Promise<any[]> {
      const j: any = await (await call("GET", `/search?query=${encodeURIComponent(query)}&page=1`, undefined, asUser)).json();
      return j.results ?? [];
    },
    async trending(asUser?: number): Promise<any[]> {
      const j: any = await (await call("GET", "/discover/trending?page=1", undefined, asUser)).json();
      return j.results ?? [];
    },
    async request(body: { mediaType: "movie" | "tv"; mediaId: number; seasons?: number[] | "all" }, asUser: number) {
      await call("POST", "/request", body, asUser);
    },
    async userRequests(seerrUserId: number): Promise<any[]> {
      const j: any = await (await call("GET", `/user/${seerrUserId}/requests?take=50&skip=0`)).json();
      return j.results ?? [];
    },
    /** Display title for a request row (Seerr's list only carries the TMDB id). Best effort. */
    async title(mediaType: string, tmdbId: number): Promise<string | null> {
      if ((mediaType !== "movie" && mediaType !== "tv") || !Number.isInteger(tmdbId)) return null;
      const j: any = await (await call("GET", `/${mediaType}/${tmdbId}`)).json();
      return j.title ?? j.name ?? null;
    },
    /** Request tile metadata from one detail lookup. Missing metadata must not hide a request. */
    async summary(mediaType: string, tmdbId: number): Promise<{ title: string | null; posterPath: string | null; year: string; rating: string } | null> {
      if ((mediaType !== "movie" && mediaType !== "tv") || !Number.isInteger(tmdbId) || tmdbId <= 0) return null;
      const key = `${mediaType}:${tmdbId}`, hit = summaries.get(key);
      if (hit) return hit;
      try {
        const j: any = await (await call("GET", `/${mediaType}/${tmdbId}`)).json();
        const title = j.title ?? j.name;
        const date = mediaType === "movie" ? j.release_date ?? j.releaseDate : j.first_air_date ?? j.firstAirDate;
        const out = { title: typeof title === "string" ? title : null, posterPath: typeof j.posterPath === "string" ? j.posterPath : null, year: typeof date === "string" ? date.slice(0, 4) : "", rating: bbfc(mediaType, j) };
        if (summaries.size >= 1000) summaries.clear(); // ponytail: crude cap; swap for an LRU if lookups ever churn
        summaries.set(key, out);
        return out;
      } catch { return null; }
    },
    async findUserByJellyfinId(jellyfinId: string): Promise<number | null> {
      const j: any = await (await call("GET", "/user?take=1000&skip=0")).json();
      return (j.results ?? []).find((u: any) => u.jellyfinUserId === jellyfinId)?.id ?? null;
    },
    /** Authenticated no-op used to check an API key works. */
    async ping() { await call("GET", "/user?take=1&skip=0"); },
    async status(): Promise<{ ok: boolean; latencyMs: number }> {
      const t = Date.now();
      try {
        const res = await fetchImpl(env.SEERR_URL.replace(/\/$/, "") + "/api/v1/status", { headers: env.UPSTREAM_KEY ? { "X-Jellypass-Key": env.UPSTREAM_KEY } : {} });
        if (!res.ok) console.warn(`seerr check: HTTP ${res.status} ${(await res.text()).slice(0, 80).replace(/\s+/g, " ")}`);
        return { ok: res.ok, latencyMs: Date.now() - t };
      } catch (e) {
        console.warn(`seerr check failed: ${(e as Error).message}`);
        return { ok: false, latencyMs: Date.now() - t };
      }
    },
    /** Seerr permission bits: REQUEST = 32, AUTO_APPROVE = 128 (confirm against the live instance in beta). */
    async setPermissions(seerrUserId: number, rights: "none" | "request" | "auto") {
      const permissions = { none: 0, request: 32, auto: 32 | 128 }[rights];
      await call("POST", `/user/${seerrUserId}/settings/permissions`, { permissions });
    },
    async deleteUser(seerrUserId: number) {
      await call("DELETE", `/user/${seerrUserId}`);
    },
    /** Import sets the email to the username, so put the real one back. */
    async setEmail(seerrUserId: number, email: string) {
      await call("PUT", `/user/${seerrUserId}`, { email });
    },
  };
}
export type Seerr = ReturnType<typeof makeSeerr>;
