import { Hono } from "hono";
import { audit } from "../audit";
import { endSessionsFor, type AppEnv } from "../auth";
import { all, first, run } from "../db";
import { maintenanceState } from "../maintenance";

export const securityRoutes = new Hono<AppEnv>();
const actor = (c: { get: (k: "session") => { username: string } }) => c.get("session").username;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
// Same limits the sign-in route uses (src/routes/auth.ts), shown here so admins can see and clear lockouts.
const SIGNIN_MAX = 5, SIGNIN_WINDOW_MS = 15 * 60_000;
// Audit actions an admin would want to review as "security events".
const SECURITY_ACTIONS = ["signin.not_me", "password.change", "password.reset", "key.set", "key.remove", "settings.update", "settings.maintenance", "user.delete", "user.preset", "account.sign_out_devices", "account.sign_out_others", "security.revoke_session", "security.sign_out_all", "security.sign_out_user", "security.clear_lockout", "user.indefinite", "user.end_date", "user.reset_2fa", "user.disable", "user.enable", "2fa.totp_off", "2fa.passkey_remove", "invite.create", "invite.revoke", "migrate.jfa_go", "expiry.failed"];

type Check = { id: string; label: string; status: "ok" | "warn" | "bad" | "info"; detail: string };

securityRoutes.get("/api/admin/security", async (c) => {
  const e = c.env, db = e.DB, nowIso = new Date().toISOString();
  const [sessions, locks, members, keys, events, notMe, maint, admins] = await Promise.all([
    all<any>(db, "SELECT id, username, is_admin, label, city, created_at, checked_at, expires_at FROM sessions WHERE expires_at > ? ORDER BY is_admin DESC, created_at DESC LIMIT 200", nowIso),
    all<any>(db, "SELECT key, window_start, count FROM rate_limits WHERE key LIKE 'signin:%' AND count >= ? AND window_start > ?", SIGNIN_MAX, ago(SIGNIN_WINDOW_MS)),
    first<any>(db, "SELECT COUNT(*) AS total, SUM(contact_email IS NULL) AS no_email, SUM(contact_email IS NOT NULL AND email_verified = 0) AS unverified, SUM(alerts_email = 0) AS alerts_off FROM members"),
    all<any>(db, "SELECT name, updated_at, updated_by FROM integration_keys ORDER BY name"),
    all<any>(db, `SELECT id, actor, action, target, at FROM audit WHERE action IN (${SECURITY_ACTIONS.map(() => "?").join(",")}) ORDER BY id DESC LIMIT 40`, ...SECURITY_ACTIONS),
    first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM audit WHERE action = 'signin.not_me' AND at > ?", ago(30 * 86400_000)),
    maintenanceState(db),
    c.var.jf.listUsers().then((u) => u.filter((x) => x.isAdmin).map((x) => ({ id: x.id, name: x.name, disabled: x.isDisabled }))).catch(() => null),
  ]);
  const me = c.get("session");
  const lockouts = locks.map((l) => {
    const [, kind, ...rest] = String(l.key).split(":");
    return { key: l.key, kind: kind === "ip" ? "ip" : "user", subject: rest.join(":"), attempts: l.count, until: new Date(Date.parse(l.window_start) + SIGNIN_WINDOW_MS).toISOString() };
  });
  const m = members ?? { total: 0, no_email: 0, unverified: 0, alerts_off: 0 };
  const adminSessions = sessions.filter((s) => s.is_admin).length;
  const checks: Check[] = [
    { id: "keys-secret", label: "API keys are encrypted at rest", status: e.KEYS_SECRET ? "ok" : "warn", detail: e.KEYS_SECRET ? "Keys set in Settings are stored encrypted." : "KEYS_SECRET is not set, so keys can only come from Worker secrets." },
    { id: "session-secret", label: "Sessions are signed", status: e.SESSION_SECRET ? "ok" : "bad", detail: e.SESSION_SECRET ? "Session cookies are signed with a secret." : "SESSION_SECRET is missing." },
    { id: "upstream-key", label: "Jellyfin and Seerr firewall bypass key", status: e.UPSTREAM_KEY ? "ok" : "warn", detail: e.UPSTREAM_KEY ? "Requests from Jellypass carry the firewall key." : "UPSTREAM_KEY is not set; the geo firewall may block Jellypass." },
    { id: "bot-protection", label: "Bot protection on sign-in", status: e.ENVIRONMENT === "prod" ? (e.TURNSTILE_SECRET && e.TURNSTILE_SITEKEY ? "ok" : "bad") : "info", detail: e.ENVIRONMENT === "prod" ? (e.TURNSTILE_SECRET && e.TURNSTILE_SITEKEY ? "Cloudflare Turnstile is active." : "Turnstile is not configured.") : "Turnstile is only used in production; beta sits behind Cloudflare Access." },
    { id: "admins", label: "Admin accounts", status: admins === null ? "warn" : admins.length > 3 ? "warn" : "ok", detail: admins === null ? "Could not read the admin list from Jellyfin." : `${admins.length} admin account${admins.length === 1 ? "" : "s"} in Jellyfin${admins.length > 3 ? ". Review whether each still needs it." : "."}` },
    { id: "admin-sessions", label: "Admin sign-ins right now", status: adminSessions > 3 ? "warn" : "ok", detail: `${adminSessions} active admin session${adminSessions === 1 ? "" : "s"}.` },
    { id: "lockouts", label: "Sign-in lockouts", status: lockouts.length ? "warn" : "ok", detail: lockouts.length ? `${lockouts.length} address or name currently locked out after repeated failures.` : "Nobody is locked out." },
    { id: "not-me", label: "“This wasn’t me” reports (30 days)", status: (notMe?.n ?? 0) > 0 ? "warn" : "ok", detail: (notMe?.n ?? 0) > 0 ? `${notMe!.n} report${notMe!.n === 1 ? "" : "s"}. Check the events below.` : "None reported." },
    { id: "emails", label: "Members with a verified email", status: (m.no_email ?? 0) + (m.unverified ?? 0) > 0 ? "warn" : "ok", detail: `${m.unverified ?? 0} not verified, ${m.no_email ?? 0} without an email, out of ${m.total ?? 0}. Verified emails are needed for password resets and sign-in alerts.` },
    { id: "alerts-off", label: "Sign-in alerts", status: (m.alerts_off ?? 0) > 0 ? "warn" : "ok", detail: (m.alerts_off ?? 0) > 0 ? `${m.alerts_off} member${m.alerts_off === 1 ? " has" : "s have"} turned alerts off.` : "On for every member." },
    { id: "maintenance", label: "Maintenance mode", status: maint.active ? "info" : "ok", detail: maint.active ? "On: members cannot use Jellypass right now." : "Off." },
  ];
  return c.json({
    checks,
    sessions: sessions.map((s) => ({ id: s.id, username: s.username, isAdmin: !!s.is_admin, label: s.label ?? "Unknown device", city: s.city ?? null, createdAt: s.created_at ?? null, lastActive: s.checked_at, expiresAt: s.expires_at, current: s.id === me.id })),
    lockouts, admins: admins ?? [],
    keys: keys.map((k) => ({ name: k.name, updatedAt: k.updated_at, updatedBy: k.updated_by })),
    members: { total: m.total ?? 0, noEmail: m.no_email ?? 0, unverified: m.unverified ?? 0, alertsOff: m.alerts_off ?? 0 },
    events: events.map((x) => ({ id: x.id, actor: x.actor, action: x.action, target: x.target, at: x.at })),
    environment: e.ENVIRONMENT,
  });
});

securityRoutes.post("/api/admin/security/sessions/:id/revoke", async (c) => {
  const id = c.req.param("id");
  if (id === c.get("session").id) return c.json({ error: "use Sign out for your own session" }, 400);
  const row = await first<{ username: string }>(c.env.DB, "SELECT username FROM sessions WHERE id = ?", id);
  if (!row) return c.json({ error: "that session has already ended" }, 404);
  await run(c.env.DB, "DELETE FROM sessions WHERE id = ?", id);
  await audit(c.env.DB, actor(c), "security.revoke_session", row.username);
  return c.json({ ok: true });
});

securityRoutes.post("/api/admin/security/users/:id/sign-out", async (c) => {
  const id = c.req.param("id");
  if (id === c.get("session").jellyfinId) return c.json({ error: "use Sign out for your own sessions" }, 400);
  const row = await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM sessions WHERE jellyfin_id = ?", id);
  await endSessionsFor(c.env.DB, id);
  await audit(c.env.DB, actor(c), "security.sign_out_user", id, { sessions: row?.n ?? 0 });
  return c.json({ ok: true, ended: row?.n ?? 0 });
});

/** Emergency button: ends every portal session except the admin pressing it (and, unless asked, other admins). */
securityRoutes.post("/api/admin/security/sign-out-all", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const me = c.get("session"), includeAdmins = b.includeAdmins === true;
  const r = await run(c.env.DB, `DELETE FROM sessions WHERE id != ?${includeAdmins ? "" : " AND is_admin = 0"}`, me.id);
  await audit(c.env.DB, actor(c), "security.sign_out_all", "all", { includeAdmins, ended: r.meta.changes });
  return c.json({ ok: true, ended: r.meta.changes });
});

securityRoutes.post("/api/admin/security/lockouts/clear", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const key = String(b.key ?? "");
  if (!/^signin:(ip|user):[^\s]{1,200}$/.test(key)) return c.json({ error: "not a sign-in lockout" }, 400);
  await run(c.env.DB, "DELETE FROM rate_limits WHERE key = ?", key);
  await audit(c.env.DB, actor(c), "security.clear_lockout", key.startsWith("signin:ip:") ? "ip" : "user");
  return c.json({ ok: true });
});
