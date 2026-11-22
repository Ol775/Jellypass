import { all } from "./db";
import type { Env } from "./env";

/** The API keys an admin can manage from the app, and the Env field each one overrides. URLs are not secret and stay in config. */
export const KEYS = {
  jellyfin_admin_key: { env: "JELLYFIN_ADMIN_KEY", integration: "jellyfin", label: "Jellyfin admin API key" },
  seerr_api_key: { env: "SEERR_API_KEY", integration: "seerr", label: "Seerr API key" },
  tracearr_token: { env: "TRACEARR_TOKEN", integration: "tracearr", label: "Tracearr API token" },
  cf_access_client_id: { env: "CF_ACCESS_CLIENT_ID", integration: "tracearr", label: "Cloudflare Access client ID (for Tracearr)" },
  cf_access_client_secret: { env: "CF_ACCESS_CLIENT_SECRET", integration: "tracearr", label: "Cloudflare Access client secret (for Tracearr)" },
} as const satisfies Record<string, { env: keyof Env; integration: string; label: string }>;
export type KeyName = keyof typeof KEYS;
export const isKeyName = (n: string): n is KeyName => Object.hasOwn(KEYS, n);

const enc = new TextEncoder();
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function aesKey(master: string) {
  return crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", enc.encode(`jellypass-keys:${master}`)), "AES-GCM", false, ["encrypt", "decrypt"]);
}
/** AES-GCM with a fresh IV; the key name is authenticated data, so a value cannot be moved to a different key's row. */
export async function encryptSecret(master: string, name: string, value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(name) }, await aesKey(master), enc.encode(value)));
  return `${b64(iv)}.${b64(ct)}`;
}
export async function decryptSecret(master: string, name: string, stored: string) {
  const [iv, ct] = stored.split(".");
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv), additionalData: enc.encode(name) }, await aesKey(master), unb64(ct)));
}

/** The env with any admin-stored keys laid over the Worker secrets. A row that cannot be read is ignored, never fatal. */
export async function effectiveEnv(env: Env): Promise<Env> {
  if (!env.KEYS_SECRET) return env;
  let rows: Array<{ name: string; ciphertext: string }>;
  try { rows = await all(env.DB, "SELECT name, ciphertext FROM integration_keys"); } catch { return env; }
  const over: Record<string, string> = {};
  for (const r of rows) {
    if (!isKeyName(r.name)) continue;
    try { over[KEYS[r.name].env] = await decryptSecret(env.KEYS_SECRET, r.name, r.ciphertext); } catch { /* wrong master or damaged: fall back to the Worker secret */ }
  }
  return Object.keys(over).length ? { ...env, ...over } : env;
}
