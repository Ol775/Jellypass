import { emailOn } from "../mail";
import { Hono } from "hono";
import { endSessionsFor, now, rateClear, rateReserve, type AppEnv } from "../auth";
import { audit } from "../audit";
import { hashCode, sixDigitCode } from "../codes";
import { all, first, run } from "../db";
import { renderEmail } from "../emails";
import type { MemberRow } from "../members";

const CODE_MINUTES = 10, MAX_ATTEMPTS = 5, COOLDOWN_SEC = 30, MIN_PASSWORD = 8;
const GENERIC = { ok: true, message: "If that matches an account with a confirmed email address, a code is on its way." };

export const resetRoutes = new Hono<AppEnv>();

/** Username, or a *verified* contact email. Unverified addresses never receive reset codes. */
async function findMember(db: D1Database, identifier: string): Promise<MemberRow | null> {
  const id = identifier.trim().toLowerCase();
  // Matched in JS: SQLite's lower() only folds ASCII, so "Élodie" would never match "élodie".
  const rows = (await all<MemberRow>(db, "SELECT * FROM members WHERE email_verified = 1 AND contact_email IS NOT NULL"))
    .filter((m) => m.username.toLowerCase() === id || m.contact_email!.toLowerCase() === id);
  return rows.length === 1 ? rows[0] : null; // ambiguous matches are treated as no match
}

resetRoutes.post("/api/reset/request", async (c) => {
  if (!emailOn(c.env)) return c.json({ error: "Email is turned off on this server." }, 409);
  const body = await c.req.json().catch(() => ({}));
  const identifier = String(body.identifier ?? "").trim().toLowerCase();
  if (!identifier || identifier.length > 200) return c.json({ error: "enter your username or email" }, 400);
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  // Both limits apply whether or not the account exists, so the response never reveals it.
  if (!(await rateReserve(c.env.DB, `reset:cool:${identifier}`, 1, COOLDOWN_SEC))) return c.json({ error: "wait 30 seconds before asking for another code" }, 429);
  if (!(await rateReserve(c.env.DB, `reset:ip:${ip}`, 10, 3600))) return c.json({ error: "too many requests, try again later" }, 429);

  const work = (async () => {
    const m = await findMember(c.env.DB, identifier);
    if (!m) return;
    // Per-account cap on codes, silent so it cannot be used to detect accounts. Not reset by new codes.
    if (!(await rateReserve(c.env.DB, `reset:issue:${m.jellyfin_id}`, 5, 3600))) return;
    const code = sixDigitCode();
    await run(c.env.DB, "INSERT INTO reset_codes (jellyfin_id, code_hash, attempts, expires_at, last_sent_at) VALUES (?,?,0,?,?) ON CONFLICT(jellyfin_id) DO UPDATE SET code_hash = excluded.code_hash, attempts = 0, expires_at = excluded.expires_at, last_sent_at = excluded.last_sent_at",
      m.jellyfin_id, await hashCode(c.env, `reset:${m.jellyfin_id}`, code), new Date(Date.now() + CODE_MINUTES * 60_000).toISOString(), now());
    const e = renderEmail("reset_code", { code, minutes: CODE_MINUTES });
    await c.var.mailer.send(m.contact_email!, e.subject, e.html, e.text, e.inline);
  })().catch(() => {}); // delivery failures must not change the response
  try { c.executionCtx.waitUntil(work); } catch { await work; }
  return c.json(GENERIC);
});

resetRoutes.post("/api/reset/verify", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const code = String(body.code ?? ""), newPassword = String(body.newPassword ?? "");
  const BAD = { error: "that code is not valid or has expired" };
  if (newPassword.length < MIN_PASSWORD) return c.json({ error: `choose a password of at least ${MIN_PASSWORD} characters` }, 400);
  const m = await findMember(c.env.DB, String(body.identifier ?? ""));
  if (!m) return c.json(BAD, 400);
  const row = await first<{ code_hash: string; attempts: number; expires_at: string }>(c.env.DB, "SELECT code_hash, attempts, expires_at FROM reset_codes WHERE jellyfin_id = ?", m.jellyfin_id);
  if (!row || row.expires_at <= now() || row.attempts >= MAX_ATTEMPTS) return c.json(BAD, 400);
  // One hourly guess budget per account, shared by every code issued in that hour. It is spent only
  // when a live code exists (so junk requests cannot drain it) and refunded when the guess is right.
  // Residual risk: someone who can trigger codes can burn the budget; an admin can reset by hand.
  if (!(await rateReserve(c.env.DB, `reset:fail:${m.jellyfin_id}`, 10, 3600))) return c.json(BAD, 400);

  // Spend the attempt first (atomically) so parallel guesses cannot exceed the limit.
  const spent = await first<{ attempts: number }>(c.env.DB, "UPDATE reset_codes SET attempts = attempts + 1 WHERE jellyfin_id = ? AND attempts < ? RETURNING attempts", m.jellyfin_id, MAX_ATTEMPTS);
  if (!spent) return c.json(BAD, 400);
  if (row.code_hash !== (await hashCode(c.env, `reset:${m.jellyfin_id}`, code))) {
    if (spent.attempts >= MAX_ATTEMPTS) await run(c.env.DB, "DELETE FROM reset_codes WHERE jellyfin_id = ?", m.jellyfin_id);
    return c.json(BAD, 400);
  }
  await run(c.env.DB, "DELETE FROM reset_codes WHERE jellyfin_id = ?", m.jellyfin_id); // single use
  await rateClear(c.env.DB, `reset:fail:${m.jellyfin_id}`);

  try {
    await c.var.jf.setPassword(m.jellyfin_id, newPassword);
    await c.var.jf.deleteDevices(m.jellyfin_id);
  } catch { return c.json({ error: "could not change the password right now, try again" }, 503); }
  await endSessionsFor(c.env.DB, m.jellyfin_id);
  await run(c.env.DB, "UPDATE members SET password_changed_at = ? WHERE jellyfin_id = ?", new Date().toISOString(), m.jellyfin_id);
  await audit(c.env.DB, m.username, "password.reset", m.jellyfin_id);
  const e = renderEmail("password_changed", { name: m.username, when: new Date().toUTCString() });
  await c.var.mailer.send(m.contact_email!, e.subject, e.html, e.text, e.inline).catch(() => {});
  return c.json({ ok: true });
});
