import type { Env } from "./env";

export class BetaGuardError extends Error {}
export class JellyfinError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

export interface JfUser { id: string; name: string; isAdmin: boolean; isDisabled: boolean }
export interface JfDevice { id: string; name: string; appName: string; lastUserId?: string; lastActivity?: string }
export interface ActivityEntry { id: number; name: string; overview: string; shortOverview: string; type: string; userId: string | null; date: string; severity: string }
export type JfPolicy = Record<string, unknown>;

const CLIENT = 'Client="Jellypass", Device="Jellypass", DeviceId="jellypass-portal", Version="1.0"';

export const heightLabel = (w: number, h: number) => (h >= 2000 || w >= 3600 ? "4K" : h >= 1000 || w >= 1800 ? "1080p" : h >= 700 || w >= 1200 ? "720p" : "SD");
// Shared across requests: library quality changes rarely and each lookup is one or two Jellyfin calls.
const qualityCache = new Map<string, { at: number; label: string | null; id: string | null }>();
export function makeJellyfin(env: Env, fetchImpl: typeof fetch = fetch) {
  const base = env.JELLYFIN_URL.replace(/\/$/, "");
  const beta = env.ENVIRONMENT === "beta";
  const adminAuth = `MediaBrowser ${CLIENT}, Token="${env.JELLYFIN_ADMIN_KEY}"`;

  async function call(method: string, path: string, opts: { body?: unknown; admin?: boolean; query?: Record<string, string> } = {}) {
    const url = new URL(base + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
    const headers: Record<string, string> = { Authorization: opts.admin === false ? `MediaBrowser ${CLIENT}` : adminAuth };
    if (env.UPSTREAM_KEY) headers["X-Jellypass-Key"] = env.UPSTREAM_KEY;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    return fetchImpl(url.toString(), { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  }
  async function ok(res: Response, what: string) {
    if (!res.ok) throw new JellyfinError(res.status, `Jellyfin ${what} failed (${res.status})`);
    return res;
  }
  const toUser = (u: any): JfUser => ({ id: u.Id, name: u.Name, isAdmin: !!u.Policy?.IsAdministrator, isDisabled: !!u.Policy?.IsDisabled });

  async function getRaw(id: string): Promise<any | null> {
    const res = await call("GET", `/Users/${id}`);
    if (res.status === 404) return null;
    return (await ok(res, "getUser")).json();
  }
  /** In beta only accounts named beta-* may be changed. Resolve the target's real name first. */
  async function guard(id: string) {
    if (!beta) return;
    const u = await getRaw(id);
    if (!u?.Name?.startsWith("beta-")) throw new BetaGuardError(`beta may only touch beta- accounts (user ${id})`);
  }

  return {
    async authenticate(user: string, pass: string) {
      const res = await call("POST", "/Users/AuthenticateByName", { admin: false, body: { Username: user, Pw: pass } });
      if (res.status === 401 || res.status === 400) return null;
      const j: any = await (await ok(res, "authenticate")).json();
      // Jellypass never keeps the Jellyfin token, so end that session at once instead of leaving a stray device behind.
      if (j.AccessToken) await fetchImpl(`${base}/Sessions/Logout`, { method: "POST", headers: { Authorization: `MediaBrowser ${CLIENT}, Token="${j.AccessToken}"` } }).catch(() => {});
      return { id: j.User.Id as string, name: j.User.Name as string, isAdmin: !!j.User.Policy?.IsAdministrator };
    },
    async avatar(userId: string) {
      const res = await call("GET", `/Users/${encodeURIComponent(userId)}/Images/Primary`, { query: { maxWidth: "96" } });
      if (res.status === 404) return null;
      await ok(res, "avatar");
      return { body: await res.arrayBuffer(), contentType: res.headers.get("content-type") ?? "application/octet-stream" };
    },
    async getUser(id: string): Promise<JfUser | null> {
      const u = await getRaw(id);
      return u ? toUser(u) : null;
    },
    async libraries(): Promise<Array<{ id: string; name: string }>> {
      const j: any[] = await (await ok(await call("GET", "/Library/VirtualFolders"), "libraries")).json();
      return j.map((f) => ({ id: f.ItemId, name: f.Name }));
    },
    /** Names of the libraries this user can see: all of them, or just the ones their policy allows. */
    async userLibraries(id: string): Promise<string[]> {
      const [u, libs] = await Promise.all([getRaw(id), this.libraries()]);
      if (!u) return [];
      const p = u.Policy ?? {};
      if (p.EnableAllFolders) return libs.map((l) => l.name);
      const on = new Set<string>(p.EnabledFolders ?? []);
      return libs.filter((l) => on.has(l.id)).map((l) => l.name);
    },
    async listUsers(): Promise<JfUser[]> {
      const j: any[] = await (await ok(await call("GET", "/Users"), "listUsers")).json();
      return j.map(toUser);
    },
    async createUser(name: string, password: string): Promise<JfUser> {
      if (beta && !name.startsWith("beta-")) throw new BetaGuardError("beta may only create beta- accounts");
      const res = await ok(await call("POST", "/Users/New", { body: { Name: name, Password: password } }), "createUser");
      return toUser(await res.json());
    },
    async deleteUser(id: string) {
      await guard(id);
      await ok(await call("DELETE", `/Users/${id}`), "deleteUser");
    },
    /** Jellyfin replaces the whole policy on POST, so merge the patch into the current one. */
    async setPolicy(id: string, patch: JfPolicy) {
      await guard(id);
      const current = await getRaw(id);
      if (!current) throw new JellyfinError(404, "user not found");
      await ok(await call("POST", `/Users/${id}/Policy`, { body: { ...current.Policy, ...patch } }), "setPolicy");
    },
    async setPassword(id: string, password: string) {
      await guard(id);
      await ok(await call("POST", "/Users/Password", { query: { userId: id }, body: { NewPw: password } }), "setPassword");
    },
    async listDevices(userId: string): Promise<JfDevice[]> {
      const j: any = await (await ok(await call("GET", "/Devices", { query: { userId } }), "listDevices")).json();
      return (j.Items ?? []).map((d: any) => ({ id: d.Id, name: d.Name, appName: d.AppName, lastUserId: d.LastUserId, lastActivity: d.DateLastActivity }));
    },
    async deleteDevice(userId: string, deviceId: string) {
      await guard(userId);
      const j: any = await (await ok(await call("GET", "/Devices", { query: { userId } }), "listDevices")).json();
      if (!(j.Items ?? []).some((d: any) => d.Id === deviceId)) throw new JellyfinError(404, "that device does not belong to this user");
      await ok(await call("DELETE", "/Devices", { query: { id: deviceId } }), "deleteDevice");
    },
    async deleteDevices(userId: string) {
      await guard(userId);
      const j: any = await (await ok(await call("GET", "/Devices", { query: { userId } }), "listDevices")).json();
      for (const d of j.Items ?? []) await ok(await call("DELETE", "/Devices", { query: { id: d.Id } }), "deleteDevice");
    },
    async activity(sinceIso: string): Promise<ActivityEntry[]> {
      const j: any = await (await ok(await call("GET", "/System/ActivityLog/Entries", { query: { minDate: sinceIso, limit: "500", startIndex: "0" } }), "activity")).json();
      return (j.Items ?? []).map((e: any) => ({ id: e.Id, name: e.Name ?? "", overview: e.Overview ?? "", shortOverview: e.ShortOverview ?? "", type: e.Type ?? "", userId: e.UserId ?? null, date: e.Date, severity: e.Severity ?? "" }));
    },
    async userItems(userId: string, query: Record<string, string>): Promise<any[]> {
      const j: any = await (await ok(await call("GET", "/Items", { query: { userId, ...query } }), "items")).json();
      return j.Items ?? [];
    },
    /** The next unwatched episode of each show the member is part-way through. */
    async nextUp(userId: string): Promise<any[]> {
      const j: any = await (await ok(await call("GET", "/Shows/NextUp", { query: { userId, limit: "12", enableTotalRecordCount: "false" } }), "nextUp")).json();
      return j.Items ?? [];
    },
    async clearResume(userId: string, itemId: string) {
      await guard(userId);
      await ok(await call("POST", `/UserItems/${itemId}/UserData`, { query: { userId }, body: { PlaybackPositionTicks: 0 } }), "clearResume");
    },
    /** Marks a title watched or unwatched for this member (Jellyfin's own watched state). */
    async setPlayed(userId: string, itemId: string, played: boolean) {
      await guard(userId);
      await ok(await call(played ? "POST" : "DELETE", `/UserPlayedItems/${itemId}`, { query: { userId } }), "setPlayed");
    },
    async resume(userId: string): Promise<any[]> {
      const j: any = await (await ok(await call("GET", "/UserItems/Resume", { query: { userId, limit: "50", fields: "PrimaryImageAspectRatio" } }), "resume")).json();
      return j.Items ?? [];
    },
    /** Live sessions (admin key). Only these carry the viewer's IP; Tracearr's public API does not. */
    async sessions(): Promise<Array<{ userName: string; deviceName: string; remoteIp: string | null; itemId: string | null; id: string }>> {
      const j: any[] = await (await ok(await call("GET", "/Sessions", { query: { activeWithinSeconds: "960" } }), "sessions")).json();
      return j.map((x) => ({ id: String(x.Id ?? ""), userName: String(x.UserName ?? ""), deviceName: String(x.DeviceName ?? ""), remoteIp: x.RemoteEndPoint ? String(x.RemoteEndPoint).replace(/^::ffff:/i, "") : null, itemId: x.NowPlayingItem ? String(x.NowPlayingItem.SeriesId ?? x.NowPlayingItem.Id) : null })); // episodes show the series poster
    },
    /** Who is playing something right now: name and title only, never a device or an address. */
    async nowPlaying(): Promise<Array<{ userId: string; title: string; subtitle: string; paused: boolean; remainingSeconds: number | null; itemId: string | null; posterId: string | null; episodeName: string; year: number | null; rating: string; genres: string[]; runtimeMinutes: number | null; progressPct: number | null }>> {
      const j: any[] = await (await ok(await call("GET", "/Sessions", { query: { activeWithinSeconds: "300" } }), "nowPlaying")).json();
      return j.filter((x) => x.NowPlayingItem && x.UserId).map((x) => {
        const n = x.NowPlayingItem, ep = n.Type === "Episode";
        return { userId: String(x.UserId).replace(/-/g, "").toLowerCase(), title: String(ep ? n.SeriesName ?? n.Name : n.Name ?? ""), subtitle: ep ? `S${n.ParentIndexNumber ?? "?"}E${n.IndexNumber ?? "?"}` : "", paused: x.PlayState?.IsPaused === true, episodeName: ep ? String(n.Name ?? "") : "", year: Number(n.ProductionYear) || null, rating: String(n.OfficialRating ?? ""), genres: Array.isArray(n.Genres) ? n.Genres.slice(0, 3).map(String) : [],
          runtimeMinutes: Number(n.RunTimeTicks) > 0 ? Math.round(Number(n.RunTimeTicks) / 6e8) : null, progressPct: Number(n.RunTimeTicks) > 0 ? Math.min(100, Math.round((Number(x.PlayState?.PositionTicks ?? 0) / Number(n.RunTimeTicks)) * 100)) : null,
          itemId: n.Id ? String(n.Id) : null, posterId: ep && n.SeriesId ? String(n.SeriesId) : n.Id ? String(n.Id) : null, remainingSeconds: Number(n.RunTimeTicks) > 0 ? Math.max(0, Math.round((Number(n.RunTimeTicks) - Number(x.PlayState?.PositionTicks ?? 0)) / 1e7)) : null };
      });
    },
    /** Real picture size of a title in the library ("4K", "1080p", "720p", "SD"), found by TMDB id; null if it is not there. Series use their first episode. */
    async libraryQuality(kind: "movie" | "tv", tmdbId: number): Promise<string | null> {
      return (await this.libraryItem(kind, tmdbId)).quality;
    },
    /** The title's Jellyfin item id (for deep links) and real resolution, from one cached lookup by TMDB id. */
    async libraryItem(kind: "movie" | "tv", tmdbId: number): Promise<{ id: string | null; quality: string | null }> {
      if (!Number.isInteger(tmdbId) || tmdbId <= 0) return { id: null, quality: null };
      const key = `${kind}:${tmdbId}`, hit = qualityCache.get(key);
      if (hit && Date.now() - hit.at < 3600_000) return { id: hit.id, quality: hit.label };
      const items = async (query: Record<string, string>) => ((await (await ok(await call("GET", "/Items", { query: { recursive: "true", limit: "1", fields: "MediaStreams", ...query } }), "libraryQuality")).json()) as any).Items ?? [];
      let label: string | null = null;
      const top = (await items({ anyProviderIdEquals: `tmdb.${tmdbId}`, includeItemTypes: kind === "movie" ? "Movie" : "Series" }))[0];
      const playable = !top ? null : kind === "movie" ? top : (await items({ parentId: String(top.Id), includeItemTypes: "Episode" }))[0];
      const v = (playable?.MediaStreams ?? playable?.MediaSources?.[0]?.MediaStreams ?? []).find((x: any) => x.Type === "Video");
      if (v?.Height) label = heightLabel(Number(v.Width) || 0, Number(v.Height));
      if (qualityCache.size >= 1000) qualityCache.clear(); // ponytail: crude cap, same as the Seerr summary cache
      const id = typeof top?.Id === "string" && /^[0-9a-f]{32}$/i.test(top.Id) ? top.Id : null;
      qualityCache.set(key, { at: Date.now(), label, id });
      return { id, quality: label };
    },
    /** Shows a message on the viewer's screen (Jellyfin's own session message). */
    async sendMessage(sessionId: string, text: string): Promise<void> {
      await ok(await call("POST", `/Sessions/${encodeURIComponent(sessionId)}/Message`, { body: { Header: "Message from the admin", Text: text, TimeoutMs: 15000 } }), "sendMessage");
    },
    async quickConnectAuthorize(userId: string, code: string) {
      await guard(userId);
      await ok(await call("POST", "/QuickConnect/Authorize", { query: { code, userId } }), "quickConnect");
    },
    async publicInfo(): Promise<{ ok: boolean; latencyMs: number }> {
      const t = Date.now();
      try {
        const res = await call("GET", "/System/Info/Public", { admin: false });
        if (!res.ok) console.warn(`jellyfin check: HTTP ${res.status} ${(await res.text()).slice(0, 80).replace(/\s+/g, " ")}`);
        return { ok: res.ok, latencyMs: Date.now() - t };
      } catch (e) {
        console.warn(`jellyfin check failed: ${(e as Error).message}`);
        return { ok: false, latencyMs: Date.now() - t };
      }
    },
  };
}
export type Jellyfin = ReturnType<typeof makeJellyfin>;
