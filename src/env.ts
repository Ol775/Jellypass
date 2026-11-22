/** Settings a self-hosted install lets admins change from the app (Turnstile, SMTP). Provided only by selfhost/server.ts; absent on Cloudflare. */
export type Service = "jellyfin" | "seerr" | "tracearr";
export interface LocalNetwork {
  publicUrl: string; tlsMode: "" | "self-signed" | "custom"; tlsHosts: string; trustProxy: boolean;
  https: boolean; port: number; restarting: boolean;
  cert: { subject: string; validTo: string; selfSigned: boolean; names: string } | null;
}
export interface LocalAbout {
  version: string; repo: string; updateCheck: boolean;
  latest: { version: string; url: string; notes: string; publishedAt: string | null } | null;
  updateAvailable: boolean; checkedAt: string | null; error: string | null;
  changelog: Array<{ version: string; date: string | null; body: string }>;
}
export interface LocalSettings {
  network: LocalNetwork;
  emailEnabled: boolean;
  connections: Record<Service, { url: string; keySet: boolean }>;
  turnstile: { siteKey: string; secretSet: boolean };
  smtp: { host: string; port: number; secure: boolean; user: string; from: string; passSet: boolean };
}
export interface LocalPatch {
  updateCheck?: boolean;
  network?: { publicUrl?: string; tlsMode?: "" | "self-signed" | "custom"; tlsHosts?: string; trustProxy?: boolean; cert?: string; key?: string };
  emailEnabled?: boolean;
  connections?: Partial<Record<Service, { url?: string; key?: string | null }>>;
  turnstile?: { siteKey?: string; secret?: string | null };
  smtp?: { host?: string; port?: number; secure?: boolean; user?: string; from?: string; pass?: string | null };
}
export interface LocalConfig { get(): Promise<LocalSettings>; set(patch: LocalPatch): Promise<void>; certificate(): Promise<string | null>; about(): Promise<LocalAbout>; checkUpdates(): Promise<LocalAbout> }

export interface Env {
  DB: D1Database;
  TILES: R2Bucket;
  /** Self-hosted installs only: lets admins edit Turnstile and SMTP settings in the app. */
  LOCAL?: LocalConfig;
  /** "true" turns email off: nothing is sent and the email-only controls are hidden. Set by a self-hosted install without SMTP (or switched off by the admin); never set on Cloudflare. */
  EMAIL_OFF?: string;
  EMAIL: SendEmail;
  MAIL_FROM: string;
  PUBLIC_URL: string;
  ENVIRONMENT: "beta" | "prod";
  /** "1" only in the beta environment: Compare shows made-up "Watching now" rows so the layout can be reviewed. Never set in prod. */
  DEMO_COMPARE?: string;
  JELLYFIN_URL: string;
  JELLYFIN_ADMIN_KEY: string;
  SEERR_URL: string;
  SEERR_API_KEY: string;
  TRACEARR_URL: string;
  TRACEARR_TOKEN: string;
  CF_ACCESS_CLIENT_ID: string;
  CF_ACCESS_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  TURNSTILE_SECRET?: string;
  /** Master secret that encrypts API keys stored from the admin screen. Without it, keys can only come from Worker secrets. */
  KEYS_SECRET?: string;
  /** Sent as X-Jellypass-Key to Jellyfin and Seerr; a firewall rule on the zone lets requests carrying it past the geo block (Worker traffic leaves from datacentres worldwide). */
  UPSTREAM_KEY?: string;
  TURNSTILE_SITEKEY?: string;
  /** "true" skips the sign-in challenge. Self-hosted installs only; the Cloudflare deployment never sets it. */
  TURNSTILE_DISABLED?: string;
  /** Web Push (VAPID) private key as a JWK in JSON; the public key is derived from it. Without it push notices are off. Make one with scripts/gen-vapid.mjs. */
  VAPID_KEYS?: string;
}
