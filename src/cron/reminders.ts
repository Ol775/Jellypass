import { all, run } from "../db";
import { renderEmail } from "../emails";
import type { CronDeps } from "./types";

const THRESHOLDS = [7, 1];

export async function sendReminders(d: CronDeps) {
  const now = Date.now();
  const rows = await all<{ jellyfin_id: string; username: string; contact_email: string; expires_at: string; reminder_days_sent: string }>(d.db,
    "SELECT jellyfin_id, username, contact_email, expires_at, reminder_days_sent FROM members WHERE reminders_on = 1 AND email_verified = 1 AND contact_email IS NOT NULL AND expires_at > ? AND expires_at <= ?",
    new Date(now).toISOString(), new Date(now + 7 * 86400_000).toISOString());
  let sent = 0;
  for (const m of rows) {
    const done: number[] = JSON.parse(m.reminder_days_sent || "[]");
    const daysLeft = Math.ceil((Date.parse(m.expires_at) - now) / 86400_000);
    const due = THRESHOLDS.filter((t) => daysLeft <= t && !done.includes(t));
    if (!due.length) continue;
    const e = renderEmail("access_ending", { name: m.username, date: new Date(m.expires_at).toUTCString().slice(5, 16), daysLeft });
    try { await d.mailer.send(m.contact_email, e.subject, e.html, e.text); } catch { continue; } // retried next day
    await run(d.db, "UPDATE members SET reminder_days_sent = ? WHERE jellyfin_id = ?", JSON.stringify([...done, ...due]), m.jellyfin_id);
    sent++;
  }
  return { sent };
}
