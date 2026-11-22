import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import { COOKIE, rateClear, rateReserve, requireSession, type AppEnv } from "../auth";
import { audit } from "../audit";
import { all, first, run } from "../db";
import { renderEmail } from "../emails";
import { BetaGuardError } from "../jellyfin";
import { getHistory } from "../history";
import { getMember, purgeMember } from "../members";
import { getPreset } from "../presets";
import { mfaMethods } from "../mfa";
import { markOwnAuth } from "../signins";

export const accountRoutes = new Hono<AppEnv>();

accountRoutes.post("/api/account/password", requireSession, async (c) => {
  const s = c.get("session");
  const b = await c.req.json().catch(() => ({}));
  const current = String(b.current ?? ""), next = String(b.next ?? "");
  if (next.length < 8) return c.json({ error: "choose a password of at least 8 characters" }, 400);
  if (!(await rateReserve(c.env.DB, `pwchange:${s.jellyfinId}`, 5, 900))) return c.json({ error: "too many attempts, try again later" }, 429);
  let who;
  try { who = await c.var.jf.authenticate(s.username, current); } catch { return c.json({ error: "jellyfin unavailable" }, 503); }
  if (!who || who.id !== s.jellyfinId) return c.json({ error: "your current password is not right" }, 403);
  await markOwnAuth(c.env.DB, s.jellyfinId);
  await rateClear(c.env.DB, `pwchange:${s.jellyfinId}`);
  try { await c.var.jf.setPassword(s.jellyfinId, next); await c.var.jf.deleteDevices(s.jellyfinId); }
  catch { return c.json({ error: "could not change the password right now, try again" }, 503); }
  await run(c.env.DB, "DELETE FROM sessions WHERE jellyfin_id = ? AND id <> ?", s.jellyfinId, s.id); // every other session ends
  await run(c.env.DB, "DELETE FROM magic_links WHERE jellyfin_id = ?", s.jellyfinId);
  await run(c.env.DB, "UPDATE members SET password_changed_at = ? WHERE jellyfin_id = ?", new Date().toISOString(), s.jellyfinId);
  await audit(c.env.DB, s.username, "password.change", s.jellyfinId);
  const m = await getMember(c.env.DB, s.jellyfinId);
  if (m?.contact_email && m.email_verified) {
    const e = renderEmail("password_changed", { name: s.username, when: new Date().toUTCString() });
    await c.var.mailer.send(m.contact_email, e.subject, e.html, e.text, e.inline).catch(() => {});
  }
  return c.json({ ok: true });
});

/** Read-only summary for the Account page. Carries no IP addresses; the Devices page has those. */
accountRoutes.get("/api/account", requireSession, async (c) => {
  const s = c.get("session");
  const m = await getMember(c.env.DB, s.jellyfinId);
  const preset = m?.preset_id ? await getPreset(c.env.DB, m.preset_id) : null;
  const sessions = (await all<{ id: string; label: string | null; city: string | null; created_at: string | null }>(c.env.DB, "SELECT id, label, city, created_at FROM sessions WHERE jellyfin_id = ? AND expires_at > ? ORDER BY created_at DESC", s.jellyfinId, new Date().toISOString()))
    .map((r) => ({ id: r.id, label: r.label || "Browser", city: r.city, createdAt: r.created_at, current: r.id === s.id }));
  const last = await first<{ device: string | null; city: string | null; seen_at: string }>(c.env.DB, "SELECT device, city, seen_at FROM signins WHERE jellyfin_id = ? ORDER BY seen_at DESC LIMIT 1", s.jellyfinId);
  const libraries = await (c.var.jf.userLibraries?.(s.jellyfinId) ?? Promise.resolve(null)).catch(() => null); // null: Jellyfin did not answer
  return c.json({
    libraries, username: s.username, isAdmin: s.isAdmin, accessLevel: preset?.name ?? null, expiresAt: m?.expires_at ?? null, memberSince: m?.created_at ?? null,
    emailVerified: !!(m?.contact_email && m.email_verified), otherSessions: sessions.filter((x) => !x.current).length, sessions, alertsOn: m?.alerts_email === 1, alertsBanner: m?.alerts_banner === 1, weeklyOn: m?.weekly_on === 1, magicOn: m?.magic_on === 1, readyOn: m?.ready_on === 1, passwordChangedAt: m?.password_changed_at ?? null,
    lastSignin: last ? { device: last.device, city: last.city, seenAt: last.seen_at } : null,
  });
});

accountRoutes.post("/api/account/sign-out-others", requireSession, async (c) => {
  const s = c.get("session");
  await run(c.env.DB, "DELETE FROM sessions WHERE jellyfin_id = ? AND id <> ?", s.jellyfinId, s.id);
  await audit(c.env.DB, s.username, "account.sign_out_others", s.jellyfinId);
  return c.json({ ok: true });
});

/** Self-service "sign out everywhere": every Jellyfin app/TV signs out (the password stays), plus other portal browsers. */
accountRoutes.post("/api/account/sign-out-devices", requireSession, async (c) => {
  const s = c.get("session");
  if (!(await rateReserve(c.env.DB, `signout-devices:${s.jellyfinId}`, 5, 900))) return c.json({ error: "too many attempts, try again later" }, 429);
  try { await c.var.jf.deleteDevices(s.jellyfinId); } catch { return c.json({ error: "could not sign out your devices right now, try again" }, 502); }
  await run(c.env.DB, "DELETE FROM sessions WHERE jellyfin_id = ? AND id <> ?", s.jellyfinId, s.id);
  await audit(c.env.DB, s.username, "account.sign_out_devices", s.jellyfinId);
  return c.json({ ok: true });
});

/** End one other browser. Only the member's own sessions can be named; the current one signs out through /api/signout. */
accountRoutes.delete("/api/account/sessions/:id", requireSession, async (c) => {
  const s = c.get("session");
  const id = c.req.param("id");
  if (id === s.id) return c.json({ error: "use sign out for this browser" }, 400);
  const r = await run(c.env.DB, "DELETE FROM sessions WHERE id = ? AND jellyfin_id = ?", id, s.jellyfinId);
  if (!r.meta.changes) return c.json({ error: "not found" }, 404);
  await audit(c.env.DB, s.username, "account.end_session", s.jellyfinId);
  return c.json({ ok: true });
});

/** The other opt-in notices. None of these can hide a warning from the owner, so no password is needed to change them. */
const NOTIFY: Record<string, string> = { banner: "alerts_banner", weekly: "weekly_on", ready: "ready_on" };
accountRoutes.put("/api/account/notify", requireSession, async (c) => {
  const s = c.get("session");
  const b = await c.req.json().catch(() => ({}));
  const col = typeof b.key === "string" ? NOTIFY[b.key] : undefined;
  if (!col || typeof b.on !== "boolean") return c.json({ error: "key must be banner, weekly or ready, and on true or false" }, 400);
  if (b.on && b.key !== "banner") {
    const m = await first<{ contact_email: string | null; email_verified: number }>(c.env.DB, "SELECT contact_email, email_verified FROM members WHERE jellyfin_id = ?", s.jellyfinId);
    if (!m?.contact_email || !m.email_verified) return c.json({ error: "add and verify a contact email first" }, 409);
  }
  await run(c.env.DB, `UPDATE members SET ${col} = ? WHERE jellyfin_id = ?`, b.on ? 1 : 0, s.jellyfinId);
  await audit(c.env.DB, s.username, `account.notify_${b.key}_${b.on ? "on" : "off"}`, s.jellyfinId);
  return c.json({ ok: true });
});

/** New-sign-in emails. Turning them on needs nothing; turning them OFF needs the current password, so a stolen session cannot silence the warnings. */
accountRoutes.put("/api/account/alerts", requireSession, async (c) => {
  const s = c.get("session");
  const b = await c.req.json().catch(() => ({}));
  if (typeof b.on !== "boolean") return c.json({ error: "on must be true or false" }, 400);
  if (!b.on) {
    if (!(await rateReserve(c.env.DB, `alerts:${s.jellyfinId}`, 5, 900))) return c.json({ error: "too many attempts, try again later" }, 429);
    let who;
    try { who = await c.var.jf.authenticate(s.username, String(b.password ?? "")); } catch { return c.json({ error: "jellyfin unavailable" }, 503); }
    if (!who || who.id !== s.jellyfinId) return c.json({ error: "your current password is not right" }, 403);
    await markOwnAuth(c.env.DB, s.jellyfinId);
    await rateClear(c.env.DB, `alerts:${s.jellyfinId}`);
  }
  if (b.on) {
    const m = await first<{ contact_email: string | null; email_verified: number }>(c.env.DB, "SELECT contact_email, email_verified FROM members WHERE jellyfin_id = ?", s.jellyfinId);
    if (!m?.contact_email || !m.email_verified) return c.json({ error: "add and verify a contact email first" }, 409);
  }
  await run(c.env.DB, "UPDATE members SET alerts_email = ? WHERE jellyfin_id = ?", b.on ? 1 : 0, s.jellyfinId);
  await audit(c.env.DB, s.username, b.on ? "account.alerts_email" : "account.alerts_off", s.jellyfinId);
  return c.json({ ok: true });
});

/** Everything Jellypass holds about the member, as a JSON download. Keys, tokens and other people's data are never included. */
accountRoutes.get("/api/account/export", requireSession, async (c) => {
  const s = c.get("session");
  if (!(await rateReserve(c.env.DB, `export:${s.jellyfinId}`, 5, 3600))) return c.json({ error: "too many downloads, try again later" }, 429);
  const m = await getMember(c.env.DB, s.jellyfinId);
  const preset = m?.preset_id ? await getPreset(c.env.DB, m.preset_id) : null;
  const mine = <T>(sql: string) => all<T>(c.env.DB, sql, s.jellyfinId);
  const history = await getHistory(c.var.jf, c.env, s.jellyfinId, new Set()).then((rows) => rows.map((r) => ({ title: r.title, detail: r.subtitle, kind: r.kind, lastPlayed: r.lastPlayed, timesPlayed: r.playCount })), () => null);
  const requests = m?.seerr_user_id ? await c.var.seerr.userRequests(m.seerr_user_id).then((rows) => rows.map((r) => ({ requestedAt: r.createdAt, type: r.media?.mediaType, tmdbId: r.media?.tmdbId })), () => null) : [];
  const body = {
    exportedAt: new Date().toISOString(),
    about: "Everything Jellypass holds about you. Your Jellyfin watch history and your passwords live in Jellyfin itself.",
    profile: m ? { username: m.username, contactEmail: m.contact_email, emailVerified: !!m.email_verified, accessLevel: preset?.name ?? null, memberSince: m.created_at, expiresAt: m.expires_at, passwordChangedAt: m.password_changed_at } : null,
    settings: m ? { expiryReminders: !!m.reminders_on, alertsByEmail: !!m.alerts_email, alertsOnHome: !!m.alerts_banner, weeklySummary: !!m.weekly_on, requestReadyEmail: !!m.ready_on, compare: !!m.compare_on } : null,
    signIns: await mine("SELECT source, device, ip, city, seen_at AS seenAt FROM signins WHERE jellyfin_id = ? ORDER BY seen_at DESC LIMIT 2000"),
    portalSessions: await mine("SELECT label, city, created_at AS createdAt, expires_at AS expiresAt FROM sessions WHERE jellyfin_id = ?"),
    ratings: await mine("SELECT item_id AS itemId, stars, at FROM ratings WHERE jellyfin_id = ?"),
    pushDevices: await mine("SELECT label, created_at AS createdAt FROM push_subscriptions WHERE jellyfin_id = ?"),
    helpMessages: await mine("SELECT subject, body, created_at AS createdAt FROM help_messages WHERE jellyfin_id = ?"),
    watchHistory: history, requests,
  };
  c.header("Content-Disposition", `attachment; filename="jellypass-${s.username.replace(/[^\w.-]/g, "_")}-data.json"`);
  c.header("Cache-Control", "private, no-store");
  return c.body(JSON.stringify(body, null, 2), 200, { "content-type": "application/json; charset=utf-8" });
});

/** Self-service account deletion: removes the Jellyfin user, the Seerr user and every Jellypass row. Needs the password and the username typed. Admins cannot use it. */
accountRoutes.post("/api/account/delete", requireSession, async (c) => {
  const s = c.get("session");
  if (s.isAdmin) return c.json({ error: "admin accounts cannot be deleted here" }, 400);
  const b = await c.req.json().catch(() => ({}));
  if (b.confirm !== s.username) return c.json({ error: "type your username to confirm" }, 400);
  if (!(await rateReserve(c.env.DB, `acctdelete:${s.jellyfinId}`, 5, 900))) return c.json({ error: "too many attempts, try again later" }, 429);
  let who;
  try { who = await c.var.jf.authenticate(s.username, String(b.password ?? "")); } catch { return c.json({ error: "jellyfin unavailable" }, 503); }
  if (!who || who.id !== s.jellyfinId) return c.json({ error: "your password is not right" }, 403);
  const m = await getMember(c.env.DB, s.jellyfinId);
  try { await c.var.jf.deleteUser(s.jellyfinId); } catch (e) { return e instanceof BetaGuardError ? c.json({ error: "this test copy only deletes accounts named beta-…, so real accounts stay safe" }, 403) : c.json({ error: "could not delete the account right now, try again" }, 502); }
  if (m?.seerr_user_id) await c.var.seerr.deleteUser(m.seerr_user_id).catch(() => {});
  await purgeMember(c.env.DB, s.jellyfinId);
  await audit(c.env.DB, s.username, "account.self_delete", s.jellyfinId, { name: s.username });
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ ok: true });
});

/** Sign in with an emailed link. Turning it ON needs a verified email, a signed-in session and the current password (so a stolen session cannot make itself permanent); turning it off is free. Not for admins. */
accountRoutes.put("/api/account/magic", requireSession, async (c) => {
  const s = c.get("session");
  const b = await c.req.json().catch(() => ({}));
  if (typeof b.on !== "boolean") return c.json({ error: "on must be true or false" }, 400);
  if (b.on) {
    if (s.isAdmin) return c.json({ error: "sign-in links are not available for admin accounts" }, 400);
    const two = await mfaMethods(c.env.DB, s.jellyfinId);
    if (two.totp || two.passkey) return c.json({ error: "sign-in links are off while two-step sign-in is on" }, 409);
    const m = await getMember(c.env.DB, s.jellyfinId);
    if (!m?.contact_email || !m.email_verified) return c.json({ error: "add and verify a contact email first" }, 409);
    if (!(await rateReserve(c.env.DB, `magicon:${s.jellyfinId}`, 5, 900))) return c.json({ error: "too many attempts, try again later" }, 429);
    let who;
    try { who = await c.var.jf.authenticate(s.username, String(b.password ?? "")); } catch { return c.json({ error: "jellyfin unavailable" }, 503); }
    if (!who || who.id !== s.jellyfinId) return c.json({ error: "your current password is not right" }, 403);
    await markOwnAuth(c.env.DB, s.jellyfinId);
    await rateClear(c.env.DB, `magicon:${s.jellyfinId}`);
  } else await run(c.env.DB, "DELETE FROM magic_links WHERE jellyfin_id = ?", s.jellyfinId);
  await run(c.env.DB, "UPDATE members SET magic_on = ? WHERE jellyfin_id = ?", b.on ? 1 : 0, s.jellyfinId);
  return c.json({ ok: true });
});
