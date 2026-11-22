import { all, first, run } from "../db";
import { renderEmail } from "../emails";
import { getHistory } from "../history";
import { secureToken } from "../signins";
import { hasPush, sendPush, type PushDeps } from "../push";
import type { CronDeps } from "./types";
import { jellyfinForMembers } from "../addresses";

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const HOUR = 3600_000, DAY = 24 * HOUR;
type M = { jellyfin_id: string; username: string; contact_email: string; expires_at: string | null; seerr_user_id: number | null; hidden_history_json: string };

/** Records a notice and says whether it is new within `withinMs`. Set before sending, so a slow send cannot double up. */
async function once(db: D1Database, key: string, withinMs: number) {
  const seen = await first(db, "SELECT 1 AS x FROM notice_log WHERE key = ? AND at > ?", key, ago(withinMs));
  if (seen) return false;
  await run(db, "INSERT INTO notice_log (key, at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET at = excluded.at", key, new Date().toISOString());
  return true;
}
const pushDeps = (d: CronDeps): PushDeps => ({ db: d.db, vapid: d.env.VAPID_KEYS, baseUrl: d.baseUrl, fetch: d.fetch });
const members = (db: D1Database, flag: "alerts_email" | "weekly_on" | "ready_on") =>
  all<M>(db, `SELECT jellyfin_id, username, contact_email, expires_at, seerr_user_id, hidden_history_json FROM members WHERE ${flag} = 1 AND email_verified = 1 AND contact_email IS NOT NULL`);

/** Two playing sessions from different addresses at once: flag it (for the admin digest) and, if the member opted in, tell them once a day. */
export async function streamWarnings(d: CronDeps) {
  const playing = (await d.jf.sessions()).filter((s) => s.itemId && s.remoteIp);
  const ips = new Map<string, Set<string>>();
  for (const s of playing) (ips.get(s.userName.toLowerCase()) ?? ips.set(s.userName.toLowerCase(), new Set()).get(s.userName.toLowerCase())!).add(s.remoteIp!);
  let warned = 0;
  for (const m of await all<{ jellyfin_id: string; username: string; contact_email: string | null; email_verified: number; alerts_email: number }>(d.db, "SELECT jellyfin_id, username, contact_email, email_verified, alerts_email FROM members")) {
    const places = ips.get(m.username.toLowerCase())?.size ?? 0;
    if (places < 2) continue;
    await run(d.db, "INSERT OR IGNORE INTO notice_log (key, at) VALUES (?, ?)", `streamflag:${m.jellyfin_id}:${new Date().toISOString().slice(0, 10)}`, new Date().toISOString());
    const emailOk = m.alerts_email === 1 && !!m.email_verified && !!m.contact_email;
    if ((!emailOk && !(await hasPush(d.db, m.jellyfin_id))) || !(await once(d.db, `stream:${m.jellyfin_id}`, DAY))) continue;
    const link = `${d.baseUrl}/secure/${await secureToken(d.env.SESSION_SECRET, m.jellyfin_id)}`;
    if (await sendPush(pushDeps(d), m.jellyfin_id, { title: "Playing in two places", body: `Your account is playing from ${places} places at once. If that isn't you, tap to secure it.`, url: link })) warned++;
    if (!emailOk) continue;
    const e = renderEmail("stream_warning", { name: m.username, places, link });
    try { await d.mailer.send(m.contact_email!, e.subject, e.html, e.text); warned++; } catch { /* retried at the next poll */ }
  }
  return { warned };
}

/** Monday summary for members who opted in: what they watched, what is new, when access ends. */
export async function weeklySummaries(d: CronDeps) {
  const week = ago(7 * DAY);
  let sent = 0;
  for (const m of await members(d.db, "weekly_on")) {
    try {
      if (!(await once(d.db, `weekly:${m.jellyfin_id}`, 6 * DAY))) continue;
      const hidden = new Set<string>(JSON.parse(m.hidden_history_json || "[]"));
      const rows = (await getHistory(d.jf, d.env, m.jellyfin_id, hidden)).filter((r) => (r.lastPlayed ?? "") >= week);
      const minutes = rows.reduce((n, r) => n + (r.runtimeMinutes ?? 0), 0);
      const watched = rows.length ? `You watched ${rows.length} ${rows.length === 1 ? "title" : "titles"} this week, about ${Math.max(1, Math.round(minutes / 60))} ${Math.round(minutes / 60) <= 1 ? "hour" : "hours"} in all.` : "You didn't watch anything this week.";
      const added = (await d.jf.userItems(m.jellyfin_id, { includeItemTypes: "Movie,Series", recursive: "true", sortBy: "DateCreated", sortOrder: "Descending", limit: "50", fields: "DateCreated" }))
        .filter((i) => (i.DateCreated ?? "") >= week).slice(0, 6).map((i) => String(i.Name));
      const left = m.expires_at && m.expires_at > new Date().toISOString() ? new Date(m.expires_at).toUTCString().slice(5, 16) : null;
      const e = renderEmail("weekly", { name: m.username, watched, added, accessEnds: left, link: d.baseUrl });
      await d.mailer.send(m.contact_email, e.subject, e.html, e.text);
      sent++;
    } catch { /* one member's failure must not stop the rest */ }
  }
  return { sent };
}

/** "Your request is now in Jellyfin": for opted-in members, once per request, only for ones that became available in the last day. */
export async function readyRequests(d: CronDeps) {
  const base = jellyfinForMembers(d.env);
  let sent = 0;
  const who = await all<{ jellyfin_id: string; username: string; contact_email: string | null; email_ok: number; seerr_user_id: number }>(d.db,
    "SELECT jellyfin_id, username, contact_email, (ready_on = 1 AND email_verified = 1 AND contact_email IS NOT NULL) AS email_ok, seerr_user_id FROM members m WHERE seerr_user_id IS NOT NULL AND ((ready_on = 1 AND email_verified = 1 AND contact_email IS NOT NULL) OR EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.jellyfin_id = m.jellyfin_id))");
  for (const m of who) {
    try {
      for (const r of await d.seerr.userRequests(m.seerr_user_id)) {
        const done = r.media?.status === 5 && Date.parse(r.media?.updatedAt ?? r.updatedAt ?? "") > Date.now() - DAY;
        if (!done || !(await once(d.db, `ready:${r.id}`, 30 * DAY))) continue;
        const title = (await d.seerr.summary(r.media.mediaType, r.media.tmdbId).catch(() => null))?.title;
        if (!title) continue;
        const id = await d.jf.libraryItem(r.media.mediaType, r.media.tmdbId).then((x) => x.id, () => null);
        const link = id ? `${base}/web/#/details?id=${id}` : `${base}/web/#/search?query=${encodeURIComponent(title)}`;
        const pushed = (await sendPush(pushDeps(d), m.jellyfin_id, { title: `${title} is ready`, body: "It's in Jellyfin now. Tap to open it.", url: link })) > 0;
        if (m.email_ok) { const e = renderEmail("request_ready", { name: m.username, title, link }); await d.mailer.send(m.contact_email!, e.subject, e.html, e.text); sent++; }
        else if (pushed) sent++;
      }
    } catch { /* retried next hour */ }
  }
  return { sent };
}

/** One email a day to the admin address in Settings, only when something looks odd. */
export async function adminDigest(d: CronDeps) {
  const to = (await first<{ value: string }>(d.db, "SELECT value FROM settings WHERE key = 'digest_email'"))?.value;
  if (!to || !(await once(d.db, "digest", 20 * HOUR))) return { sent: false };
  const since = ago(DAY), lines: string[] = [];
  const fails = await all<{ username: string; n: number }>(d.db, "SELECT username, COUNT(*) AS n FROM signin_failures WHERE at > ? GROUP BY username ORDER BY n DESC", since);
  const total = fails.reduce((n, f) => n + f.n, 0);
  if (total >= 5) lines.push(`${total} failed sign-ins. Most: ${fails.slice(0, 3).map((f) => `${f.username} (${f.n})`).join(", ")}.`);
  for (const r of await all<{ username: string; n: number }>(d.db, "SELECT m.username, COUNT(DISTINCT s.city) AS n FROM signins s JOIN members m ON m.jellyfin_id = s.jellyfin_id WHERE s.seen_at > ? AND s.city IS NOT NULL GROUP BY s.jellyfin_id HAVING n >= 3", since))
    lines.push(`${r.username} signed in from ${r.n} different cities.`);
  const unusual = (await first<{ n: number }>(d.db, "SELECT COUNT(*) AS n FROM signins WHERE seen_at > ? AND unusual = 1", since))?.n ?? 0;
  if (unusual) lines.push(`${unusual} sign-in${unusual === 1 ? "" : "s"} from somewhere new.`);
  const sharing = await all<{ username: string }>(d.db, "SELECT DISTINCT m.username FROM notice_log n JOIN members m ON n.key LIKE 'streamflag:' || m.jellyfin_id || ':%' WHERE n.at > ?", since);
  if (sharing.length) lines.push(`Playing from two places at once: ${sharing.map((s) => s.username).join(", ")}.`);
  for (const r of await all<{ username: string }>(d.db, "SELECT username FROM members WHERE secured_at > ?", since)) lines.push(`${r.username} pressed "This wasn't me".`);
  if (!lines.length) return { sent: false };
  const e = renderEmail("admin_digest", { lines, link: `${d.baseUrl}/admin/security` });
  try { await d.mailer.send(to, e.subject, e.html, e.text); } catch { return { sent: false }; }
  return { sent: true };
}
