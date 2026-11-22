import { all, first, run } from "./db";

/** An official Jellyfin client, as listed on jellyfin.org/downloads/clients. */
export interface JfClient {
  id: string; name: string; description: string;
  beta: boolean; recommended: boolean;
  deviceTypes: string[]; platforms: string[];
  links: Array<{ name: string; url: string }>;     // where to get it
  moreLinks: Array<{ name: string; url: string }>; // source code, docs
}
export interface ClientsData { updatedAt: string; source: string; clients: JfClient[] }

const RAW = "https://raw.githubusercontent.com/jellyfin/jellyfin.org/master/src/data";
export const CLIENTS_SOURCES = { clients: `${RAW}/clients.ts`, platform: `${RAW}/platform.ts`, page: "https://jellyfin.org/downloads/clients/" };

// ---- A tolerant reader for the TypeScript object literals jellyfin.org keeps its data in (no eval: Workers forbid it). ----
class Reader {
  i = 0;
  constructor(private s: string) {}
  private ws() {
    for (;;) {
      while (/\s/.test(this.s[this.i] ?? "")) this.i++;
      if (this.s.startsWith("//", this.i)) { while (this.i < this.s.length && this.s[this.i] !== "\n") this.i++; }
      else if (this.s.startsWith("/*", this.i)) { const e = this.s.indexOf("*/", this.i + 2); this.i = e < 0 ? this.s.length : e + 2; }
      else return;
    }
  }
  value(): unknown {
    this.ws();
    const c = this.s[this.i];
    if (c === "[") { this.i++; const out: unknown[] = []; for (;;) { this.ws(); if (this.s[this.i] === "]") { this.i++; return out; } out.push(this.value()); this.ws(); if (this.s[this.i] === ",") this.i++; } }
    if (c === "{") {
      this.i++; const out: Record<string, unknown> = {};
      for (;;) {
        this.ws(); if (this.s[this.i] === "}") { this.i++; return out; }
        const key = this.s[this.i] === "'" || this.s[this.i] === '"' ? String(this.str()) : this.ident();
        this.ws(); if (this.s[this.i] !== ":") throw new Error("expected ':'"); this.i++;
        out[key] = this.value(); this.ws(); if (this.s[this.i] === ",") this.i++;
      }
    }
    if (c === "'" || c === '"') return this.str();
    if (c === "`") throw new Error("template strings are not supported");
    const id = this.ident();
    if (id === "true") return true; if (id === "false") return false; if (id === "null" || id === "undefined") return null;
    if (/^-?\d/.test(id)) return Number(id);
    return { ref: id }; // an enum member such as ClientType.Official
  }
  private str(): string {
    const q = this.s[this.i++]; let out = "";
    while (this.i < this.s.length && this.s[this.i] !== q) { if (this.s[this.i] === "\\") this.i++; out += this.s[this.i++]; }
    this.i++; return out;
  }
  private ident(): string { const m = /^[A-Za-z0-9_$.\-]+/.exec(this.s.slice(this.i)); if (!m) throw new Error(`unexpected character at ${this.i}`); this.i += m[0].length; return m[0]; }
}

/** Platform enum members → their display names ("AndroidTV" → "Android TV"). */
export function parsePlatforms(platformTs: string): Record<string, string> {
  const body = /enum\s+Platform\s*\{([\s\S]*?)\}/.exec(platformTs)?.[1] ?? "";
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/^\s*(\w+)\s*=\s*(['"])(.*?)\2/gm)) out[m[1]] = m[3];
  return out;
}

const httpsOnly = (l: any): l is { name: string; url: string } => { try { return typeof l?.name === "string" && new URL(l.url).protocol === "https:"; } catch { return false; } };

/** The official (and official beta) clients from jellyfin.org's clients.ts. Throws if the file no longer looks right. */
export function parseClients(clientsTs: string, platformTs: string): JfClient[] {
  const platforms = parsePlatforms(platformTs);
  const at = clientsTs.search(/const\s+officialClients\b[^=]*=\s*\[/);
  if (at < 0) throw new Error("officialClients not found");
  const r = new Reader(clientsTs); r.i = clientsTs.indexOf("[", clientsTs.indexOf("=", at));
  const list = r.value() as any[];
  const refName = (v: any) => String(v?.ref ?? v).split(".").pop()!;
  const clients = list.map((c): JfClient => ({
    id: String(c.id), name: String(c.name), description: String(c.description ?? c.smallDescription ?? ""),
    beta: refName(c.clientType) === "OfficialBeta", recommended: c.recommended === true,
    deviceTypes: (c.deviceTypes ?? []).map(refName),
    platforms: (c.platforms ?? []).map((p: any) => platforms[refName(p)] ?? refName(p)),
    links: (c.primaryLinks ?? []).filter(httpsOnly).map((l: any) => ({ name: l.name, url: l.url })),
    moreLinks: (c.secondaryLinks ?? []).filter(httpsOnly).map((l: any) => ({ name: l.name, url: l.url })),
  })).filter((c) => c.id && c.name);
  if (clients.length < 5 || clients.every((c) => !c.links.length)) throw new Error("clients list looks wrong");
  return clients;
}

// ---- storage and refresh ----
const KEY = "jellyfin_clients", TRIED = "jellyfin_clients_tried";
export async function loadClients(db: D1Database, seed: ClientsData): Promise<ClientsData> {
  try { const r = await first<{ value: string }>(db, "SELECT value FROM settings WHERE key = ?", KEY); if (r) { const d = JSON.parse(r.value) as ClientsData; if (Array.isArray(d.clients) && d.clients.length) return d; } } catch { /* fall back to the built-in list */ }
  return seed;
}
/** Fetches jellyfin.org's list at most once a day (and a failed try at most hourly). A bad download never replaces good data. */
export async function refreshClients(db: D1Database, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<"fresh" | "updated" | "failed"> {
  const rows = await all<{ key: string; value: string }>(db, "SELECT key, value FROM settings WHERE key IN (?, ?)", KEY, TRIED);
  const stored = rows.find((r) => r.key === KEY), tried = Number(rows.find((r) => r.key === TRIED)?.value ?? 0);
  let storedAt = 0; try { storedAt = stored ? Date.parse((JSON.parse(stored.value) as ClientsData).updatedAt) : 0; } catch { /* treat as stale */ }
  if (now - storedAt < 86400_000 || now - tried < 3600_000) return "fresh";
  const put = (k: string, v: string) => run(db, "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", k, v);
  await put(TRIED, String(now));
  try {
    const get = async (u: string) => { const r = await fetchImpl(u, { headers: { accept: "text/plain" } }); if (!r.ok) throw new Error(`${u} ${r.status}`); return (await r.text()).slice(0, 500_000); };
    const [c, p] = await Promise.all([get(CLIENTS_SOURCES.clients), get(CLIENTS_SOURCES.platform)]);
    const data: ClientsData = { updatedAt: new Date(now).toISOString(), source: CLIENTS_SOURCES.page, clients: parseClients(c, p) };
    await put(KEY, JSON.stringify(data));
    return "updated";
  } catch (e) { console.error("clients refresh failed", (e as Error).message); return "failed"; }
}
