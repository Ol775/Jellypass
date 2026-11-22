import { Hono } from "hono";
import type { Context } from "hono";
import { endSessionsFor, rateReserve, requireSession, type AppEnv } from "../auth";
import { audit } from "../audit";
import { purgeMfa } from "../mfa";
import { all, first, run } from "../db";
import { ensureMember, purgeMember } from "../members";
import { migrate, parseExport } from "../migrate";
import { cityForIp } from "../signins";
import { getPreset, presetToPolicy } from "../presets";
import { maintenanceState } from "../maintenance";
import { jellyfinForMembers } from "../addresses";

export const adminRoutes = new Hono<AppEnv>();
type C = Context<AppEnv>;
const actor = (c: C) => c.get("session").username;

// ---------- users ----------
adminRoutes.get("/api/admin/users", async (c) => {
  const [jfUsers, members, presets, seen, twoFa] = await Promise.all([
    c.var.jf.listUsers(),
    all<any>(c.env.DB, "SELECT * FROM members"),
    all<{ id: string; name: string }>(c.env.DB, "SELECT id, name FROM presets"),
    all<{ jellyfin_id: string; m: string }>(c.env.DB, "SELECT jellyfin_id, MAX(seen_at) AS m FROM signins GROUP BY jellyfin_id"),
    all<{ id: string }>(c.env.DB, "SELECT jellyfin_id AS id FROM mfa_totp WHERE enabled = 1 UNION SELECT jellyfin_id FROM passkeys"),
  ]);
  const has2fa = new Set(twoFa.map((r) => r.id));
  const mm = new Map(members.map((m) => [m.jellyfin_id, m])), pp = new Map(presets.map((p) => [p.id, p.name])), ss = new Map(seen.map((s) => [s.jellyfin_id, s.m]));
  const q = (c.req.query("search") ?? "").trim().toLowerCase(), filter = c.req.query("filter") ?? "";
  const now = new Date().toISOString();
  return c.json(jfUsers.map((u) => {
    const m = mm.get(u.id);
    return { id: u.id, name: u.name, isAdmin: u.isAdmin, isDisabled: u.isDisabled, expiresAt: m?.expires_at ?? null, contactEmail: m?.contact_email ?? null, emailVerified: !!m?.email_verified, presetId: m?.preset_id ?? null, presetName: m?.preset_id ? pp.get(m.preset_id) ?? null : null, lastSeen: ss.get(u.id) ?? null, twoFactor: has2fa.has(u.id) };
  }).filter((u) => (!q || u.name.toLowerCase().includes(q)) && (
    filter === "expired" ? !!u.expiresAt && u.expiresAt < now : filter === "disabled" ? u.isDisabled : filter === "admins" ? u.isAdmin :
    filter === "active" ? !u.isDisabled && !(u.expiresAt && u.expiresAt < now) : true)));
});

type Result = { id: string; ok: true } | { id: string; ok: false; error: string };
async function userAction(c: C, id: string, action: "disable" | "enable" | "extend" | "indefinite", days?: number): Promise<Result> {
  const fail = (error: string): Result => ({ id, ok: false, error });
  let u;
  try { u = await c.var.jf.getUser(id); } catch { return fail("Jellyfin is unavailable"); }
  if (!u) return fail("no such user");
  try {
    if (action === "disable") {
      if (u.isAdmin || id === c.get("session").jellyfinId) return fail("admins cannot be disabled here");
      await c.var.jf.setPolicy(id, { IsDisabled: true });
      await c.var.jf.deleteDevices(id);
      await endSessionsFor(c.env.DB, id);
    } else if (action === "enable") {
      await c.var.jf.setPolicy(id, { IsDisabled: false });
    } else if (action === "indefinite") {
      if (u.isAdmin) return { id, ok: true }; // admins never expire, so there is nothing to change
      await ensureMember(c.env.DB, id, u.name);
      await run(c.env.DB, "UPDATE members SET expires_at = NULL, reminder_days_sent = '[]', expiry_done = 0 WHERE jellyfin_id = ?", id);
      if (u.isDisabled) await c.var.jf.setPolicy(id, { IsDisabled: false }); // same as extending: lifting an expiry brings the account back
      await audit(c.env.DB, actor(c), "user.indefinite", id);
      return { id, ok: true };
    } else {
      if (u.isAdmin) return fail("admins do not expire"); // an expiry on an admin would eventually lock them out
      await ensureMember(c.env.DB, id, u.name);
      const m = await first<{ expires_at: string | null }>(c.env.DB, "SELECT expires_at FROM members WHERE jellyfin_id = ?", id);
      const base = Math.max(Date.now(), m?.expires_at ? Date.parse(m.expires_at) : 0);
      const next = new Date(base + days! * 86400_000).toISOString();
      await run(c.env.DB, "UPDATE members SET expires_at = ?, reminder_days_sent = '[]', expiry_done = 0 WHERE jellyfin_id = ?", next, id);
      if (u.isDisabled) await c.var.jf.setPolicy(id, { IsDisabled: false });
      await audit(c.env.DB, actor(c), "user.extend", id, { days, expiresAt: next });
      return { id, ok: true };
    }
  } catch { return fail("Jellyfin refused the change"); }
  await audit(c.env.DB, actor(c), `user.${action}`, id);
  return { id, ok: true };
}
const validDays = (d: unknown): d is number => Number.isInteger(d) && (d as number) >= 1 && (d as number) <= 3650;

adminRoutes.post("/api/admin/users/bulk", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (!["disable", "enable", "extend", "indefinite"].includes(b.action) || !Array.isArray(b.ids) || b.ids.length < 1 || b.ids.length > 100 || !b.ids.every((i: unknown) => typeof i === "string")) return c.json({ error: "choose an action and up to 100 users" }, 400);
  if (b.action === "extend" && !validDays(b.days)) return c.json({ error: "days must be between 1 and 3650" }, 400);
  const results: Result[] = [];
  for (const id of b.ids) results.push(await userAction(c, id, b.action, b.days));
  return c.json({ results });
});
for (const action of ["disable", "enable"] as const)
  adminRoutes.post(`/api/admin/users/:id/${action}`, async (c) => {
    const r = await userAction(c, c.req.param("id"), action);
    return r.ok ? c.json({ ok: true }) : c.json({ error: r.error }, 400);
  });
/** For a member who has lost their phone and recovery codes: removes their authenticator app, passkeys and recovery codes so they can sign in with just a password and set it up again. */
adminRoutes.post("/api/admin/users/:id/reset-2fa", async (c) => {
  const id = c.req.param("id"), me = c.get("session"), b = await c.req.json().catch(() => ({}));
  let target;
  try { target = await c.var.jf.getUser(id); } catch { return c.json({ error: "jellyfin unavailable" }, 503); }
  if (!target) return c.json({ error: "no such user" }, 404);
  if (target.isAdmin) return c.json({ error: "admin accounts cannot be reset here" }, 403);
  if (!(await rateReserve(c.env.DB, `resetmfa:${me.jellyfinId}`, 5, 900))) return c.json({ error: "too many attempts, try again later" }, 429);
  let who;
  try { who = await c.var.jf.authenticate(me.username, String(b.password ?? "").slice(0, 200)); } catch { return c.json({ error: "jellyfin unavailable" }, 503); }
  if (!who || who.id !== me.jellyfinId) return c.json({ error: "your password is not right" }, 403);
  if (!(await first(c.env.DB, "SELECT 1 AS x FROM mfa_totp WHERE jellyfin_id = ?1 UNION SELECT 1 FROM passkeys WHERE jellyfin_id = ?1 LIMIT 1", id))) return c.json({ error: "this user has no two-step sign-in set up" }, 400);
  await purgeMfa(c.env.DB, id);
  await run(c.env.DB, "DELETE FROM sessions WHERE jellyfin_id = ?", id);
  await audit(c.env.DB, actor(c), "user.reset_2fa", id);
  return c.json({ ok: true });
});
adminRoutes.post("/api/admin/users/:id/indefinite", async (c) => {
  const r = await userAction(c, c.req.param("id"), "indefinite");
  return r.ok ? c.json({ ok: true }) : c.json({ error: r.error }, 400);
});
/** Set an exact end date (end of that day, UTC), for a member who has none or whose date should change. Today or later only. */
adminRoutes.post("/api/admin/users/:id/end-date", async (c) => {
  const id = c.req.param("id"), b = await c.req.json().catch(() => ({})), day = String(b.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) return c.json({ error: "choose a date" }, 400);
  if (day < new Date().toISOString().slice(0, 10)) return c.json({ error: "the end date cannot be in the past" }, 400);
  if (day > "2100-01-01") return c.json({ error: "that date is too far away" }, 400);
  let u;
  try { u = await c.var.jf.getUser(id); } catch { return c.json({ error: "jellyfin unavailable" }, 503); }
  if (!u) return c.json({ error: "no such user" }, 404);
  if (u.isAdmin) return c.json({ error: "admins do not expire" }, 400);
  const next = `${day}T23:59:59.000Z`;
  await ensureMember(c.env.DB, id, u.name);
  await run(c.env.DB, "UPDATE members SET expires_at = ?, reminder_days_sent = '[]', expiry_done = 0 WHERE jellyfin_id = ?", next, id);
  if (u.isDisabled) await c.var.jf.setPolicy(id, { IsDisabled: false }).catch(() => {});
  await audit(c.env.DB, actor(c), "user.end_date", id, { expiresAt: next });
  return c.json({ ok: true });
});
adminRoutes.post("/api/admin/users/:id/extend", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (!validDays(b.days)) return c.json({ error: "days must be between 1 and 3650" }, 400);
  const r = await userAction(c, c.req.param("id"), "extend", b.days);
  return r.ok ? c.json({ ok: true }) : c.json({ error: r.error }, 400);
});

/** Gives a member (including an existing Jellyfin user who has never used Jellypass) an access level. */
adminRoutes.post("/api/admin/users/:id/preset", async (c) => {
  const id = c.req.param("id"), b = await c.req.json().catch(() => ({}));
  const preset = await getPreset(c.env.DB, String(b.presetId ?? ""));
  if (!preset) return c.json({ error: "choose an access level" }, 400);
  const u = await c.var.jf.getUser(id).catch(() => null);
  if (!u) return c.json({ error: "no such user" }, 404);
  if (u.isAdmin) return c.json({ error: "admins keep their own access and cannot be given an access level here" }, 400); // would overwrite their Jellyfin policy and Seerr rights
  try { await c.var.jf.setPolicy(id, presetToPolicy(preset)); } catch { return c.json({ error: "Jellyfin refused the change" }, 502); }
  await ensureMember(c.env.DB, id, u.name);
  await run(c.env.DB, "UPDATE members SET preset_id = ? WHERE jellyfin_id = ?", preset.id, id);
  const m = await first<{ seerr_user_id: number | null }>(c.env.DB, "SELECT seerr_user_id FROM members WHERE jellyfin_id = ?", id);
  if (m?.seerr_user_id) await c.var.seerr.setPermissions(m.seerr_user_id, preset.requestRights).catch(() => {});
  await audit(c.env.DB, actor(c), "user.preset", id, { preset: preset.name });
  return c.json({ ok: true });
});

adminRoutes.delete("/api/admin/users/:id", async (c) => {
  const id = c.req.param("id"), b = await c.req.json().catch(() => ({}));
  const u = await c.var.jf.getUser(id).catch(() => null);
  if (!u) return c.json({ error: "no such user" }, 404);
  if (u.isAdmin || id === c.get("session").jellyfinId) return c.json({ error: "admins cannot be deleted here" }, 400);
  if (b.confirm !== u.name) return c.json({ error: "type the username to confirm" }, 400);
  const m = await first<{ seerr_user_id: number | null }>(c.env.DB, "SELECT seerr_user_id FROM members WHERE jellyfin_id = ?", id);
  try { await c.var.jf.deleteUser(id); } catch { return c.json({ error: "Jellyfin refused to delete the user" }, 502); }
  if (m?.seerr_user_id) await c.var.seerr.deleteUser(m.seerr_user_id).catch(() => {});
  await purgeMember(c.env.DB, id);
  await audit(c.env.DB, actor(c), "user.delete", id, { name: u.name });
  return c.json({ ok: true });
});

adminRoutes.get("/api/admin/libraries", async (c) => {
  try { return c.json(await c.var.jf.libraries()); } catch { return c.json({ error: "could not load libraries from Jellyfin" }, 502); }
});

// ---------- live streams ----------
type SessionRow = { id: string; userName: string; deviceName: string; remoteIp: string | null; itemId: string | null };
/** Tracearr and Jellyfin can name a device differently ("iPad" vs "Iain's iPad"): exact, then partial, then the user's only session. */
function matchSession(sessions: SessionRow[], st: { username: string; device: string }): SessionRow | undefined {
  const mine = sessions.filter((x) => x.userName.toLowerCase() === st.username.toLowerCase());
  const dev = st.device.toLowerCase();
  return mine.find((x) => x.deviceName.toLowerCase() === dev) ?? mine.find((x) => dev && (x.deviceName.toLowerCase().includes(dev) || dev.includes(x.deviceName.toLowerCase()))) ?? (mine.length === 1 ? mine[0] : undefined);
}
adminRoutes.get("/api/admin/streams", async (c) => {
  let streams;
  try { streams = await c.var.tracearr.liveStreams(); } catch { return c.json({ streams: [], degraded: true }); }
  // The viewer's IP comes from Jellyfin's live sessions (Tracearr's public API has none). Portal-seen cities win;
  // the fallback lookup is local (MMDB in R2), so no IP leaves the Worker.
  let sessions: Array<SessionRow> = [];
  try { sessions = await c.var.jf.sessions(); } catch { /* streams are still shown, just without IP */ }
  const enriched = [];
  for (const st of streams) { // one at a time: concurrent lookups would each load the whole GeoIP file
   enriched.push(await (async () => {
    const m = matchSession(sessions, st);
    const ip = m?.remoteIp ?? null;
    const seen = ip ? await cityForIp(c.env.DB, ip) : null;
    let city = seen?.city ?? null, lat = seen?.lat ?? null, lng = seen?.lng ?? null;
    if (city === null && ip) { const g = await c.var.geo.lookup(ip); city = g?.city ?? g?.country ?? null; lat = g?.lat ?? null; lng = g?.lng ?? null; } // a country-only GeoLite2 file still gives a place
    const isp = ip ? (await c.var.asn.lookup(ip))?.org ?? null : null;
    // The poster loads in the admin's browser from Jellyfin, like Home and Watch history.
    const posterUrl = m?.itemId ? `${jellyfinForMembers(c.env)}/Items/${encodeURIComponent(m.itemId)}/Images/Primary?maxHeight=300` : null;
    const round = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100); // city-level only
    return { ...st, ip, city, lat: round(lat), lng: round(lng), isp, posterUrl };
   })());
  }
  return c.json({ streams: enriched });
});
adminRoutes.post("/api/admin/streams/:id/message", async (c) => {
  const id = c.req.param("id");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return c.json({ error: "bad stream id" }, 400);
  const message = String((await c.req.json().catch(() => ({}))).message ?? "").trim().slice(0, 200);
  if (!message) return c.json({ error: "type a message first" }, 400);
  let st;
  try { st = (await c.var.tracearr.liveStreams()).find((s) => s.id === id); } catch { return c.json({ error: "Tracearr is unavailable" }, 503); }
  if (!st) return c.json({ error: "that stream has ended" }, 404);
  let target;
  try { target = matchSession(await c.var.jf.sessions(), st); } catch { return c.json({ error: "Jellyfin is unavailable" }, 502); }
  if (!target?.id) return c.json({ error: "could not find that viewer's session in Jellyfin" }, 404);
  try { await c.var.jf.sendMessage(target.id, message); } catch { return c.json({ error: "Jellyfin could not show the message" }, 502); }
  await audit(c.env.DB, actor(c), "stream.message", id, { message });
  return c.json({ ok: true });
});
adminRoutes.post("/api/admin/streams/:id/terminate", async (c) => {
  const id = c.req.param("id");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return c.json({ error: "bad stream id" }, 400);
  const message = String((await c.req.json().catch(() => ({}))).message ?? "").slice(0, 200) || undefined;
  try { await c.var.tracearr.terminate(id, message); } catch { return c.json({ error: "Tracearr is unavailable" }, 503); }
  await audit(c.env.DB, actor(c), "stream.terminate", id, { message: message ?? null });
  return c.json({ ok: true });
});

// ---------- announcements ----------
adminRoutes.get("/api/announcements", requireSession, async (c) =>
  c.json(await all(c.env.DB, "SELECT id, title, body, kind, created_at FROM announcements WHERE active = 1 ORDER BY id DESC LIMIT 20")));
adminRoutes.post("/api/admin/announcements", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const title = String(b.title ?? "").trim(), body = String(b.body ?? "").trim(), kind = b.kind ?? "info";
  if (!title || title.length > 120 || !body || body.length > 2000 || !["info", "incident"].includes(kind)) return c.json({ error: "add a title (max 120) and message (max 2000)" }, 400);
  const r = await first<{ id: number }>(c.env.DB, "INSERT INTO announcements (title, body, kind, created_by) VALUES (?,?,?,?) RETURNING id", title, body, kind, actor(c));
  await audit(c.env.DB, actor(c), "announcement.create", String(r!.id), { title });
  return c.json({ id: r!.id }, 201);
});
adminRoutes.delete("/api/admin/announcements/:id", async (c) => {
  await run(c.env.DB, "UPDATE announcements SET active = 0 WHERE id = ?", c.req.param("id"));
  await audit(c.env.DB, actor(c), "announcement.remove", c.req.param("id"));
  return c.json({ ok: true });
});

// ---------- audit + settings ----------
adminRoutes.get("/api/admin/audit", async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 100) || 100, 1), 200), before = Number(c.req.query("before") ?? 0) || 2 ** 53;
  return c.json(await all(c.env.DB, "SELECT a.id, a.actor, a.action, a.target, a.detail_json, a.at, m.username AS target_name FROM audit a LEFT JOIN members m ON m.jellyfin_id = a.target WHERE a.id < ? ORDER BY a.id DESC LIMIT ?", before, limit)); // target_name: the member a jellyfin id belongs to, when it is one
});
adminRoutes.get("/api/admin/settings", async (c) => {
  const r = await first<{ value: string }>(c.env.DB, "SELECT value FROM settings WHERE key = 'outage_email'");
  return c.json({ outageEmail: r?.value === "1" });
});
adminRoutes.put("/api/admin/settings", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (typeof b.outageEmail !== "boolean") return c.json({ error: "outageEmail must be true or false" }, 400);
  await run(c.env.DB, "INSERT INTO settings (key, value) VALUES ('outage_email', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", b.outageEmail ? "1" : "0");
  await audit(c.env.DB, actor(c), "settings.update", "outage_email", { value: b.outageEmail });
  return c.json({ ok: true });
});

adminRoutes.get("/api/admin/digest", async (c) => c.json({ email: (await first<{ value: string }>(c.env.DB, "SELECT value FROM settings WHERE key = 'digest_email'"))?.value ?? "" }));
adminRoutes.put("/api/admin/digest", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const email = typeof b.email === "string" ? b.email.trim() : null;
  if (email === null || email.length > 200 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return c.json({ error: "enter a valid email address, or leave it empty to turn the digest off" }, 400);
  if (email) await run(c.env.DB, "INSERT INTO settings (key, value) VALUES ('digest_email', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", email);
  else await run(c.env.DB, "DELETE FROM settings WHERE key = 'digest_email'");
  await audit(c.env.DB, actor(c), "settings.update", "digest_email", { on: !!email });
  return c.json({ ok: true });
});

// ---------- maintenance mode ----------
adminRoutes.get("/api/admin/maintenance", async (c) => c.json(await maintenanceState(c.env.DB)));
adminRoutes.put("/api/admin/maintenance", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (typeof b.enabled !== "boolean") return c.json({ error: "enabled must be true or false" }, 400);
  const iso = (x: unknown) => (x == null || x === "" ? null : Number.isFinite(Date.parse(String(x))) ? new Date(String(x)).toISOString() : undefined);
  const startsAt = iso(b.startsAt), endsAt = iso(b.endsAt);
  if (startsAt === undefined || endsAt === undefined) return c.json({ error: "enter valid start and end times" }, 400);
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) return c.json({ error: "the end time must be after the start time" }, 400);
  if (endsAt && !startsAt) return c.json({ error: "add a start time as well, or clear the end time" }, 400);
  const message = String(b.message ?? "").trim().slice(0, 300);
  const put = (k: string, v: string) => run(c.env.DB, "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", k, v);
  await put("maintenance", b.enabled ? "1" : "0"); await put("maintenance_message", message);
  await put("maintenance_start", startsAt ?? ""); await put("maintenance_end", endsAt ?? "");
  await audit(c.env.DB, actor(c), "settings.maintenance", "maintenance", { enabled: b.enabled, message, startsAt, endsAt });
  return c.json({ ok: true });
});

// ---------- help messages ----------
adminRoutes.post("/api/help/message", requireSession, async (c) => {
  const s = c.get("session"), b = await c.req.json().catch(() => ({}));
  const subject = String(b.subject ?? "").trim(), body = String(b.body ?? "").trim();
  if (!subject || subject.length > 120 || !body || body.length > 4000) return c.json({ error: "add a subject (max 120) and message (max 4000)" }, 400);
  if (!(await rateReserve(c.env.DB, `help:${s.jellyfinId}`, 5, 3600))) return c.json({ error: "you have sent a lot of messages, try again later" }, 429);
  let diagnostics: string | null = null;
  if (b.diagnostics === true) {
    // Built on the server so the member cannot forge it, and with no IP addresses in it.
    const devs = await all<{ device: string; source: string; seen_at: string }>(c.env.DB, "SELECT device, source, seen_at FROM signins WHERE jellyfin_id = ? ORDER BY seen_at DESC LIMIT 5", s.jellyfinId);
    const checks = await all<{ service: string; ok: number }>(c.env.DB, "SELECT service, ok FROM status_checks WHERE id IN (SELECT MAX(id) FROM status_checks GROUP BY service)");
    diagnostics = [`Member: ${s.username}`, `Environment: ${c.env.ENVIRONMENT}`, `Recent devices: ${devs.map((d) => `${d.device || "unknown"} (${d.source}, ${d.seen_at.slice(0, 10)})`).join("; ") || "none"}`, `Latest checks: ${checks.map((k) => `${k.service} ${k.ok ? "ok" : "down"}`).join(", ") || "none"}`].join("\n");
  }
  await run(c.env.DB, "INSERT INTO help_messages (jellyfin_id, username, subject, body, diagnostics) VALUES (?,?,?,?,?)", s.jellyfinId, s.username, subject, body, diagnostics);
  return c.json({ ok: true }, 201);
});
adminRoutes.get("/api/admin/messages", async (c) =>
  c.json((await all<any>(c.env.DB, "SELECT id, jellyfin_id, username, subject, body, diagnostics, resolved, created_at FROM help_messages ORDER BY resolved, id DESC LIMIT 200")).map((m) => ({ ...m, resolved: !!m.resolved }))));
adminRoutes.post("/api/admin/messages/:id/resolve", async (c) => {
  await run(c.env.DB, "UPDATE help_messages SET resolved = 1 WHERE id = ?", c.req.param("id"));
  return c.json({ ok: true });
});

// ---------- jfa-go migration ----------
adminRoutes.post("/api/admin/migrate/jfa-go", async (c) => {
  if (Number(c.req.header("content-length") ?? 0) > 1_000_000) return c.json({ error: "export too large" }, 413);
  const b = await c.req.json().catch(() => ({}));
  let exp;
  try { exp = parseExport(b.export); } catch (e) { return c.json({ error: (e as Error).message }, 400); }
  // Only an explicit dryRun:false writes anything.
  return c.json(await migrate({ db: c.env.DB, jf: c.var.jf, actor: actor(c) }, exp, { dryRun: b.dryRun !== false, trustEmails: b.trustEmails === true }));
});
