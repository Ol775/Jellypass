import { audit } from "./audit";
import { randomToken, sha256 } from "./auth";
import { first, run } from "./db";
import { compareDefault } from "./members";
import type { Env } from "./env";
import type { Jellyfin } from "./jellyfin";
import { getPreset, presetToPolicy } from "./presets";
import type { Seerr } from "./seerr";

export const hashToken = sha256;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (s: string) => EMAIL.test(s) && s.length <= 200;

export async function createInvite(db: D1Database, o: { presetId: string; email?: string; maxUses: number; expiresInDays: number; createdBy: string; sent?: boolean }) {
  const id = crypto.randomUUID(), token = randomToken(24), now = new Date();
  await run(db, "INSERT INTO invites (id, token_hash, preset_id, email, max_uses, uses, expires_at, created_by, created_at, last_sent_at) VALUES (?,?,?,?,?,0,?,?,?,?)",
    id, await hashToken(token), o.presetId, o.email ?? null, o.maxUses, new Date(now.getTime() + o.expiresInDays * 86400_000).toISOString(), o.createdBy, now.toISOString(), o.sent ? now.toISOString() : null);
  return { id, token };
}

type InviteRow = { id: string; preset_id: string; email: string | null; expires_at: string };
export async function findValidInvite(db: D1Database, token: string) {
  return first<InviteRow>(db, "SELECT id, preset_id, email, expires_at FROM invites WHERE token_hash = ? AND uses < max_uses AND expires_at > ?", await hashToken(token), new Date().toISOString());
}

export type RedeemInput = { token: string; username: string; password: string; contactEmail?: string };
export type RedeemResult = { ok: true; id: string; name: string } | { ok: false; status: 400 | 409 | 410 | 500 | 502; error: string };
// No '@': Seerr identifies imported users by an email-shaped name, so an email-like username could impersonate someone there.
const USERNAME = /^[\p{L}\p{N} _.'-]{1,64}$/u;
const release = (db: D1Database, id: string) => run(db, "UPDATE invites SET uses = MAX(uses - 1, 0) WHERE id = ?", id);

export async function redeemInvite(d: { env: Env; jf: Jellyfin; seerr: Seerr }, input: RedeemInput): Promise<RedeemResult> {
  const { env } = d, db = env.DB;
  const GONE: RedeemResult = { ok: false, status: 410, error: "this invite is not valid any more" };
  // Check the token first so the username check below cannot be used to probe Jellyfin accounts.
  if (!(await findValidInvite(db, input.token))) return GONE;

  const name = input.username.trim();
  if (!USERNAME.test(name)) return { ok: false, status: 400, error: "usernames can use letters, numbers, spaces and _ . ' - (up to 64 characters)" };
  if (env.ENVIRONMENT === "beta" && !name.startsWith("beta-")) return { ok: false, status: 400, error: "in beta, usernames must start with beta-" };
  if (input.password.length < 8) return { ok: false, status: 400, error: "choose a password of at least 8 characters" };
  const email = input.contactEmail?.trim() || null;
  if (email && !isEmail(email)) return { ok: false, status: 400, error: "that email address does not look right" };
  try {
    if ((await d.jf.listUsers()).some((u) => u.name.toLowerCase() === name.toLowerCase())) return { ok: false, status: 409, error: "that username is taken, try another" };
  } catch { return { ok: false, status: 502, error: "could not reach Jellyfin, try again" }; }

  // Atomic claim: a single-use invite can only be won once, however many requests race.
  const claimed = await first<InviteRow>(db, "UPDATE invites SET uses = uses + 1 WHERE token_hash = ? AND uses < max_uses AND expires_at > ? RETURNING id, preset_id, email, expires_at", await hashToken(input.token), new Date().toISOString());
  if (!claimed) return GONE;
  const preset = await getPreset(db, claimed.preset_id);
  if (!preset) { await release(db, claimed.id); return { ok: false, status: 500, error: "this invite's access level no longer exists" }; }

  let user;
  try { user = await d.jf.createUser(name, input.password); } catch { await release(db, claimed.id); return { ok: false, status: 502, error: "could not create the account, try again" }; }
  // Only give the invite back once the half-made account is really gone; otherwise keep it spent,
  // lock the account and record it for an admin to clean up.
  const undo = async () => {
    try { await d.jf.deleteUser(user.id); await release(db, claimed.id); }
    catch {
      await d.jf.setPolicy(user.id, { IsDisabled: true }).catch(() => {});
      await audit(db, name, "redeem.orphan", user.id, { invite: claimed.id });
    }
  };
  try { await d.jf.setPolicy(user.id, presetToPolicy(preset)); } catch { await undo(); return { ok: false, status: 502, error: "could not set up the account, try again" }; }
  const expires = preset.membershipDays ? new Date(Date.now() + preset.membershipDays * 86400_000).toISOString() : null;
  const verified = email && claimed.email && email.toLowerCase() === claimed.email.toLowerCase() ? 1 : 0;
  try {
    await run(db, "INSERT INTO members (jellyfin_id, username, contact_email, email_verified, expires_at, preset_id, invited_by, onboarding_state, compare_on) VALUES (?,?,?,?,?,?,?,?,?)", user.id, name, email, verified, expires, preset.id, claimed.id, '{"kind":"new","step":"device"}', compareDefault(name));
  } catch { await undo(); return { ok: false, status: 500, error: "could not save the account, try again" }; }

  let sid: number | null = null;
  try {
    sid = await d.seerr.importUser(user.id);
    await d.seerr.setPermissions(sid, preset.requestRights); // never leave Seerr's defaults in place
    await run(db, "UPDATE members SET seerr_user_id = ? WHERE jellyfin_id = ?", sid, user.id); // rights are in place, so keep the account
    // Only a verified address is pushed to Seerr, and only for Seerr's own emails: if it is refused the member keeps working Seerr access.
    if (email && verified) await d.seerr.setEmail(sid, email).catch((e) => audit(db, name, "seerr.email_failed", user.id, { error: (e as Error).message }));
  } catch (e) {
    if (sid !== null) await d.seerr.deleteUser(sid).catch(() => {}); // fail closed: no Seerr account beats one with default rights
    await audit(db, name, sid === null ? "seerr.import_failed" : "seerr.permissions_failed", user.id, { error: (e as Error).message });
  }
  await audit(db, name, "invite.redeem", user.id, { invite: claimed.id, preset: preset.name });
  return { ok: true, id: user.id, name };
}
