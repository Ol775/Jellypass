import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { all, first, run } from "./db";
import type { Env } from "./env";
import type { Asn, Geo } from "./geoip";
import type { Jellyfin } from "./jellyfin";
import type { IntegrationTester } from "./integrations";
import type { Mailer } from "./mail";
import type { Seerr } from "./seerr";
import type { Tracearr } from "./tracearr";

export const COOKIE = "jp_session";
export const SESSION_HOURS = 12;
const RECHECK_MS = 5 * 60 * 1000;

export type SessionInfo = { id: string; jellyfinId: string; username: string; isAdmin: boolean; csrf: string; stale: boolean };
export type AppEnv = { Bindings: Env; Variables: { geo: Geo; asn: Asn; testIntegration: IntegrationTester; tracearr: Tracearr; fetch: typeof fetch; jf: Jellyfin; seerr: Seerr; mailer: Mailer; session: SessionInfo } };

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
export const now = () => new Date().toISOString();
export const randomToken = (bytes = 24) => hex(crypto.getRandomValues(new Uint8Array(bytes)).buffer);
export async function sha256(s: string) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(s))); }

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function sign(secret: string, value: string) { return hex(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(value))); }
/** Constant-time compare of equal-length hex strings. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function createSession(env: Env, user: { id: string; name: string; isAdmin: boolean }, meta: { label?: string; city?: string | null } = {}) {
  const id = randomToken(), csrf = randomToken(16);
  const expires = new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString();
  await run(env.DB, "INSERT INTO sessions (id, jellyfin_id, username, is_admin, expires_at, checked_at, csrf, label, city, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)", id, user.id, user.name, user.isAdmin ? 1 : 0, expires, now(), csrf, meta.label ?? null, meta.city ?? null, now());
  return { cookieValue: `${id}.${await sign(env.SESSION_SECRET, id)}`, csrf };
}

export async function endSessionsFor(db: D1Database, jellyfinId: string) {
  await run(db, "DELETE FROM sessions WHERE jellyfin_id = ?", jellyfinId);
}

type Row = { id: string; jellyfin_id: string; username: string; is_admin: number; expires_at: string; checked_at: string; csrf: string };

export async function loadSession(c: Context<AppEnv>): Promise<SessionInfo | null> {
  const raw = getCookie(c, COOKIE);
  if (!raw) return null;
  const [id, sig] = raw.split(".");
  if (!id || !sig || !safeEqual(sig, await sign(c.env.SESSION_SECRET, id))) return null;
  const row = await first<Row>(c.env.DB, "SELECT * FROM sessions WHERE id = ?", id);
  if (!row) return null;
  if (row.expires_at <= now()) { await run(c.env.DB, "DELETE FROM sessions WHERE id = ?", id); return null; }
  let isAdmin = !!row.is_admin, stale = false;
  if (Date.now() - Date.parse(row.checked_at) > RECHECK_MS) {
    try {
      const u = await c.var.jf.getUser(row.jellyfin_id);
      if (!u || u.isDisabled) { await run(c.env.DB, "DELETE FROM sessions WHERE id = ?", id); return null; }
      isAdmin = u.isAdmin;
      await run(c.env.DB, "UPDATE sessions SET checked_at = ?, is_admin = ? WHERE id = ?", now(), isAdmin ? 1 : 0, id);
    } catch {
      stale = true; // Jellyfin unreachable: members carry on, admin actions fail closed.
    }
  }
  return { id, jellyfinId: row.jellyfin_id, username: row.username, isAdmin, csrf: row.csrf, stale };
}

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const s = await loadSession(c);
  if (!s) return c.json({ error: "unauthenticated" }, 401);
  if (!SAFE.has(c.req.method) && c.req.header("x-csrf-token") !== s.csrf) return c.json({ error: "bad csrf token" }, 403);
  c.set("session", s);
  await next();
};

/** Admin routes always re-check the user in Jellyfin; they fail closed if Jellyfin is unreachable. */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const s = c.get("session");
  let u;
  try { u = await c.var.jf.getUser(s.jellyfinId); } catch { return c.json({ error: "jellyfin unavailable" }, 503); }
  if (!u || u.isDisabled || !u.isAdmin) return c.json({ error: "forbidden" }, 403);
  await next();
};

/**
 * Atomically reserve one attempt for `key` before the guarded work runs, so parallel requests cannot
 * all pass a stale check. Returns false once more than `max` attempts fall inside the window.
 */
export async function rateReserve(db: D1Database, key: string, max: number, windowSec: number): Promise<boolean> {
  const t = now();
  const expired = "((julianday(?) - julianday(window_start)) * 86400) >= ?";
  const row = await db.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET
       window_start = CASE WHEN ${expired} THEN excluded.window_start ELSE window_start END,
       count = CASE WHEN ${expired} THEN 1 ELSE count + 1 END
     RETURNING count`,
  ).bind(key, t, t, windowSec, t, windowSec).first<{ count: number }>();
  return (row?.count ?? 1) <= max;
}
/** Give an attempt back (a successful sign-in should not eat the shared IP's allowance). */
export const rateRelease = (db: D1Database, key: string) => run(db, "UPDATE rate_limits SET count = MAX(count - 1, 0) WHERE key = ?", key);
export const rateClear = (db: D1Database, key: string) => run(db, "DELETE FROM rate_limits WHERE key = ?", key);

export async function verifyTurnstile(env: Env, token: string | undefined, ip: string | undefined, fetchImpl: typeof fetch = fetch) {
  if (env.ENVIRONMENT !== "prod" || env.TURNSTILE_DISABLED === "true") return true; // DISABLED is only ever set by a self-hosted install that opts out
  if (!token || !env.TURNSTILE_SECRET) return false;
  const res = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, ...(ip ? { remoteip: ip } : {}) }),
  });
  return !!((await res.json()) as { success?: boolean }).success;
}
export { all };
