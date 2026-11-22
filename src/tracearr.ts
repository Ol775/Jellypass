import type { Env } from "./env";

export interface LiveStream {
  id: string; username: string; title: string; subtitle: string; device: string; state: string;
  progressPct: number | null; durationMinutes: number | null; remainingMinutes: number | null; transcoding: boolean; resolution: string | null; startedAt: string | null;
}

/** Tracearr's public API is owner-level, so only admin routes may hold this client's write path (terminate). */
export function makeTracearr(env: Env, fetchImpl: typeof fetch = fetch) {
  async function call(method: string, path: string, body?: unknown) {
    // Tracearr sits behind Cloudflare Access: the Worker needs the service token as well as Tracearr's own bearer token.
    const headers: Record<string, string> = { Authorization: `Bearer ${env.TRACEARR_TOKEN}`, "CF-Access-Client-Id": env.CF_ACCESS_CLIENT_ID, "CF-Access-Client-Secret": env.CF_ACCESS_CLIENT_SECRET };
    if (body !== undefined) headers["content-type"] = "application/json";
    const res = await fetchImpl(env.TRACEARR_URL.replace(/\/$/, "") + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok) throw Object.assign(new Error(`Tracearr ${method} ${path} failed (${res.status})`), { status: res.status });
    return res;
  }
  return {
    // Field names confirmed against the live API (media_title, show_title, device, progress_ms, ...).
    async liveStreams(): Promise<LiveStream[]> {
      const j: any = await (await call("GET", "/api/v2/public/streams")).json();
      const items: any[] = Array.isArray(j) ? j : j.data ?? [];
      return items.map((s) => {
        const episode = s.show_title && s.season_number != null && s.episode_number != null ? `S${s.season_number}E${s.episode_number} · ` : "";
        const dur = Number(s.duration_ms) > 0 ? Number(s.duration_ms) : 0;
        return {
          id: String(s.id), username: String(s.username ?? ""),
          title: String(s.show_title || s.media_title || ""),
          subtitle: s.show_title ? `${episode}${s.media_title ?? ""}` : s.year ? String(s.year) : "",
          device: String(s.device || s.player || s.product || ""), state: String(s.state ?? ""),
          progressPct: dur ? Math.min(100, Math.round((Number(s.progress_ms) / dur) * 100)) : null,
          durationMinutes: dur ? Math.round(dur / 60000) : null,
          remainingMinutes: dur ? Math.max(0, Math.round((dur - Number(s.progress_ms || 0)) / 60000)) : null,
          transcoding: !!s.is_transcode, resolution: s.resolution ?? null, startedAt: s.started_at ?? null,
        };
      });
    },
    async terminate(id: string, message?: string) {
      await call("POST", `/api/v1/public/streams/${encodeURIComponent(id)}/terminate`, message ? { reason: message } : {});
    },
  };
}
export type Tracearr = ReturnType<typeof makeTracearr>;
