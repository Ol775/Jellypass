import { audit } from "./audit";
import { all, first, run } from "./db";
import type { Jellyfin, JfPolicy } from "./jellyfin";
import type { Seerr } from "./seerr";

export type RequestRights = "none" | "request" | "auto";
export interface PresetInput { name: string; libraries: "all" | string[]; bitrateLimit: number; remoteAccess: boolean; requestRights: RequestRights; membershipDays: number | null }
export interface Preset extends PresetInput { id: string; isDefault: boolean }

type Row = { id: string; name: string; config_json: string; membership_days: number | null; is_default: number };
const fromRow = (r: Row): Preset => ({ ...(JSON.parse(r.config_json) as Omit<PresetInput, "name" | "membershipDays">), id: r.id, name: r.name, membershipDays: r.membership_days, isDefault: !!r.is_default });
const cfgJson = (p: PresetInput) => JSON.stringify({ libraries: p.libraries, bitrateLimit: p.bitrateLimit, remoteAccess: p.remoteAccess, requestRights: p.requestRights });

/** Validates untrusted JSON. Throws Error with a message fit to show an admin. */
export function parsePresetInput(b: any): PresetInput {
  const name = typeof b?.name === "string" ? b.name.trim() : "";
  if (!name || name.length > 60) throw new Error("name is required (max 60 characters)");
  const libs = b.libraries;
  if (libs !== "all" && !(Array.isArray(libs) && libs.every((x: unknown) => typeof x === "string"))) throw new Error("libraries must be \"all\" or a list of library ids");
  if (!Number.isInteger(b.bitrateLimit) || b.bitrateLimit < 0) throw new Error("bitrateLimit must be 0 (unlimited) or a positive number of bits per second");
  if (typeof b.remoteAccess !== "boolean") throw new Error("remoteAccess must be true or false");
  if (!["none", "request", "auto"].includes(b.requestRights)) throw new Error("requestRights must be none, request or auto");
  const md = b.membershipDays ?? null;
  if (md !== null && (!Number.isInteger(md) || md <= 0)) throw new Error("membershipDays must be empty or a positive whole number");
  return { name, libraries: libs, bitrateLimit: b.bitrateLimit, remoteAccess: b.remoteAccess, requestRights: b.requestRights, membershipDays: md };
}

export function presetToPolicy(p: Preset): JfPolicy {
  return {
    EnableAllFolders: p.libraries === "all",
    EnabledFolders: p.libraries === "all" ? [] : p.libraries,
    RemoteClientBitrateLimit: p.bitrateLimit,
    EnableRemoteAccess: p.remoteAccess,
  };
}

export async function listPresets(db: D1Database): Promise<Preset[]> {
  return (await all<Row>(db, "SELECT * FROM presets ORDER BY is_default DESC, name")).map(fromRow);
}
export async function getPreset(db: D1Database, id: string): Promise<Preset | null> {
  const r = await first<Row>(db, "SELECT * FROM presets WHERE id = ?", id);
  return r ? fromRow(r) : null;
}
export async function createPreset(db: D1Database, p: PresetInput): Promise<Preset> {
  const id = `preset-${crypto.randomUUID()}`;
  await run(db, "INSERT INTO presets (id, name, config_json, membership_days, is_default) VALUES (?,?,?,?,0)", id, p.name, cfgJson(p), p.membershipDays);
  return (await getPreset(db, id))!;
}
export async function updatePreset(db: D1Database, id: string, p: PresetInput) {
  await run(db, "UPDATE presets SET name = ?, config_json = ?, membership_days = ? WHERE id = ?", p.name, cfgJson(p), p.membershipDays, id);
}
export async function clonePreset(db: D1Database, id: string): Promise<Preset> {
  const src = await getPreset(db, id);
  if (!src) throw new Error("preset not found");
  return createPreset(db, { ...src, name: `${src.name} (copy)` });
}
export async function deletePreset(db: D1Database, id: string) {
  const used = await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM invites WHERE preset_id = ?", id);
  if (used && used.n > 0) throw new Error("preset is in use by invites");
  await run(db, "DELETE FROM presets WHERE id = ?", id);
}
/** Pushes the preset's policy to every member on it (never to admins), carrying on past failures. Editing a preset alone never does this. */
export async function applyPresetToMembers(db: D1Database, jf: Pick<Jellyfin, "setPolicy" | "listUsers">, id: string, actor: string, seerr?: Pick<Seerr, "setPermissions">) {
  const p = await getPreset(db, id);
  if (!p) throw new Error("preset not found");
  const admins = new Set((await jf.listUsers()).filter((u) => u.isAdmin).map((u) => u.id));
  const members = await all<{ jellyfin_id: string; seerr_user_id: number | null }>(db, "SELECT jellyfin_id, seerr_user_id FROM members WHERE preset_id = ?", id);
  const result = { applied: 0, skipped: [] as Array<{ id: string; reason: string }>, failed: [] as Array<{ id: string; error: string }> };
  for (const m of members) {
    if (admins.has(m.jellyfin_id)) { result.skipped.push({ id: m.jellyfin_id, reason: "admin" }); continue; } // an admin keeps their own access
    try {
      await jf.setPolicy(m.jellyfin_id, presetToPolicy(p));
      if (seerr && m.seerr_user_id !== null) await seerr.setPermissions(m.seerr_user_id, p.requestRights);
      result.applied++;
    } catch (e) { result.failed.push({ id: m.jellyfin_id, error: (e as Error).message.slice(0, 200) }); }
  }
  await audit(db, actor, "preset.apply", id, { applied: result.applied, skipped: result.skipped.length, failed: result.failed.length });
  return result;
}

/** Plain-language list of what a preset grants, shown on invite pages and in invite emails. */
export function describePreset(p: Preset): string[] {
  return [
    p.libraries === "all" ? "Every library" : `${p.libraries.length} ${p.libraries.length === 1 ? "library" : "libraries"}`,
    p.bitrateLimit === 0 ? "No streaming quality limit" : `Streaming up to ${Math.round(p.bitrateLimit / 1_000_000)} Mbps`,
    p.remoteAccess ? "Watch away from home" : "Home network only",
    { none: "Can't request titles", request: "Can request films and TV", auto: "Requests are approved automatically" }[p.requestRights],
    p.membershipDays ? `Access for ${p.membershipDays} days` : "No end date",
  ];
}
