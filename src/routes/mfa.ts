import { Hono } from "hono";
import { audit } from "../audit";
import { rateClear, rateReserve, requireSession, type AppEnv } from "../auth";
import { first, run } from "../db";
import {
  afterChange, b64u, getChallenge, listPasskeys, mfaMethods, newRecoveryCodes, newTotpSecret, passkeyCreationOptions, passkeyRequestOptions, pendingKey, putChallenge, sealSecret,
  openSecret, spendChallenge, totpMatch, totpUri, useRecovery, useTotp, verifyAssertion, verifyRegistration,
} from "../mfa";
import { finishSignin } from "./auth";

export const mfaRoutes = new Hono<AppEnv>();
const FAILS = 8, WINDOW = 15 * 60;
const text = (v: unknown, max = 4000) => String(v ?? "").slice(0, max);

/* ---------- Turning it on and off (Account and security). Taking a method away or making new recovery codes needs the current password; setting one up does not. ---------- */

async function confirmPassword(c: any, password: unknown): Promise<Response | null> {
  const s = c.get("session");
  if (!(await rateReserve(c.env.DB, `mfachange:${s.jellyfinId}`, 5, 900))) return c.json({ error: "too many attempts, try again later" }, 429);
  let who;
  try { who = await c.var.jf.authenticate(s.username, text(password, 200)); } catch { return c.json({ error: "jellyfin unavailable" }, 503); }
  if (!who || who.id !== s.jellyfinId) return c.json({ error: "your current password is not right" }, 403);
  await rateClear(c.env.DB, `mfachange:${s.jellyfinId}`);
  return null;
}

mfaRoutes.get("/api/account/2fa", requireSession, async (c) => {
  const id = c.get("session").jellyfinId, m = await mfaMethods(c.env.DB, id);
  const left = await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM mfa_recovery WHERE jellyfin_id = ?", id);
  return c.json({ totp: m.totp, passkeys: (await listPasskeys(c.env.DB, id)).map((p) => ({ id: p.id, name: p.name, createdAt: p.created_at, lastUsedAt: p.last_used_at })), recoveryLeft: left?.n ?? 0 });
});

mfaRoutes.post("/api/account/2fa/totp/start", requireSession, async (c) => {
  const s = c.get("session"), b = await c.req.json().catch(() => ({}));
  if ((await mfaMethods(c.env.DB, s.jellyfinId)).totp) return c.json({ error: "an authenticator app is already set up" }, 409);
  const secret = newTotpSecret();
  await run(c.env.DB, "INSERT OR REPLACE INTO mfa_totp (jellyfin_id, secret, enabled, last_step, created_at) VALUES (?,?,0,0,?)", s.jellyfinId, await sealSecret(c.env, s.jellyfinId, secret), new Date().toISOString());
  return c.json({ secret, uri: totpUri(secret, s.username) });
});

mfaRoutes.post("/api/account/2fa/totp/enable", requireSession, async (c) => {
  const s = c.get("session"), b = await c.req.json().catch(() => ({}));
  if (!(await rateReserve(c.env.DB, `mfachange:${s.jellyfinId}`, 10, 900))) return c.json({ error: "too many attempts, try again later" }, 429);
  const row = await first<{ secret: string; enabled: number }>(c.env.DB, "SELECT secret, enabled FROM mfa_totp WHERE jellyfin_id = ?", s.jellyfinId);
  if (!row || row.enabled) return c.json({ error: "start the setup again" }, 409);
  const step = await totpMatch(await openSecret(c.env, s.jellyfinId, row.secret), text(b.code, 10).replace(/\s/g, ""));
  if (step === null) return c.json({ error: "that code is not right; check the time on your phone and try the next one" }, 400);
  const was = await mfaMethods(c.env.DB, s.jellyfinId), on = was.totp || was.passkey;
  await run(c.env.DB, "UPDATE mfa_totp SET enabled = 1, last_step = ? WHERE jellyfin_id = ?", step, s.jellyfinId);
  const recoveryCodes = await afterChange(c.env.DB, s.jellyfinId, on);
  await audit(c.env.DB, s.username, "2fa.totp_on", s.jellyfinId);
  return c.json({ ok: true, recoveryCodes });
});

mfaRoutes.delete("/api/account/2fa/totp", requireSession, async (c) => {
  const s = c.get("session"), b = await c.req.json().catch(() => ({}));
  const bad = await confirmPassword(c, b.password); if (bad) return bad;
  const wasOn = (m => m.totp || m.passkey)(await mfaMethods(c.env.DB, s.jellyfinId));
  await run(c.env.DB, "DELETE FROM mfa_totp WHERE jellyfin_id = ?", s.jellyfinId);
  await afterChange(c.env.DB, s.jellyfinId, wasOn);
  await audit(c.env.DB, s.username, "2fa.totp_off", s.jellyfinId);
  return c.json({ ok: true });
});

mfaRoutes.post("/api/account/2fa/passkey/options", requireSession, async (c) => {
  const s = c.get("session"), b = await c.req.json().catch(() => ({}));
  const challenge = b64u(crypto.getRandomValues(new Uint8Array(32)));
  await putChallenge(c.env.DB, `reg:${s.jellyfinId}`, s.jellyfinId, challenge);
  const ids = (await listPasskeys(c.env.DB, s.jellyfinId)).map((p) => p.id);
  return c.json(passkeyCreationOptions(c.env, { id: s.jellyfinId, name: s.username }, challenge, ids));
});

mfaRoutes.post("/api/account/2fa/passkey", requireSession, async (c) => {
  const s = c.get("session"), b = await c.req.json().catch(() => ({}));
  const ch = await getChallenge(c.env.DB, `reg:${s.jellyfinId}`);
  if (!ch?.challenge || !(await spendChallenge(c.env.DB, `reg:${s.jellyfinId}`))) return c.json({ error: "that took too long, try again" }, 409);
  let key;
  try { key = await verifyRegistration(c.env, { id: text(b.id, 1400), clientDataJSON: text(b.clientDataJSON), attestationObject: text(b.attestationObject, 20000) }, ch.challenge); }
  catch (e) { return c.json({ error: e instanceof Error ? e.message : "could not add that passkey" }, 400); }
  const was = await mfaMethods(c.env.DB, s.jellyfinId), on = was.totp || was.passkey;
  const name = text(b.name, 40).trim() || "Passkey";
  try { await run(c.env.DB, "INSERT INTO passkeys (id, jellyfin_id, jwk, alg, name, created_at) VALUES (?,?,?,?,?,?)", key.id, s.jellyfinId, key.jwk, key.alg, name, new Date().toISOString()); }
  catch { return c.json({ error: "that passkey is already added" }, 409); }
  const recoveryCodes = await afterChange(c.env.DB, s.jellyfinId, on);
  await audit(c.env.DB, s.username, "2fa.passkey_add", s.jellyfinId);
  return c.json({ ok: true, recoveryCodes });
});

mfaRoutes.delete("/api/account/2fa/passkey/:id", requireSession, async (c) => {
  const s = c.get("session"), b = await c.req.json().catch(() => ({}));
  const bad = await confirmPassword(c, b.password); if (bad) return bad;
  const wasOn = (m => m.totp || m.passkey)(await mfaMethods(c.env.DB, s.jellyfinId));
  const r = await run(c.env.DB, "DELETE FROM passkeys WHERE id = ? AND jellyfin_id = ?", c.req.param("id"), s.jellyfinId);
  if (r.meta.changes !== 1) return c.json({ error: "that passkey is already gone" }, 404);
  await afterChange(c.env.DB, s.jellyfinId, wasOn);
  await audit(c.env.DB, s.username, "2fa.passkey_remove", s.jellyfinId);
  return c.json({ ok: true });
});

mfaRoutes.post("/api/account/2fa/recovery", requireSession, async (c) => {
  const s = c.get("session"), b = await c.req.json().catch(() => ({}));
  const bad = await confirmPassword(c, b.password); if (bad) return bad;
  const m = await mfaMethods(c.env.DB, s.jellyfinId);
  if (!m.totp && !m.passkey) return c.json({ error: "turn on two-step sign-in first" }, 409);
  await audit(c.env.DB, s.username, "2fa.recovery_new", s.jellyfinId);
  return c.json({ recoveryCodes: await newRecoveryCodes(c.env.DB, s.jellyfinId) });
});

/* ---------- The second step at sign-in. The token comes from POST /api/signin and works for 5 minutes. ---------- */

/** Failed second-step guesses are counted per member (not per token), so asking for fresh tokens does not give fresh guesses. */
async function pending(c: any, token: unknown) {
  const key = await pendingKey(text(token, 200)), ch = await getChallenge(c.env.DB, key);
  return ch ? { key, id: ch.jellyfin_id, challenge: ch.challenge } : null;
}
async function complete(c: any, key: string, id: string, rateKey: string) {
  if (!(await spendChallenge(c.env.DB, key))) return c.json({ error: "sign in again" }, 401); // already used
  let u;
  try { u = await c.var.jf.getUser(id); } catch { return c.json({ error: "jellyfin unavailable" }, 503); }
  if (!u || u.isDisabled) return c.json({ error: "sign in again" }, 401);
  await rateClear(c.env.DB, rateKey);
  return finishSignin(c, { id: u.id, name: u.name, isAdmin: u.isAdmin });
}
const gone = (c: any) => c.json({ error: "that sign-in timed out, start again" }, 401);
const wrong = (c: any) => c.json({ error: "that code is not right" }, 401);

mfaRoutes.post("/api/signin/2fa", async (c) => {
  const b = await c.req.json().catch(() => ({})), p = await pending(c, b.token);
  if (!p) return gone(c);
  const rateKey = `mfa:user:${p.id}`;
  if (!(await rateReserve(c.env.DB, rateKey, FAILS, WINDOW))) return c.json({ error: "too many attempts, try again later" }, 429);
  const code = text(b.code, 40).replace(/\s/g, "");
  if (/^\d{6}$/.test(code) ? await useTotp(c.env, p.id, code) : await useRecovery(c.env.DB, p.id, code)) return complete(c, p.key, p.id, rateKey);
  return wrong(c);
});

mfaRoutes.post("/api/signin/passkey/options", async (c) => {
  const b = await c.req.json().catch(() => ({})), p = await pending(c, b.token);
  if (!p) return gone(c);
  const ids = (await listPasskeys(c.env.DB, p.id)).map((k) => k.id);
  if (!ids.length) return c.json({ error: "no passkeys on this account" }, 409);
  const challenge = b64u(crypto.getRandomValues(new Uint8Array(32)));
  await putChallenge(c.env.DB, p.key, p.id, challenge);
  return c.json(passkeyRequestOptions(c.env, challenge, ids));
});

mfaRoutes.post("/api/signin/passkey", async (c) => {
  const b = await c.req.json().catch(() => ({})), p = await pending(c, b.token);
  if (!p?.challenge) return gone(c);
  const rateKey = `mfa:user:${p.id}`;
  if (!(await rateReserve(c.env.DB, rateKey, FAILS, WINDOW))) return c.json({ error: "too many attempts, try again later" }, 429);
  const stored = await first<{ jwk: string; alg: number; counter: number }>(c.env.DB, "SELECT jwk, alg, counter FROM passkeys WHERE id = ? AND jellyfin_id = ?", text(b.id, 1400), p.id);
  try {
    if (!stored) throw new Error("unknown passkey");
    const counter = await verifyAssertion(c.env, stored, { clientDataJSON: text(b.clientDataJSON), authenticatorData: text(b.authenticatorData), signature: text(b.signature) }, p.challenge);
    await run(c.env.DB, "UPDATE passkeys SET counter = ?, last_used_at = ? WHERE id = ?", counter, new Date().toISOString(), text(b.id, 1400));
  } catch { return wrong(c); }
  return complete(c, p.key, p.id, rateKey);
});
