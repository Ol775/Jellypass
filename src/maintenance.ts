import type { MiddlewareHandler } from "hono";
import { loadSession, type AppEnv } from "./auth";
import { all } from "./db";
import { maintenancePage, type ServiceStatus } from "./views/error-pages";
import { jellyfinForMembers, seerrForMembers } from "./addresses";

export type MaintenanceState = { enabled: boolean; message: string; startsAt: string | null; endsAt: string | null; active: boolean };
const KEYS = "'maintenance', 'maintenance_message', 'maintenance_start', 'maintenance_end'";
/** Maintenance is active when the switch is on, or when the clock is inside the scheduled window. */
export async function maintenanceState(db: D1Database, now = Date.now()): Promise<MaintenanceState> {
  const rows = await all<{ key: string; value: string }>(db, `SELECT key, value FROM settings WHERE key IN (${KEYS})`);
  const v = (k: string) => rows.find((r) => r.key === k)?.value ?? "";
  const startsAt = v("maintenance_start") || null, endsAt = v("maintenance_end") || null;
  const s = startsAt ? Date.parse(startsAt) : NaN, e = endsAt ? Date.parse(endsAt) : NaN;
  const inWindow = Number.isFinite(s) && now >= s && (!Number.isFinite(e) || now < e);
  const enabled = v("maintenance") === "1";
  return { enabled, message: v("maintenance_message"), startsAt, endsAt, active: enabled || inWindow };
}

// Paths that must keep working so admins can sign in (via /signin?admin=1) and turn maintenance off, and the page itself can load its assets.
const open = (p: string, adminLink: boolean) => p.startsWith("/assets/") || p === "/health" || (p === "/signin" && adminLink) || p === "/api/signin" || p === "/api/signout" || p.startsWith("/api/signin-posters");
const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(iso));

/** Latest cron check for Jellyfin and Seerr (public status only). Checks older than 15 minutes count as unknown. */
async function serviceStatuses(env: AppEnv["Bindings"], now = Date.now()): Promise<ServiceStatus[]> {
  const rows = await all<{ service: string; ok: number; at: string }>(env.DB, "SELECT service, ok, at FROM status_checks WHERE id IN (SELECT max(id) FROM status_checks WHERE service IN ('jellyfin','seerr') GROUP BY service)").catch(() => []);
  const link = (u?: string) => { try { const x = new URL(u ?? ""); return x.protocol === "https:" ? x.origin : undefined; } catch { return undefined; } }; // never link a LAN address
  return ([["jellyfin", "Jellyfin", jellyfinForMembers(env)], ["seerr", "Jellyseerr", seerrForMembers(env)]] as const).map(([key, name, url]) => {
    const r = rows.find((x) => x.service === key);
    const fresh = r && now - Date.parse(r.at) < 15 * 60_000;
    return { name, url: link(url), state: !fresh ? "unknown" : r.ok ? "up" : "down" } as ServiceStatus;
  });
}

/** While maintenance is active, everyone except signed-in admins gets a 503 (maintenance page, or JSON for /api). */
export const maintenanceGate: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (open(c.req.path, c.req.query("admin") === "1")) return next(); // /signin?admin=1 is the admins' way in; everyone else sees the maintenance page
  let state: MaintenanceState;
  try { state = await maintenanceState(c.env.DB); } catch { return next(); } // never lock everyone out because of a settings read problem
  if (!state.active) return next();
  if ((await loadSession(c).catch(() => null))?.isAdmin) return next();
  const back = state.endsAt && Date.parse(state.endsAt) > Date.now() ? `Expected back around ${when(state.endsAt)}.` : "";
  const message = [state.message, back].filter(Boolean).join(" ");
  c.header("Retry-After", state.endsAt && Date.parse(state.endsAt) > Date.now() ? String(Math.max(60, Math.min(3600, Math.round((Date.parse(state.endsAt) - Date.now()) / 1000)))) : "300");
  c.header("Cache-Control", "no-store");
  if (c.req.path.startsWith("/api/")) return c.json({ error: "maintenance", message: message || "Jellypass is down for maintenance. Please try again soon." }, 503);
  return c.html(maintenancePage(message || undefined, await serviceStatuses(c.env)), 503);
};
