import { audit } from "./audit";
import { sign } from "./auth";
import { all, first, run } from "./db";
import { renderEmail } from "./emails";
import type { ActivityEntry, Jellyfin } from "./jellyfin";
import type { Mailer } from "./mail";
import { sendPush } from "./push";

/** The Jellyfin client name Jellypass uses for its own sessions (see src/jellyfin.ts). A client chooses its own name, so on its
 *  own this proves nothing: an entry is only treated as ours if we also recorded authenticating that member at that moment. */
export const OWN_CLIENT = "Jellypass";

/** Call right after Jellypass authenticates a member against Jellyfin (it creates a short-lived Jellyfin session each time). */
export async function markOwnAuth(db: D1Database, jellyfinId: string) {
  await run(db, "INSERT INTO own_auths (jellyfin_id, at) VALUES (?,?)", jellyfinId, new Date().toISOString());
}
/** Consumes one matching record (so one authentication hides one entry) within 30 seconds of the entry. */
async function isOwnAuth(db: D1Database, jellyfinId: string, seenAt: string) {
  const t = Date.parse(seenAt);
  if (!Number.isFinite(t)) return false;
  return !!(await first(db, "DELETE FROM own_auths WHERE id = (SELECT id FROM own_auths WHERE jellyfin_id = ? AND at >= ? AND at <= ? ORDER BY at LIMIT 1) RETURNING id", jellyfinId, new Date(t - 30_000).toISOString(), new Date(t + 30_000).toISOString()));
}

export function deviceLabel(ua: string): string {
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;
  return browser && os ? `${browser} on ${os}` : browser ?? os ?? "Unknown device";
}

export type CfInfo = { city?: string; latitude?: string | number; longitude?: string | number };
const num = (v: string | number | undefined) => { const n = v === undefined ? NaN : Number(v); return Number.isFinite(n) ? n : null; };

/** Cloudflare gives the city and coordinates of the request for free, with nothing sent to third parties. */
export async function recordPortalSignin(db: D1Database, o: { jellyfinId: string; device: string; ip: string; cf?: CfInfo; unusual?: boolean }) {
  await run(db, "INSERT OR IGNORE INTO signins (source, jellyfin_id, device, ip, city, lat, lng, seen_at, unusual) VALUES ('portal',?,?,?,?,?,?,?,?)",
    o.jellyfinId, o.device, o.ip, o.cf?.city ?? null, num(o.cf?.latitude), num(o.cf?.longitude), new Date().toISOString(), o.unusual ? 1 : 0);
}

/** Entry shapes are confirmed against live data in beta; "X is online from <device>" with "IP address: <ip>" is what Jellyfin shows. */
export function parseActivity(e: ActivityEntry): { userId: string; device: string; ip: string; seenAt: string } | null {
  if (!e.userId) return null;
  if (e.type !== "SessionStarted" && !/ is online from /i.test(e.name)) return null;
  const device = e.name.match(/\bfrom\s+(.+)$/i)?.[1]?.trim() ?? "";
  // Only the server-written fields count: the device name is chosen by the client and could be made to say anything.
  const raw = `${e.overview} ${e.shortOverview}`.match(/IP address:\s*((?:\d{1,3}\.){3}\d{1,3}|[0-9a-fA-F]*:[0-9a-fA-F:.]+)/i)?.[1] ?? "";
  return { userId: e.userId, device, ip: validIp(raw) ? raw : "", seenAt: e.date };
}

function validIp(s: string) {
  if (!s) return false;
  if (!s.includes(":")) return s.split(".").every((o) => Number(o) <= 255);
  return /^[0-9a-fA-F:.]+$/.test(s) && s.length <= 45;
}

/** The city already seen for this IP in a portal sign-in, if any. */
export async function cityForIp(db: D1Database, ip: string) {
  if (!ip) return null;
  return first<{ city: string; lat: number | null; lng: number | null }>(db, "SELECT city, lat, lng FROM signins WHERE source = 'portal' AND ip = ? AND city IS NOT NULL ORDER BY seen_at DESC LIMIT 1", ip);
}

/** Has this member signed in before, and from this place? A place is a city when we know it, else the IP. An unknown IP with no city is always new (fail closed). */
async function priorContext(db: D1Database, userId: string, ip: string, city: string | null) {
  const hadHistory = !!(await first(db, "SELECT 1 AS x FROM signins WHERE jellyfin_id = ? LIMIT 1", userId));
  const byIp = ip ? !!(await first(db, "SELECT 1 AS x FROM signins WHERE jellyfin_id = ? AND ip = ? LIMIT 1", userId, ip)) : false;
  const byCity = city ? !!(await first(db, "SELECT 1 AS x FROM signins WHERE jellyfin_id = ? AND city = ? LIMIT 1", userId, city)) : false;
  return { hadHistory, seenBefore: byIp || byCity };
}

type AlertDeps = { db: D1Database; mailer: Mailer; baseUrl: string; secret: string; vapid?: string; fetch?: typeof fetch };

const SECURE_DAYS = 7;
/** Signed, expiring token for the "This wasn't me" link in an alert email: it names one member and nothing else. */
export async function secureToken(secret: string, jellyfinId: string) {
  const exp = Date.now() + SECURE_DAYS * 86400_000;
  return `${jellyfinId}.${exp}.${await sign(secret, `secure:${jellyfinId}:${exp}`)}`;
}
export async function readSecureToken(secret: string, token: string): Promise<string | null> {
  const [id, exp, sig] = token.split(".");
  if (!id || !sig || !(Number(exp) > Date.now())) return null;
  const want = await sign(secret, `secure:${id}:${exp}`);
  return want.length === sig.length && want === sig ? id : null;
}

async function alertNewSignin(d: AlertDeps, a: { userId: string; device: string; city: string | null; seenAt: string }) {
  const m = await first<{ username: string; contact_email: string | null; email_verified: number; alerts_email: number }>(d.db, "SELECT username, contact_email, email_verified, alerts_email FROM members WHERE jellyfin_id = ?", a.userId);
  if (!m) return false;
  const link = `${d.baseUrl}/secure/${await secureToken(d.secret, a.userId)}`;
  // Push: a subscribed device is the opt-in. Email: opt-in, needs a verified address; turning it off needs their password. The sign-in is recorded either way and can show as a banner.
  const pushed = (await sendPush(d, a.userId, { title: "New sign-in to your account", body: `${a.device || "A device"}${a.city ? ` from ${a.city}` : ""}. If this wasn't you, tap to secure your account.`, url: link })) > 0;
  if (!m.contact_email || !m.email_verified || m.alerts_email !== 1) return pushed;
  const e = renderEmail("new_signin", { name: m.username, device: a.device || "a device", city: a.city, when: new Date(a.seenAt).toUTCString(), link });
  try { await d.mailer.send(m.contact_email, e.subject, e.html, e.text); return true; } catch { return pushed; } // a failed alert must not break sign-in or the poll
}

/** Portal sign-ins get the same new-place check as Jellyfin ones, so a thief cannot quietly seed a trusted place. */
export async function checkPortalSignin(d: AlertDeps, o: { jellyfinId: string; device: string; ip: string; cf?: CfInfo }) {
  const prior = await priorContext(d.db, o.jellyfinId, o.ip, o.cf?.city ?? null);
  const unusual = prior.hadHistory && !!o.ip && !prior.seenBefore;
  await recordPortalSignin(d.db, { ...o, unusual });
  if (unusual) await alertNewSignin(d, { userId: o.jellyfinId, device: o.device, city: o.cf?.city ?? null, seenAt: new Date().toISOString() });
}

export async function pollActivity(d: AlertDeps & { jf: Pick<Jellyfin, "activity"> }) {
  const last = await first<{ m: string | null }>(d.db, "SELECT MAX(seen_at) AS m FROM signins WHERE source = 'activity'");
  const firstPoll = !last?.m; // the first poll only backfills history; after that every new entry is reported, however late it arrives
  const since = last?.m ? new Date(Date.parse(last.m) - 10 * 60_000).toISOString() : new Date(Date.now() - 24 * 3600_000).toISOString();
  const parsed = (await d.jf.activity(since)).map(parseActivity).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => a.seenAt.localeCompare(b.seenAt));
  let inserted = 0, alerted = 0;
  for (const p of parsed) {
    if (p.device === OWN_CLIENT && (await isOwnAuth(d.db, p.userId, p.seenAt))) continue; // our own short-lived session, not a sign-in
    const city = await cityForIp(d.db, p.ip);
    const prior = await priorContext(d.db, p.userId, p.ip, city?.city ?? null);
    const unusual = !firstPoll && prior.hadHistory && !prior.seenBefore; // no flag for backfilled history, a first sign-in, or a known place
    const r = await run(d.db, "INSERT OR IGNORE INTO signins (source, jellyfin_id, device, ip, city, lat, lng, seen_at, unusual) VALUES ('activity',?,?,?,?,?,?,?,?)", p.userId, p.device, p.ip, city?.city ?? null, city?.lat ?? null, city?.lng ?? null, p.seenAt, unusual ? 1 : 0);
    if (r.meta.changes === 0) continue;
    inserted++;
    if (unusual && (await alertNewSignin(d, { userId: p.userId, device: p.device, city: city?.city ?? null, seenAt: p.seenAt }))) alerted++;
  }
  return { inserted, alerted };
}

export const round2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

export async function memberSignins(db: D1Database, jellyfinId: string) {
  const since = new Date(Date.now() - 90 * 86400_000).toISOString();
  return (await all<any>(db, "SELECT id, source, device, ip, city, lat, lng, seen_at FROM signins WHERE jellyfin_id = ? AND seen_at > ? ORDER BY seen_at DESC LIMIT 100", jellyfinId, since))
    .map((r) => ({ id: r.id, source: r.source, device: r.device || null, ip: r.ip || null, city: r.city, lat: round2(r.lat), lng: round2(r.lng), seenAt: r.seen_at }));
}
export { audit };
