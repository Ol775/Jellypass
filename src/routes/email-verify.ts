import { emailOn } from "../mail";
import { Hono } from "hono";
import { now, rateClear, rateReserve, requireSession, type AppEnv } from "../auth";
import { hashCode, sixDigitCode } from "../codes";
import { first, run } from "../db";
import { renderEmail } from "../emails";
import { ensureMember } from "../members";
import { markOwnAuth } from "../signins";

const MAX_ATTEMPTS = 5;
export const emailVerifyRoutes = new Hono<AppEnv>();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

emailVerifyRoutes.post("/api/email/send-code", requireSession, async (c) => {
  if (!emailOn(c.env)) return c.json({ error: "Email is turned off on this server." }, 409);
  const s = c.get("session");
  const body = await c.req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim();
  if (!EMAIL.test(email) || email.length > 200) return c.json({ error: "enter a valid email address" }, 400);
  // The recovery address decides who can reset the password, so changing it needs the current password.
  if (!(await rateReserve(c.env.DB, `reauth:${s.jellyfinId}`, 5, 900))) return c.json({ error: "too many attempts, try again later" }, 429);
  let who;
  try { who = await c.var.jf.authenticate(s.username, String(body.password ?? "")); } catch { return c.json({ error: "jellyfin unavailable" }, 503); }
  if (!who || who.id !== s.jellyfinId) return c.json({ error: "that password is not right" }, 403);
  await markOwnAuth(c.env.DB, s.jellyfinId);
  await rateClear(c.env.DB, `reauth:${s.jellyfinId}`);
  if (!(await rateReserve(c.env.DB, `emailcode:cool:${s.jellyfinId}`, 1, 30))) return c.json({ error: "wait 30 seconds before asking for another code" }, 429);
  // Caps so this cannot be used to spam an address with Jellypass-branded email.
  if (!(await rateReserve(c.env.DB, `emailcode:to:${email.toLowerCase()}`, 3, 3600)) || !(await rateReserve(c.env.DB, `emailcode:acct:${s.jellyfinId}`, 10, 86400)))
    return c.json({ error: "too many codes requested, try again later" }, 429);
  await ensureMember(c.env.DB, s.jellyfinId, s.username);
  const code = sixDigitCode();
  await run(c.env.DB, "INSERT INTO email_codes (jellyfin_id, email, code_hash, attempts, expires_at) VALUES (?,?,?,0,?) ON CONFLICT(jellyfin_id) DO UPDATE SET email = excluded.email, code_hash = excluded.code_hash, attempts = 0, expires_at = excluded.expires_at",
    s.jellyfinId, email, await hashCode(c.env, `email:${s.jellyfinId}`, code), new Date(Date.now() + 10 * 60_000).toISOString());
  const e = renderEmail("verify_email", { code, minutes: 10 });
  await c.var.mailer.send(email, e.subject, e.html, e.text, e.inline);
  return c.json({ ok: true });
});

emailVerifyRoutes.post("/api/email/confirm", requireSession, async (c) => {
  const s = c.get("session");
  const code = String((await c.req.json().catch(() => ({}))).code ?? "");
  const BAD = { error: "that code is not valid or has expired" };
  const row = await first<{ email: string; code_hash: string; expires_at: string }>(c.env.DB, "SELECT email, code_hash, expires_at FROM email_codes WHERE jellyfin_id = ?", s.jellyfinId);
  if (!row || row.expires_at <= now()) return c.json(BAD, 400);
  const spent = await first<{ attempts: number }>(c.env.DB, "UPDATE email_codes SET attempts = attempts + 1 WHERE jellyfin_id = ? AND attempts < ? RETURNING attempts", s.jellyfinId, MAX_ATTEMPTS);
  if (!spent) return c.json(BAD, 400);
  if (row.code_hash !== (await hashCode(c.env, `email:${s.jellyfinId}`, code))) {
    if (spent.attempts >= MAX_ATTEMPTS) await run(c.env.DB, "DELETE FROM email_codes WHERE jellyfin_id = ?", s.jellyfinId);
    return c.json(BAD, 400);
  }
  const prev = await first<{ contact_email: string | null; email_verified: number }>(c.env.DB, "SELECT contact_email, email_verified FROM members WHERE jellyfin_id = ?", s.jellyfinId);
  await run(c.env.DB, "UPDATE members SET contact_email = ?, email_verified = 1 WHERE jellyfin_id = ?", row.email, s.jellyfinId);
  await run(c.env.DB, "DELETE FROM magic_links WHERE jellyfin_id = ?", s.jellyfinId); // a sign-in link already sent to the old address stops working
  if (prev?.email_verified && prev.contact_email && prev.contact_email.toLowerCase() !== row.email.toLowerCase()) {
    const e = renderEmail("email_changed", { name: s.username, when: new Date().toUTCString() });
    await c.var.mailer.send(prev.contact_email, e.subject, e.html, e.text, e.inline).catch(() => {}); // warn the old address
  }
  await run(c.env.DB, "DELETE FROM email_codes WHERE jellyfin_id = ?", s.jellyfinId);
  const sid = await first<{ seerr_user_id: number | null }>(c.env.DB, "SELECT seerr_user_id FROM members WHERE jellyfin_id = ?", s.jellyfinId);
  if (sid?.seerr_user_id) await c.var.seerr.setEmail(sid.seerr_user_id, row.email).catch(() => {}); // now verified, so Seerr may have it
  return c.json({ ok: true });
});
