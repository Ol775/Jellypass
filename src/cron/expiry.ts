import { endSessionsFor } from "../auth";
import { audit } from "../audit";
import { all, first, run } from "../db";
import type { CronDeps } from "./types";

/**
 * Jellyfin has no account expiry, so Jellypass disables expired members itself. Completion is recorded in
 * Jellypass (members.expiry_done) only after every step has succeeded, never inferred from Jellyfin's
 * disabled flag, so a half-finished revocation is retried on the next run. Every step is idempotent.
 */
export async function expireAccounts(d: CronDeps) {
  const due = await all<{ jellyfin_id: string; username: string; seerr_user_id: number | null }>(d.db, "SELECT jellyfin_id, username, seerr_user_id FROM members WHERE expires_at IS NOT NULL AND expires_at <= ? AND expiry_done = 0", new Date().toISOString());
  let expired = 0, failed = 0;
  for (const m of due) {
    try {
      const u = await d.jf.getUser(m.jellyfin_id);
      if (u?.isAdmin) continue; // admins never expire
      if (u) {
        await d.jf.setPolicy(m.jellyfin_id, { IsDisabled: true });
        await d.jf.deleteDevices(m.jellyfin_id);
      }
      await endSessionsFor(d.db, m.jellyfin_id);
      if (m.seerr_user_id) await d.seerr.setPermissions(m.seerr_user_id, "none"); // a failure here must be retried, so it is not swallowed
      await run(d.db, "UPDATE members SET expiry_done = 1 WHERE jellyfin_id = ?", m.jellyfin_id);
      if (u) { await audit(d.db, "system", "user.expire", m.jellyfin_id, { name: m.username }); expired++; } // an account already gone from Jellyfin is just closed off quietly
    } catch (e) {
      failed++;
      console.error("expiry step failed", m.jellyfin_id, (e as Error).message);
      // Visible to admins, once a day per member, so a stuck revocation is not silent.
      const recent = await first(d.db, "SELECT 1 AS x FROM audit WHERE action = 'expiry.failed' AND target = ? AND at > ?", m.jellyfin_id, new Date(Date.now() - 86400_000).toISOString().slice(0, 19) + "Z");
      if (!recent) await audit(d.db, "system", "expiry.failed", m.jellyfin_id, { name: m.username, error: (e as Error).message.slice(0, 200) });
    }
  }
  return { expired, failed };
}
