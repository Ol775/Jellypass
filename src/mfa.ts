import { decryptSecret, encryptSecret } from "./keys";
import { randomToken, sha256 } from "./auth";
import { all, first, run } from "./db";
import type { Env } from "./env";

/** Optional two-step sign-in: an authenticator app code (TOTP, RFC 6238) or a passkey (WebAuthn). Either one switches the second step on. */

const enc = new TextEncoder();
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const b64u = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

/** --- TOTP --- */
export function base32(bytes: Uint8Array) {
  let bits = "", out = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
}
const unbase32 = (s: string) => {
  const bits = [...s].map((c) => B32.indexOf(c).toString(2).padStart(5, "0")).join("");
  return Uint8Array.from({ length: Math.floor(bits.length / 8) }, (_, i) => parseInt(bits.slice(i * 8, i * 8 + 8), 2));
};
export const newTotpSecret = () => base32(crypto.getRandomValues(new Uint8Array(20)));
export const totpUri = (secret: string, account: string) => `otpauth://totp/Jellypass:${encodeURIComponent(account)}?secret=${secret}&issuer=Jellypass&algorithm=SHA1&digits=6&period=30`;

export async function totpCode(secret: string, step: number) {
  const key = await crypto.subtle.importKey("raw", unbase32(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const msg = new DataView(new ArrayBuffer(8));
  msg.setUint32(0, Math.floor(step / 2 ** 32)); msg.setUint32(4, step >>> 0);
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg.buffer)), o = h[19] & 15;
  const n = ((h[o] & 0x7f) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 1_000_000;
  return String(n).padStart(6, "0");
}

/** The matching 30-second step within one step either side (clock drift), or null. */
export async function totpMatch(secret: string, code: string, at = Date.now()): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null;
  const now = Math.floor(at / 30_000);
  for (const step of [now, now - 1, now + 1]) if ((await totpCode(secret, step)) === code) return step;
  return null;
}

/** Verify a TOTP code and use its step up, so the same code cannot be replayed (the UPDATE only wins once per step). */
export async function useTotp(env: Env, id: string, code: string): Promise<boolean> {
  const row = await first<{ secret: string; last_step: number }>(env.DB, "SELECT secret, last_step FROM mfa_totp WHERE jellyfin_id = ? AND enabled = 1", id);
  if (!row) return false;
  const step = await totpMatch(await openSecret(env, id, row.secret), code);
  if (step === null || step <= row.last_step) return false;
  return (await run(env.DB, "UPDATE mfa_totp SET last_step = ? WHERE jellyfin_id = ? AND last_step < ?", step, id, step)).meta.changes === 1;
}

export const sealSecret = (env: Env, id: string, secret: string) => encryptSecret(env.KEYS_SECRET ?? env.SESSION_SECRET, `totp:${id}`, secret);
export const openSecret = (env: Env, id: string, stored: string) => decryptSecret(env.KEYS_SECRET ?? env.SESSION_SECRET, `totp:${id}`, stored);

/** --- Recovery codes: ten random characters, shown once, stored hashed, each works once. --- */
const norm = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, "");
export async function newRecoveryCodes(db: D1Database, id: string, count = 8) {
  await run(db, "DELETE FROM mfa_recovery WHERE jellyfin_id = ?", id);
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = base32(crypto.getRandomValues(new Uint8Array(7))).slice(0, 10).toLowerCase();
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
    await run(db, "INSERT INTO mfa_recovery (code_hash, jellyfin_id) VALUES (?,?)", await sha256(`recovery:${raw}`), id);
  }
  return codes;
}
export async function useRecovery(db: D1Database, id: string, code: string) {
  const c = norm(code);
  return c.length === 10 && (await run(db, "DELETE FROM mfa_recovery WHERE code_hash = ? AND jellyfin_id = ?", await sha256(`recovery:${c}`), id)).meta.changes === 1;
}

/** --- Which second steps does a member have? --- */
export async function mfaMethods(db: D1Database, id: string) {
  const r = await first<{ totp: number; passkeys: number }>(db, "SELECT (SELECT COUNT(*) FROM mfa_totp WHERE jellyfin_id = ?1 AND enabled = 1) AS totp, (SELECT COUNT(*) FROM passkeys WHERE jellyfin_id = ?1) AS passkeys", id);
  return { totp: !!r?.totp, passkey: (r?.passkeys ?? 0) > 0 };
}
/** Called when a method is added or removed: first one on hands out recovery codes and ends emailed-link sign-in; last one off clears everything. */
export async function afterChange(db: D1Database, id: string, wasOn: boolean): Promise<string[] | null> {
  const m = await mfaMethods(db, id), on = m.totp || m.passkey;
  if (on && !wasOn) {
    await run(db, "UPDATE members SET magic_on = 0 WHERE jellyfin_id = ?", id);
    await run(db, "DELETE FROM magic_links WHERE jellyfin_id = ?", id);
    return newRecoveryCodes(db, id);
  }
  if (!on) await run(db, "DELETE FROM mfa_recovery WHERE jellyfin_id = ?", id);
  return null;
}
export async function purgeMfa(db: D1Database, id: string) {
  for (const t of ["mfa_totp", "passkeys", "mfa_recovery", "mfa_challenges"]) await run(db, `DELETE FROM ${t} WHERE jellyfin_id = ?`, id);
}

/** --- Short-lived challenges --- */
export async function putChallenge(db: D1Database, key: string, id: string, challenge: string | null, minutes = 5) {
  await run(db, "DELETE FROM mfa_challenges WHERE expires_at <= ?", new Date().toISOString());
  await run(db, "INSERT OR REPLACE INTO mfa_challenges (key, jellyfin_id, challenge, expires_at) VALUES (?,?,?,?)", key, id, challenge, new Date(Date.now() + minutes * 60_000).toISOString());
}
export const getChallenge = (db: D1Database, key: string) => first<{ jellyfin_id: string; challenge: string | null }>(db, "SELECT jellyfin_id, challenge FROM mfa_challenges WHERE key = ? AND expires_at > ?", key, new Date().toISOString());
/** Claiming deletes the row, so a challenge can be answered once. */
export const spendChallenge = async (db: D1Database, key: string) => (await run(db, "DELETE FROM mfa_challenges WHERE key = ?", key)).meta.changes === 1;

/** The sign-in token the browser holds between the password and the second step. */
export const newPendingToken = () => randomToken(32);
export const pendingKey = async (token: string) => `sin:${await sha256(`mfa:${token}`)}`;

/** --- WebAuthn (passkeys as a second step; attestation is not asked for) --- */
export const rpFor = (env: Env) => { const u = new URL(env.PUBLIC_URL); return { id: u.hostname, origin: u.origin }; };

type Cbor = number | Uint8Array | string | Cbor[] | Map<Cbor, Cbor>;
/** Just enough CBOR for attestation objects and COSE keys: ints, byte/text strings, arrays and maps. Returns the value and the offset after it. */
export function cbor(b: Uint8Array, at = 0): [Cbor, number] {
  const major = b[at] >> 5, info = b[at] & 31;
  let i = at + 1, n = info;
  if (info === 24) n = b[i++]; else if (info === 25) { n = (b[i] << 8) | b[i + 1]; i += 2; } else if (info === 26) { n = new DataView(b.buffer, b.byteOffset + i, 4).getUint32(0); i += 4; } else if (info > 26) throw new Error("unsupported CBOR");
  if (major === 0) return [n, i];
  if (major === 1) return [-1 - n, i];
  if (major === 2) return [b.slice(i, i + n), i + n];
  if (major === 3) return [new TextDecoder().decode(b.slice(i, i + n)), i + n];
  if (major === 4) { const a: Cbor[] = []; for (let k = 0; k < n; k++) { const [v, j] = cbor(b, i); a.push(v); i = j; } return [a, i]; }
  if (major === 5) { const m = new Map<Cbor, Cbor>(); for (let k = 0; k < n; k++) { const [key, j] = cbor(b, i), [v, l] = cbor(b, j); m.set(key, v); i = l; } return [m, i]; }
  throw new Error("unsupported CBOR");
}

const sha = async (b: BufferSource | string) => new Uint8Array(await crypto.subtle.digest("SHA-256", typeof b === "string" ? enc.encode(b) : b));
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

type ClientData = { type: string; challenge: string; origin: string };
async function checkClient(rp: { origin: string }, clientDataJSON: string, type: string, challenge: string) {
  const raw = unb64u(clientDataJSON), cd = JSON.parse(new TextDecoder().decode(raw)) as ClientData;
  if (cd.type !== type || cd.challenge !== challenge || cd.origin !== rp.origin) throw new Error("passkey response did not match");
  return raw;
}
async function checkAuthData(rp: { id: string }, authData: Uint8Array) {
  if (authData.length < 37 || !same(authData.slice(0, 32), await sha(rp.id)) || !(authData[32] & 1)) throw new Error("passkey response did not match");
}

export const passkeyCreationOptions = (env: Env, user: { id: string; name: string }, challenge: string, existing: string[]) => ({
  challenge, rp: { name: "Jellypass", id: rpFor(env).id }, user: { id: b64u(enc.encode(user.id)), name: user.name, displayName: user.name },
  pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }], timeout: 60_000, attestation: "none",
  authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  excludeCredentials: existing.map((id) => ({ type: "public-key", id })),
});

/** Check a new passkey and return what to store: its id and public key (as a JWK) and algorithm. */
export async function verifyRegistration(env: Env, cred: { id: string; clientDataJSON: string; attestationObject: string }, challenge: string) {
  const rp = rpFor(env);
  await checkClient(rp, cred.clientDataJSON, "webauthn.create", challenge);
  const att = cbor(unb64u(cred.attestationObject))[0] as Map<string, Cbor>;
  const ad = att.get("authData") as Uint8Array;
  await checkAuthData(rp, ad);
  if (!(ad[32] & 0x40)) throw new Error("passkey response did not match");
  const idLen = (ad[53] << 8) | ad[54];
  const id = b64u(ad.slice(55, 55 + idLen));
  if (id !== cred.id) throw new Error("passkey response did not match");
  const key = cbor(ad, 55 + idLen)[0] as Map<number, Cbor>;
  const alg = key.get(3) as number, b = (k: number) => b64u(key.get(k) as Uint8Array);
  let jwk: JsonWebKey;
  if (alg === -7 && key.get(1) === 2 && key.get(-1) === 1) jwk = { kty: "EC", crv: "P-256", x: b(-2), y: b(-3) };
  else if (alg === -257 && key.get(1) === 3) jwk = { kty: "RSA", n: b(-1), e: b(-2), alg: "RS256" };
  else throw new Error("this passkey type is not supported");
  return { id, jwk: JSON.stringify(jwk), alg };
}

export const passkeyRequestOptions = (env: Env, challenge: string, ids: string[]) => ({
  challenge, rpId: rpFor(env).id, timeout: 60_000, userVerification: "preferred", allowCredentials: ids.map((id) => ({ type: "public-key", id })),
});

/** WebAuthn gives ECDSA signatures as DER; WebCrypto wants r||s. */
function derToRaw(der: Uint8Array) {
  let i = 3; const rl = der[i++]; const r = der.slice(i, i + rl); i += rl + 1; const sl = der[i++]; const s = der.slice(i, i + sl);
  const fix = (x: Uint8Array) => { while (x.length > 32 && x[0] === 0) x = x.slice(1); const o = new Uint8Array(32); o.set(x, 32 - x.length); return o; };
  return Uint8Array.from([...fix(r), ...fix(s)]);
}

/** Verify a sign-in assertion against a stored passkey. Returns the new signature counter. Throws if anything is off. */
export async function verifyAssertion(env: Env, stored: { jwk: string; alg: number; counter: number }, cred: { clientDataJSON: string; authenticatorData: string; signature: string }, challenge: string) {
  const rp = rpFor(env);
  const cd = await checkClient(rp, cred.clientDataJSON, "webauthn.get", challenge);
  const ad = unb64u(cred.authenticatorData);
  await checkAuthData(rp, ad);
  const counter = new DataView(ad.buffer, ad.byteOffset + 33, 4).getUint32(0);
  if ((counter || stored.counter) && counter <= stored.counter) throw new Error("passkey response did not match"); // a copied passkey would replay an old counter
  const signed = Uint8Array.from([...ad, ...(await sha(cd))]), sig = unb64u(cred.signature);
  const ec = stored.alg === -7;
  const key = await crypto.subtle.importKey("jwk", JSON.parse(stored.jwk), ec ? { name: "ECDSA", namedCurve: "P-256" } : { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify(ec ? { name: "ECDSA", hash: "SHA-256" } : "RSASSA-PKCS1-v1_5", key, ec ? derToRaw(sig) : sig, signed);
  if (!ok) throw new Error("passkey response did not match");
  return counter;
}

export const listPasskeys = (db: D1Database, id: string) => all<{ id: string; name: string; created_at: string; last_used_at: string | null }>(db, "SELECT id, name, created_at, last_used_at FROM passkeys WHERE jellyfin_id = ? ORDER BY created_at", id);
