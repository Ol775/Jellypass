/**
 * Self-hosted entrypoint: runs the unchanged Worker (src/index.ts) on Node, with the Cloudflare
 * bindings it expects provided locally: D1 -> SQLite file, R2 -> a folder, Email -> SMTP,
 * Cron Trigger -> a 5-minute timer. Config comes from the same names as the Worker secrets/vars.
 */
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { execFileSync } from "node:child_process";
import { createServer as createHttpsServer } from "node:https";
import { networkInterfaces } from "node:os";
import { X509Certificate, createPrivateKey } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { Readable } from "node:stream";
import { randomBytes } from "node:crypto";
import { serve } from "@hono/node-server";
import nodemailer from "nodemailer";
import worker from "../src/index";
import { isNewer, parseChangelog } from "./updates";
import { testIntegration } from "../src/integrations";
import { setupPage, setupScript } from "./setup-page";

const e = process.env;
const DATA = e.DATA_DIR ?? "/data";
const PORT = Number(e.PORT ?? 8787);

// ---- D1 -> SQLite (only the surface the app uses: prepare/bind/run/first/all, meta.changes/last_row_id)
let sqlite: DatabaseSync;
try { sqlite = new DatabaseSync(join(DATA, "jellypass.db")); }
catch (err) {
  console.error(`Cannot open the database in ${DATA}: ${(err as Error).message}\nThe container runs as user 1000 (node). If ${DATA} is a folder from your server, make it writable with: chown -R 1000:1000 <that folder>. A Docker named volume needs nothing.`);
  process.exit(1);
}
sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");

function migrate(dir: string) {
  sqlite.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, at TEXT NOT NULL)");
  const done = new Set(sqlite.prepare("SELECT name FROM _migrations").all().map((r) => String(r.name)));
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    // All-or-nothing per file, like D1.
    sqlite.exec("BEGIN");
    try { sqlite.exec(readFileSync(join(dir, f), "utf8")); sqlite.prepare("INSERT INTO _migrations VALUES (?, ?)").run(f, new Date().toISOString()); sqlite.exec("COMMIT"); }
    catch (err) { sqlite.exec("ROLLBACK"); throw new Error(`migration ${f} failed: ${(err as Error).message}`); }
    console.log(`applied migration ${f}`);
  }
}

const plain = (r: Record<string, unknown>) => ({ ...r });
function stmt(sql: string, args: SQLInputValue[] = []) {
  const s = {
    bind: (...a: SQLInputValue[]) => stmt(sql, a),
    async run() { const r = sqlite.prepare(sql).run(...args); return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
    async all() { const results = sqlite.prepare(sql).all(...args).map(plain); return { success: true, results, meta: { changes: 0 } }; },
    async first(col?: string) { const r = sqlite.prepare(sql).get(...args); return r ? (col ? (r as any)[col] ?? null : plain(r)) : null; },
  };
  return s;
}
const DB = { prepare: (sql: string) => stmt(sql) } as unknown as D1Database;

// ---- R2 -> folder (head/get with optional range; map tiles and GeoIP files live here)
const TILES_DIR = join(DATA, "tiles");
const path = (key: string) => join(TILES_DIR, basename(key)); // flat keys only
const TILES = {
  async head(key: string) { const p = path(key); return existsSync(p) ? { size: statSync(p).size } : null; },
  async get(key: string, o?: { range?: { offset: number; length: number } }) {
    const p = path(key); if (!existsSync(p)) return null;
    const r = o?.range;
    const stream = createReadStream(p, r ? { start: r.offset, end: r.offset + r.length - 1 } : {});
    const body = Readable.toWeb(stream) as ReadableStream;
    return { body, arrayBuffer: () => new Response(body).arrayBuffer() };
  },
} as unknown as R2Bucket;

// ---- Email -> SMTP (rebuilt whenever the admin saves new settings)
let smtp: ReturnType<typeof nodemailer.createTransport> | null = null;
const EMAIL = {
  async send(m: any) {
    if (!smtp) throw new Error("Email is not set up yet: add your SMTP settings under Settings, Sign-in and email");
    await smtp.sendMail({ from: `"${m.from.name}" <${m.from.email}>`, to: m.to, subject: m.subject, html: m.html, text: m.text,
      attachments: m.attachments?.map((a: any) => ({ content: a.content, encoding: "base64", filename: a.filename, contentType: a.type, cid: a.contentId, contentDisposition: "inline" })) });
  },
} as unknown as SendEmail;

// ---- Config: environment variables win; anything missing comes from /data/config.json, which the first-run setup page writes.
const CONFIG = join(DATA, "config.json");
const saved: Record<string, string> = existsSync(CONFIG) ? JSON.parse(readFileSync(CONFIG, "utf8")) : {};
const save = () => writeFileSync(CONFIG, JSON.stringify(saved, null, 2), { mode: 0o600 });
// Saved values (written by the setup wizard or the Settings page) beat environment variables, which only give starting values.
const conf = (k: string) => (k in saved ? saved[k] : e[k]) || "";
if (!conf("SESSION_SECRET")) { saved.SESSION_SECRET = randomBytes(32).toString("hex"); save(); }

const KEYS_ = ["JELLYFIN_URL", "JELLYFIN_ADMIN_KEY", "SEERR_URL", "SEERR_API_KEY", "TRACEARR_URL", "TRACEARR_TOKEN", "CF_ACCESS_CLIENT_ID", "CF_ACCESS_CLIENT_SECRET", "SESSION_SECRET", "PUBLIC_URL"] as const;
const env: Record<string, unknown> = {
  DB, TILES, EMAIL, LOCAL: undefined as unknown,
  ENVIRONMENT: e.ENVIRONMENT ?? "prod", MAIL_FROM: e.MAIL_FROM ?? "jellypass@localhost",
  TURNSTILE_SITEKEY: e.TURNSTILE_SITEKEY, TURNSTILE_SECRET: e.TURNSTILE_SECRET, TURNSTILE_DISABLED: e.TURNSTILE_DISABLED, KEYS_SECRET: e.KEYS_SECRET, UPSTREAM_KEY: e.UPSTREAM_KEY, VAPID_KEYS: e.VAPID_KEYS,
};
const load = () => { for (const k of KEYS_) env[k] = conf(k); env.PUBLIC_URL = String(env.PUBLIC_URL).replace(/\/$/, ""); };
load();

// ---- Settings an admin edits in the app (Turnstile, SMTP). Saved values beat environment variables; clearing a value really clears it.
const eff = (k: string) => (k in saved ? saved[k] : e[k] ?? "");
function applyConfig() {
  load();
  const site = eff("TURNSTILE_SITEKEY"), secret = eff("TURNSTILE_SECRET");
  env.TURNSTILE_SITEKEY = site || undefined; env.TURNSTILE_SECRET = secret || undefined;
  env.TURNSTILE_DISABLED = site && secret ? "false" : "true";
  env.MAIL_FROM = eff("MAIL_FROM") || "jellypass@localhost";
  const host = eff("SMTP_HOST"), user = eff("SMTP_USER");
  smtp = host ? nodemailer.createTransport({ host, port: Number(eff("SMTP_PORT") || 587), secure: eff("SMTP_SECURE") === "true", auth: user ? { user, pass: eff("SMTP_PASS") } : undefined }) : null;
  // Email is on only when SMTP is set up and the admin has not switched it off. Off hides the email-only screens and stops sending.
  env.EMAIL_OFF = smtp && eff("EMAIL_ENABLED") !== "false" ? undefined : "true";
}
env.LOCAL = {
  async get() {
    const conn = (u: string, k: string) => ({ url: String(env[u] ?? ""), keySet: !!env[k] });
    const network = { publicUrl: conf("PUBLIC_URL"), tlsMode: netVal("TLS_MODE"), tlsHosts: netVal("TLS_HOSTS"), trustProxy, https: !!tls, port: PORT, restarting: relistenPending, cert: certInfo() };
    return { network, emailEnabled: eff("EMAIL_ENABLED") !== "false", connections: { jellyfin: conn("JELLYFIN_URL", "JELLYFIN_ADMIN_KEY"), seerr: conn("SEERR_URL", "SEERR_API_KEY"), tracearr: conn("TRACEARR_URL", "TRACEARR_TOKEN") }, turnstile: { siteKey: eff("TURNSTILE_SITEKEY"), secretSet: !!eff("TURNSTILE_SECRET") },
      smtp: { host: eff("SMTP_HOST"), port: Number(eff("SMTP_PORT") || 587), secure: eff("SMTP_SECURE") === "true", user: eff("SMTP_USER"), from: eff("MAIL_FROM"), passSet: !!eff("SMTP_PASS") } };
  },
  async set(p: any) {
    const put = (k: string, v: unknown) => { if (v !== undefined) saved[k] = v === null ? "" : String(v); };
    if (p.network) applyNetwork(p.network);
    put("EMAIL_ENABLED", p.emailEnabled);
    if (p.updateCheck !== undefined) { put("UPDATE_CHECK", p.updateCheck); if (p.updateCheck) void checkUpdates(); }
    put("TURNSTILE_SITEKEY", p.turnstile?.siteKey); put("TURNSTILE_SECRET", p.turnstile?.secret);
    put("SMTP_HOST", p.smtp?.host); put("SMTP_PORT", p.smtp?.port); put("SMTP_SECURE", p.smtp?.secure); put("SMTP_USER", p.smtp?.user); put("SMTP_PASS", p.smtp?.pass); put("MAIL_FROM", p.smtp?.from);
    const F = { jellyfin: ["JELLYFIN_URL", "JELLYFIN_ADMIN_KEY"], seerr: ["SEERR_URL", "SEERR_API_KEY"], tracearr: ["TRACEARR_URL", "TRACEARR_TOKEN"] } as const;
    for (const [svc, v] of Object.entries(p.connections ?? {}) as Array<[keyof typeof F, any]>) { put(F[svc][0], v.url); put(F[svc][1], v.key); }
    save(); applyConfig();
  },
  async certificate() { return tls ? tls.cert.toString() : null; },
  async about() { return aboutNow(); },
  async checkUpdates() { await checkUpdates(); return aboutNow(); },
};
applyConfig();

const configured = () => !!(env.JELLYFIN_URL && env.JELLYFIN_ADMIN_KEY && env.PUBLIC_URL);
if (!configured()) console.log("First run: open the site in a browser to finish setup.");

migrate(e.MIGRATIONS_DIR ?? "./migrations");

// ---- Version and updates. The version is baked in at build time; the changelog ships in the image. Once a day (and on demand) the latest
// GitHub release is looked up so the admin can be told an update exists. It sends nothing about this install, and can be switched off.
declare const __VERSION__: string;
const VERSION = typeof __VERSION__ === "string" ? __VERSION__ : "dev";
const UPDATE_REPO = e.UPDATE_REPO || "Ol775/Jellypass";
let changelogText = ""; try { changelogText = readFileSync(e.CHANGELOG_FILE ?? "./CHANGELOG.md", "utf8"); } catch { /* a dev checkout without the file */ }
type Latest = { version: string; url: string; notes: string; publishedAt: string | null };
let latest: Latest | null = null, checkedAt: string | null = null, checkError: string | null = null;
async function checkUpdates() {
  try {
    const r = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, { headers: { accept: "application/vnd.github+json", "user-agent": `Jellypass/${VERSION}` }, signal: AbortSignal.timeout(10_000) });
    if (r.status === 404) latest = null; // no release published yet
    else if (!r.ok) throw new Error(`GitHub answered ${r.status}`);
    else {
      const j = (await r.json()) as any;
      const url = typeof j.html_url === "string" && j.html_url.startsWith("https://github.com/") ? j.html_url : `https://github.com/${UPDATE_REPO}/releases`;
      latest = typeof j.tag_name === "string" ? { version: j.tag_name.replace(/^v/, ""), url, notes: String(j.body ?? "").slice(0, 4000), publishedAt: typeof j.published_at === "string" ? j.published_at : null } : null;
    }
    checkError = null;
  } catch (err) { checkError = "Could not reach GitHub."; console.error("Update check failed:", (err as Error).message); }
  checkedAt = new Date().toISOString();
}
const updatesOn = () => eff("UPDATE_CHECK") !== "false";
const aboutNow = () => ({ version: VERSION, repo: UPDATE_REPO, updateCheck: updatesOn(), latest, updateAvailable: !!latest && isNewer(latest.version, VERSION), checkedAt, error: checkError, changelog: parseChangelog(changelogText, 10) });
const dailyCheck = () => { if (updatesOn()) void checkUpdates(); };
setTimeout(dailyCheck, 60_000).unref(); setInterval(dailyCheck, 24 * 3600_000).unref();
console.log(`Jellypass ${VERSION}`);

// ---- Cron: every 5 minutes, never overlapping
const pending = new Set<Promise<unknown>>();
const ctx = { waitUntil: (p: Promise<unknown>) => { const t = p.catch((err) => console.error("background task failed", err?.message)).finally(() => pending.delete(t)); pending.add(t); }, passThroughOnException() {} } as unknown as ExecutionContext;
let ticking = false;
async function tick() {
  if (ticking || !configured()) return; ticking = true;
  try { await worker.scheduled({ cron: "*/5 * * * *", scheduledTime: Date.now() } as ScheduledController, env as any, ctx); await Promise.all(pending); }
  catch (err) { console.error("cron failed", (err as Error).message); } finally { ticking = false; }
}
setInterval(tick, 5 * 60_000).unref(); setTimeout(tick, 15_000).unref();

// ---- HTTP. The app is written for Cloudflare: it trusts cf-connecting-ip for client IPs and builds links
// from the request URL. Rebuild both here so they are right behind a reverse proxy (and never client-supplied).
// ---- Network: the public address, HTTPS and proxy trust. Edited in the app (Settings, Server); environment variables only give starting
// values, and NETWORK_RESET=true ignores what was saved here (a way back in if a bad setting locks you out).
// HTTPS is off by default: use a reverse proxy or Cloudflare Tunnel that terminates TLS, or choose "self-signed" (a certificate made here,
// renewed when the names change) or "custom" (your own cert.pem and key.pem in /data/tls).
const netVal = (k: string) => (e.NETWORK_RESET === "true" && k !== "PUBLIC_URL" ? e[k] ?? "" : eff(k));
type Net = { mode: string; hosts: string; publicUrl: string };
const netNow = (): Net => ({ mode: netVal("TLS_MODE"), hosts: netVal("TLS_HOSTS"), publicUrl: conf("PUBLIC_URL") });
const TLS_DIR = join(DATA, "tls");
function tlsCredentials(n: Net): { cert: Buffer; key: Buffer } | null {
  if (!n.mode) return null;
  const cert = join(TLS_DIR, "cert.pem"), key = join(TLS_DIR, "key.pem"), hostsFile = join(TLS_DIR, "hosts.txt");
  if (n.mode === "custom") {
    if (!existsSync(cert) || !existsSync(key)) throw new Error("Paste your certificate and private key first.");
  } else if (n.mode === "self-signed") {
    const names = new Set(["localhost", "127.0.0.1", "::1"]);
    try { if (n.publicUrl) names.add(new URL(n.publicUrl).hostname); } catch { /* not set yet: setup will choose it */ }
    for (const h of n.hosts.split(",").map((x) => x.trim()).filter(Boolean)) names.add(h);
    for (const list of Object.values(networkInterfaces())) for (const a of list ?? []) if (!a.internal && a.family === "IPv4") names.add(a.address);
    const wanted = [...names].sort().join(",");
    if (!existsSync(cert) || !existsSync(key) || !existsSync(hostsFile) || readFileSync(hostsFile, "utf8") !== wanted) {
      mkdirSync(TLS_DIR, { recursive: true });
      const san = [...names].map((x) => (/^[\d.]+$|:/.test(x) ? `IP:${x.replace(/^\[|\]$/g, "")}` : `DNS:${x}`)).join(",");
      try { execFileSync("openssl", ["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-days", "3650", "-subj", "/CN=Jellypass", "-addext", `subjectAltName=${san}`, "-keyout", key, "-out", cert], { stdio: "ignore" }); }
      catch { throw new Error("Could not make a certificate: openssl is not available in this container."); }
      writeFileSync(hostsFile, wanted);
      console.log(`Made a self-signed certificate for: ${wanted}`);
    }
  } else throw new Error(`HTTPS mode must be off, self-signed or custom (got "${n.mode}")`);
  return { cert: readFileSync(cert), key: readFileSync(key) };
}
/** A pasted certificate and key must parse, match each other and not be expired. Throws a plain message, writes nothing. */
function checkPair(certPem: string, keyPem: string) {
  let x: X509Certificate;
  try { x = new X509Certificate(certPem); } catch { throw new Error("That does not look like a certificate (PEM text starting with BEGIN CERTIFICATE)."); }
  let k; try { k = createPrivateKey(keyPem); } catch { throw new Error("That does not look like an unencrypted private key (PEM text starting with BEGIN PRIVATE KEY)."); }
  if (!x.checkPrivateKey(k)) throw new Error("The private key does not belong to that certificate.");
  if (new Date(x.validTo) < new Date()) throw new Error(`That certificate expired on ${x.validTo}.`);
}
let tls = tlsCredentials(netNow());
let trustProxy = netVal("TRUST_PROXY") === "true";
let relistenPending = false;
const same = (a: typeof tls, b: typeof tls) => (!a && !b) || (!!a && !!b && a.cert.equals(b.cert) && a.key.equals(b.key));
function certInfo() {
  if (!tls) return null;
  try { const x = new X509Certificate(tls.cert); return { subject: x.subject.replace(/\n/g, ", "), validTo: x.validTo, selfSigned: x.issuer === x.subject, names: x.subjectAltName ?? "" }; } catch { return null; }
}
/** Apply a network change: checked first (a bad certificate changes nothing), then the listener is restarted a moment later so this reply gets out. */
function applyNetwork(nw: any) {
  const cand: Net = { mode: nw.tlsMode ?? netVal("TLS_MODE"), hosts: nw.tlsHosts ?? netVal("TLS_HOSTS"), publicUrl: nw.publicUrl ?? conf("PUBLIC_URL") };
  if (nw.cert || nw.key) {
    if (!nw.cert || !nw.key) throw new Error("Paste both the certificate and the private key.");
    checkPair(nw.cert, nw.key);
    mkdirSync(TLS_DIR, { recursive: true });
    writeFileSync(join(TLS_DIR, "cert.pem"), nw.cert.trim() + "\n"); writeFileSync(join(TLS_DIR, "key.pem"), nw.key.trim() + "\n", { mode: 0o600 });
  }
  const creds = tlsCredentials(cand);
  const put = (k: string, v: unknown) => { if (v !== undefined) saved[k] = String(v); };
  put("TLS_MODE", nw.tlsMode); put("TLS_HOSTS", nw.tlsHosts); put("PUBLIC_URL", nw.publicUrl); put("TRUST_PROXY", nw.trustProxy);
  save(); applyConfig();
  trustProxy = netVal("TRUST_PROXY") === "true";
  if (!same(creds, tls)) {
    tls = creds; relistenPending = true;
    setTimeout(() => { server.close(() => { server = listen(); relistenPending = false; console.log(`Restarted over ${tls ? "HTTPS" : "HTTP"}`); }); (server as any).closeAllConnections?.(); }, 1000);
  }
}

// First-run setup wizard. Until Jellyfin is configured the site is only this; each step is tested server-side before moving on.
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const SECURITY = { "content-security-policy": "default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; font-src 'self'; manifest-src 'self'; connect-src 'self'; form-action 'none'; base-uri 'none'", "x-content-type-options": "nosniff", "cache-control": "no-store" };
// LAN addresses are legitimate targets (Jellyfin lives there), but cloud-metadata / link-local ones never are.
const cleanUrl = (x: unknown) => { let t = String(x ?? "").trim(); if (!t) return ""; if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) t = `http://${t}`; try { const u = new URL(t); return /^https?:$/.test(u.protocol) && u.hostname && !/^(169\.254\.|\[?fe80:|\[?fd00:ec2|metadata\.)/i.test(u.hostname) ? t.replace(/\/+$/, "") : null; } catch { return null; } };

async function checkService(name: "jellyfin" | "seerr" | "tracearr", url: string, key: string) {
  const f = { jellyfin: ["JELLYFIN_URL", "JELLYFIN_ADMIN_KEY"], seerr: ["SEERR_URL", "SEERR_API_KEY"], tracearr: ["TRACEARR_URL", "TRACEARR_TOKEN"] }[name];
  const r = await testIntegration(name, { ...env, [f[0]]: url, [f[1]]: key } as any);
  return r.ok ? null : r.rejected ? "That key was refused. Check it and try again." : "Could not reach it. The address must be reachable from inside the container (not localhost).";
}

const sock = (info: any): string => info?.incoming?.socket?.remoteAddress ?? "";
// Poster backdrop for the wizard: once Jellyfin has passed its test, offer posters from that library on the same endpoints the real
// sign-in page's wall.js reads. Only ids Jellyfin just listed are served, so this is not a general proxy.
let wall: { url: string; key: string; ids: string[]; until: number } | null = null;
const ID = /^[0-9a-f-]{32,36}$/i;
// Same header the app itself uses for Jellyfin (newer Jellyfin refuses X-Emby-Token).
const jfAuth = (key: string) => `MediaBrowser Client="Jellypass", Device="Jellypass", DeviceId="jellypass-portal", Version="1.0", Token="${key}"`;
async function loadWall(url: string, key: string) {
  try {
    // Newest first (cheap on a big library; Random sorting can take many seconds), shuffled here instead.
    const r = await fetch(`${url}/Items?IncludeItemTypes=Movie,Series&Recursive=true&ImageTypes=Primary&SortBy=DateCreated&SortOrder=Descending&Limit=80&EnableTotalRecordCount=false`, { headers: { Authorization: jfAuth(key) }, redirect: "manual", signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`Jellyfin answered ${r.status}`);
    const items = ((await r.json()) as any)?.Items;
    const ids: string[] = (Array.isArray(items) ? items : []).filter((i: any) => ID.test(i?.Id ?? "") && i?.ImageTags?.Primary).map((i: any) => i.Id);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    wall = { url, key, until: Date.now() + 30 * 60_000, ids: ids.slice(0, 24) };
    console.log(`Poster wall: ${wall.ids.length} posters from Jellyfin`);
  } catch (err) { wall = null; console.error("Poster wall unavailable:", (err as Error).message); }
}
// Until Jellyfin is connected, the wall shows soft poster-shaped tiles in the app's colours; real posters replace them.
const TINTS: Array<[string, string]> = [["#0f766e", "#0b1211"], ["#1e3a8a", "#0b1020"], ["#115e59", "#0d1514"], ["#4c1d95", "#120d1f"], ["#134e4a", "#0b1211"], ["#155e75", "#0a1418"], ["#312e81", "#0c0c1c"], ["#14532d", "#0b140e"]];
const PLACEHOLDERS = TINTS.map((_, i) => `placeholder-${i}`);
const tile = (i: number) => {
  const [c1, c2] = TINTS[i], cx = 90 + (i * 53) % 170, cy = 130 + (i * 37) % 90;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513" viewBox="0 0 342 513"><defs><linearGradient id="g" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient><radialGradient id="r" cx="${cx / 342}" cy="${cy / 513}" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><linearGradient id="v" x1="0" y1=".45" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></linearGradient></defs><rect width="342" height="513" fill="url(#g)"/><rect width="342" height="513" fill="url(#r)"/><rect width="342" height="513" fill="url(#v)"/><g fill="#fff"><rect x="28" y="${400 - (i % 3) * 8}" width="${190 - (i % 4) * 20}" height="16" rx="8" opacity=".5"/><rect x="28" y="${430 - (i % 3) * 8}" width="${120 - (i % 3) * 14}" height="10" rx="5" opacity=".28"/></g></svg>`;
};
async function wallImage(path: string): Promise<Response> {
  const ph = /^\/placeholder-([0-7])\.jpg$/.exec(path)?.[1];
  if (ph && !(wall && wall.until > Date.now())) return new Response(tile(Number(ph)), { headers: { "content-type": "image/svg+xml", "cache-control": "private, max-age=3600", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" } });
  const id = /^\/([0-9a-f-]{32,36})\.jpg$/i.exec(path)?.[1];
  if (!wall || wall.until < Date.now() || !id || !wall.ids.includes(id)) return json({ error: "not found" }, 404);
  try {
    const r = await fetch(`${wall.url}/Items/${id}/Images/Primary?maxWidth=342&quality=80`, { headers: { Authorization: jfAuth(wall.key) }, redirect: "manual", signal: AbortSignal.timeout(8000) });
    const type = r.headers.get("content-type") ?? "";
    if (!r.ok || !type.startsWith("image/")) return json({ error: "not found" }, 404);
    return new Response(r.body, { headers: { "content-type": type, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" } });
  } catch { return json({ error: "image unavailable" }, 502); }
}

async function setup(req: Request): Promise<Response> {
  const u = new URL(req.url);
  if (req.method === "GET" && u.pathname === "/setup.js") return new Response(setupScript, { headers: { "content-type": "text/javascript", ...SECURITY } });
  if (req.method === "GET" && u.pathname === "/api/signin-posters") return json({ posters: (wall && wall.until > Date.now() && wall.ids.length ? wall.ids : PLACEHOLDERS).map((id) => ({ url: `/api/signin-posters/img?path=%2F${id}.jpg`, kind: "movie" })) });
  if (req.method === "GET" && u.pathname === "/api/signin-posters/img") return wallImage(u.searchParams.get("path") ?? "");
  if (req.method !== "POST" || u.pathname !== "/setup/api") {
    const guess = `${tls ? "https" : (trustProxy && req.headers.get("x-forwarded-proto")) || "http"}://${req.headers.get("host")}`;
    return new Response(setupPage(guess), { headers: { "content-type": "text/html; charset=utf-8", ...SECURITY } });
  }
  const b = await req.json().catch(() => ({})) as Record<string, any>;
  if (b.action === "test") {
    const url = cleanUrl(b.url), key = String(b.key ?? "").trim();
    if (!url || !key || !["jellyfin", "seerr", "tracearr"].includes(b.service)) return json({ error: "Enter the address (starting http:// or https://) and the key." }, 400);
    const err = await checkService(b.service, url, key);
    if (err) return json({ error: err }, 422);
    if (b.service === "jellyfin") await loadWall(url, key);
    return json({ ok: true, posters: (wall?.ids.length ?? 0) > 0 });
  }
  if (b.action === "save") {
    const next: Record<string, string> = {};
    for (const [k, v] of [["PUBLIC_URL", b.publicUrl], ["JELLYFIN_URL", b.jellyfin?.url], ["SEERR_URL", b.seerr?.url], ["TRACEARR_URL", b.tracearr?.url]] as const) {
      const x = cleanUrl(v); if (x === null || (!x && k !== "SEERR_URL" && k !== "TRACEARR_URL")) return json({ error: `Check the ${k.replace("_URL", "").toLowerCase()} address.` }, 400); next[k] = x;
    }
    next.JELLYFIN_ADMIN_KEY = String(b.jellyfin?.key ?? "").trim(); next.SEERR_API_KEY = next.SEERR_URL ? String(b.seerr?.key ?? "").trim() : ""; next.TRACEARR_TOKEN = next.TRACEARR_URL ? String(b.tracearr?.key ?? "").trim() : "";
    if (!next.JELLYFIN_ADMIN_KEY) return json({ error: "The Jellyfin key is missing." }, 400);
    for (const [n, url, key] of [["jellyfin", next.JELLYFIN_URL, next.JELLYFIN_ADMIN_KEY], ["seerr", next.SEERR_URL, next.SEERR_API_KEY], ["tracearr", next.TRACEARR_URL, next.TRACEARR_TOKEN]] as const) {
      if (!url) continue; const err = await checkService(n, url, key); if (err) return json({ error: `${n}: ${err}` }, 422);
    }
    Object.assign(saved, next); wall = null; save(); load();
    console.log("Setup complete.");
    return json({ ok: true, next: `${next.PUBLIC_URL}/signin` });
  }
  return json({ error: "unknown action" }, 400);
}

const handler = (req: Request, info: any) => {
  // While setting up, the app's own stylesheet, theme script and icons are still served by the Worker so the wizard looks like Jellypass.
  if (!configured() && /^\/(assets\/|favicon\.|apple-touch-icon|manifest\.webmanifest)/.test(new URL(req.url).pathname)) return worker.fetch(req, env as any, ctx);
  if (!configured()) return new URL(req.url).pathname === "/health" ? new Response('{"ok":true,"setup":true}', { headers: { "content-type": "application/json" } }) : setup(req);
  const u = new URL(req.url);
  const h = new Headers(req.headers);
  const xff = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const ip = (trustProxy && (h.get("cf-connecting-ip") || h.get("x-real-ip") || xff.at(-1))) || sock(info) || "unknown";
  h.set("cf-connecting-ip", ip);
  const url = `${new URL(String(env.PUBLIC_URL)).origin}${u.pathname}${u.search}`;
  return worker.fetch(new Request(url, { method: req.method, headers: h, body: req.body, duplex: "half" } as RequestInit), env as any, ctx);
};
function listen() { return serve({ port: PORT, hostname: e.HOST, ...(tls ? { createServer: createHttpsServer, serverOptions: tls } : {}), fetch: handler }); }
let server = listen();
console.log(`Jellypass listening on :${PORT} over ${tls ? "HTTPS" : "HTTP"} (data in ${DATA})`);
for (const s of ["SIGTERM", "SIGINT"] as const) process.on(s, () => { server.close(); sqlite.close(); process.exit(0); });
