import { all, run } from "./db";

/** Web Push (RFC 8030) with VAPID (RFC 8292) and aes128gcm payload encryption (RFC 8188 / 8291), on WebCrypto only. VAPID_KEYS is one private JWK as JSON; the public key comes from its x and y. */
type Bytes = Uint8Array<ArrayBuffer>;
const enc = new TextEncoder();
export const b64u = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const cat = (...p: Bytes[]): Bytes => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };

/** Only the real browser push services may be called: the endpoint comes from the member's browser, so it must not become a way to reach anything else. */
export const PUSH_HOSTS = /^(fcm\.googleapis\.com|[a-z0-9-]+\.push\.services\.mozilla\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]*\.push\.apple\.com|[a-z0-9.-]*\.notify\.windows\.com)$/;
export function validEndpoint(endpoint: unknown): endpoint is string {
  try { const u = new URL(String(endpoint)); return u.protocol === "https:" && !u.username && !u.password && !u.port && PUSH_HOSTS.test(u.hostname) && String(endpoint).length < 1000; } catch { return false; }
}

const hkdf = async (salt: Bytes, ikm: Bytes, info: Bytes, bytes: number) =>
  new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]), bytes * 8));

/** RFC 8291 section 3-5. Optional `fixed` (sender key pair and salt) exists only so the RFC's test vector can be checked. */
export async function encryptPayload(payload: Bytes, uaPublic: Bytes, authSecret: Bytes, fixed?: { keys: CryptoKeyPair; salt: Bytes }): Promise<Bytes> {
  const as = fixed?.keys ?? (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const ua = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: ua }, as.privateKey, 256));
  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdf(authSecret, secret, cat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, prk, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, prk, enc.encode("Content-Encoding: nonce\0"), 12);
  const body = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]), cat(payload, new Uint8Array([2])));
  return cat(salt, new Uint8Array([0, 0, 0x10, 0]), new Uint8Array([asPublic.length]), asPublic, new Uint8Array(body));
}

type Jwk = JsonWebKey & { x: string; y: string; d: string };
function parseKeys(raw: string | undefined): Jwk | null {
  try { const j = JSON.parse(raw ?? ""); return j?.kty === "EC" && j.crv === "P-256" && j.x && j.y && j.d ? j : null; } catch { return null; }
}
/** The browser's applicationServerKey: the uncompressed public point. Null when push is not configured. */
export function vapidPublicKey(raw: string | undefined): string | null {
  const k = parseKeys(raw);
  return k ? b64u(cat(new Uint8Array([4]), unb64u(k.x), unb64u(k.y))) : null;
}
async function vapidHeader(raw: string, endpoint: string, subject: string) {
  const k = parseKeys(raw)!, key = await crypto.subtle.importKey("jwk", k, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const part = (o: unknown) => b64u(enc.encode(JSON.stringify(o)));
  const unsigned = `${part({ typ: "JWT", alg: "ES256" })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned));
  return `vapid t=${unsigned}.${b64u(sig)}, k=${vapidPublicKey(raw)}`;
}

export interface Subscription { endpoint: string; p256dh: string; auth: string }
/** One message to one device. Returns "gone" when the browser says the subscription no longer exists. */
export async function pushOne(vapid: string, subject: string, s: Subscription, message: { title: string; body: string; url: string }, fetchImpl: typeof fetch = (...a) => fetch(...a)): Promise<"ok" | "gone" | "failed"> {
  if (!parseKeys(vapid) || !validEndpoint(s.endpoint)) return "failed";
  try {
    const body = await encryptPayload(enc.encode(JSON.stringify(message)), unb64u(s.p256dh), unb64u(s.auth));
    const res = await fetchImpl(s.endpoint, { method: "POST", headers: { Authorization: await vapidHeader(vapid, s.endpoint, subject), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "3600", Urgency: "normal" }, body });
    return res.status === 404 || res.status === 410 ? "gone" : res.ok ? "ok" : "failed";
  } catch { return "failed"; }
}

export interface PushDeps { db: D1Database; vapid?: string; baseUrl: string; fetch?: typeof fetch }
/** Sends to every device the member has subscribed; devices the push service has dropped are forgotten. Never throws. Returns how many were delivered. */
export async function sendPush(d: PushDeps, memberId: string, message: { title: string; body: string; url: string }): Promise<number> {
  if (!d.vapid) return 0;
  let sent = 0;
  try {
    for (const s of await all<Subscription>(d.db, "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE jellyfin_id = ?", memberId)) {
      const r = await pushOne(d.vapid, d.baseUrl, s, message, d.fetch);
      if (r === "ok") sent++;
      else if (r === "gone") await run(d.db, "DELETE FROM push_subscriptions WHERE endpoint = ?", s.endpoint);
    }
  } catch { /* a failed push must never break the caller */ }
  return sent;
}
export const hasPush = async (db: D1Database, memberId: string) => ((await all<{ n: number }>(db, "SELECT COUNT(*) AS n FROM push_subscriptions WHERE jellyfin_id = ?", memberId))[0]?.n ?? 0) > 0;
