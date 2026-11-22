import { audit } from "./audit";
import { first, run, all } from "./db";
import { hashToken } from "./invites";
import type { Jellyfin } from "./jellyfin";
import { ensureMember } from "./members";

/**
 * Importer for a normalised jfa-go export. jfa-go keeps its data in a Badger database (EmailAddress,
 * UserExpiry and Invite records), which a Worker cannot read, so something outside the Worker has to turn
 * jfa-go's data into this shape. Writing that adapter needs read-only access to the real jfa-go, which is a
 * beta-checklist item. Outstanding invites keep their jfa-go code as the link token, so old emailed
 * links keep working once the old address redirects to /join/<code>.
 */
export interface JfaExport {
  users: Array<{ username: string; email?: string | null; expiry?: string | null }>;
  invites: Array<{ code: string; remainingUses: number; noLimit: boolean; validTill: string; email?: string | null; profile?: string | null }>;
}

const isDate = (s: unknown) => typeof s === "string" && !Number.isNaN(Date.parse(s));
export function parseExport(b: any): JfaExport {
  const bad = (m: string) => { throw new Error(m); };
  if (!b || !Array.isArray(b.users) || !Array.isArray(b.invites) || b.users.length > 2000 || b.invites.length > 2000) bad("the export needs users and invites lists");
  for (const u of b.users) if (typeof u?.username !== "string" || !u.username || (u.email != null && typeof u.email !== "string") || (u.expiry != null && !isDate(u.expiry))) bad("a user entry is malformed");
  for (const i of b.invites) if (typeof i?.code !== "string" || i.code.length < 8 || i.code.length > 200 || !Number.isInteger(i.remainingUses) || typeof i.noLimit !== "boolean" || !isDate(i.validTill) || (i.email != null && typeof i.email !== "string") || (i.profile != null && typeof i.profile !== "string")) bad("an invite entry is malformed");
  return b as JfaExport;
}

export async function migrate(d: { db: D1Database; jf: Pick<Jellyfin, "listUsers">; actor?: string }, exp: JfaExport, o: { dryRun: boolean; trustEmails?: boolean }) {
  const jfUsers = new Map((await d.jf.listUsers()).map((u) => [u.name.toLowerCase(), u]));
  const users = { matched: 0, unmatched: [] as string[], skippedAdmins: [] as string[] };
  for (const u of exp.users) {
    const j = jfUsers.get(u.username.toLowerCase());
    if (!j) { users.unmatched.push(u.username); continue; }
    if (j.isAdmin) { users.skippedAdmins.push(u.username); continue; }
    users.matched++;
    if (o.dryRun) continue;
    await ensureMember(d.db, j.id, j.name);
    // Only fill gaps, so a re-run never undoes what a member or admin has changed since.
    await run(d.db, "UPDATE members SET email_verified = CASE WHEN contact_email IS NULL AND ? IS NOT NULL THEN ? ELSE email_verified END, contact_email = COALESCE(contact_email, ?), expires_at = COALESCE(expires_at, ?) WHERE jellyfin_id = ?",
      u.email ?? null, o.trustEmails ? 1 : 0, u.email ?? null, u.expiry ? new Date(u.expiry).toISOString() : null, j.id);
  }

  const presets = new Map((await all<{ id: string; name: string }>(d.db, "SELECT id, name FROM presets")).map((p) => [p.name.toLowerCase(), p.id]));
  const invites = { imported: 0, alreadyImported: 0, skipped: [] as Array<{ code: string; reason: string }> };
  const now = new Date().toISOString();
  for (const i of exp.invites) {
    const masked = `${i.code.slice(0, 4)}…`; // codes are secrets: never echoed in full
    if (new Date(i.validTill).toISOString() <= now) { invites.skipped.push({ code: masked, reason: "expired" }); continue; }
    if (!i.noLimit && i.remainingUses <= 0) { invites.skipped.push({ code: masked, reason: "no uses left" }); continue; }
    const hash = await hashToken(i.code);
    if (await first(d.db, "SELECT 1 AS x FROM invites WHERE token_hash = ?", hash)) { invites.alreadyImported++; continue; }
    invites.imported++;
    if (o.dryRun) continue;
    await run(d.db, "INSERT OR IGNORE INTO invites (id, token_hash, preset_id, email, max_uses, uses, expires_at, created_by, created_at) VALUES (?,?,?,?,?,0,?,'migration',?)",
      crypto.randomUUID(), hash, presets.get((i.profile ?? "").toLowerCase()) ?? "preset-standard", i.email ?? null, i.noLimit ? 100 : Math.min(i.remainingUses, 100), new Date(i.validTill).toISOString(), now);
  }
  if (!o.dryRun) await audit(d.db, d.actor ?? "migration", "migrate.jfa_go", null, { users: users.matched, invites: invites.imported });
  return { dryRun: o.dryRun, users, invites };
}
