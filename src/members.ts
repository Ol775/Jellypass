import { first, run } from "./db";
import { purgeMfa } from "./mfa";

export interface MemberRow {
  jellyfin_id: string; username: string; contact_email: string | null; email_verified: number; expires_at: string | null;
  onboarding_state: string; invited_by: string | null; preset_id: string | null; hidden_history_json: string;
  reminder_days_sent: string; reminders_on: number; seerr_user_id: number | null; created_at: string; alerts_email: number; alerts_banner: number; weekly_on: number; ready_on: number; password_changed_at: string | null; compare_on: number; magic_on: number;
}
export const getMember = (db: D1Database, id: string) => first<MemberRow>(db, "SELECT * FROM members WHERE jellyfin_id = ?", id);

/** Compare is on for new members, except service and test accounts ("admin", "zTest", "zTest1"...), which stay out of other members' Compare lists. */
export const compareDefault = (username: string) => (/^(admin|ztest\d*)$/i.test(username.trim()) ? 0 : 1);

/** Existing Jellyfin users have no row until they first sign in to Jellypass. Returns true if it was created. */
export async function ensureMember(db: D1Database, id: string, username: string): Promise<boolean> {
  const r = await run(db, "INSERT OR IGNORE INTO members (jellyfin_id, username, onboarding_state, compare_on) VALUES (?,?,?,?)", id, username, '{"kind":"existing","step":"welcome"}', compareDefault(username));
  if (r.meta.changes > 0) return true;
  await run(db, "UPDATE members SET username = ? WHERE jellyfin_id = ?", username, id);
  return false;
}

/** Every Jellypass row about one member (their sessions, sign-in places, ratings, push devices, help messages). The audit log is kept as the admin's record. */
export async function purgeMember(db: D1Database, id: string) {
  for (const t of ["members", "reset_codes", "email_codes", "signins", "own_auths", "ratings", "push_subscriptions", "magic_links", "help_messages", "sessions"]) await run(db, `DELETE FROM ${t} WHERE jellyfin_id = ?`, id);
  await purgeMfa(db, id);
}
