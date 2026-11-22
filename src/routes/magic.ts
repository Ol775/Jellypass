import { emailOn } from "../mail";
import { Hono } from "hono";
import { html } from "hono/html";
import { setCookie } from "hono/cookie";
import { COOKIE, SESSION_HOURS, createSession, now, randomToken, rateReserve, sha256, type AppEnv } from "../auth";
import { all, first, run } from "../db";
import { renderEmail } from "../emails";
import type { MemberRow } from "../members";
import { mfaMethods } from "../mfa";
import { checkPortalSignin, deviceLabel } from "../signins";
import { brand, layout } from "../views/layout";

/** Sign in with an emailed link. Opt-in (the member turns it on in Settings while signed in), never for admins, only for members who already
 *  have a verified email and have signed in with their password. The link works once, for 15 minutes; opening it only shows a button, so mail scanners cannot use it up. */
export const magicRoutes = new Hono<AppEnv>();
const MINUTES = 15;
const GENERIC = { ok: true, message: "If that account has sign-in links turned on, a link is on its way." };

async function findMember(db: D1Database, identifier: string): Promise<MemberRow | null> {
  const id = identifier.trim().toLowerCase();
  const rows = (await all<MemberRow>(db, "SELECT * FROM members WHERE magic_on = 1 AND email_verified = 1 AND contact_email IS NOT NULL AND NOT EXISTS (SELECT 1 FROM mfa_totp t WHERE t.jellyfin_id = members.jellyfin_id AND t.enabled = 1) AND NOT EXISTS (SELECT 1 FROM passkeys p WHERE p.jellyfin_id = members.jellyfin_id)"))
    .filter((m) => m.username.toLowerCase() === id || m.contact_email!.toLowerCase() === id);
  return rows.length === 1 ? rows[0] : null;
}

magicRoutes.post("/api/magic/request", async (c) => {
  if (!emailOn(c.env)) return c.json({ error: "Email is turned off on this server." }, 409);
  const body = await c.req.json().catch(() => ({}));
  const identifier = String(body.identifier ?? "").trim().toLowerCase();
  if (!identifier || identifier.length > 200) return c.json({ error: "enter your username or email" }, 400);
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  // Both limits apply whether or not the account exists, so the response never reveals it.
  if (!(await rateReserve(c.env.DB, `magic:cool:${identifier}`, 1, 30))) return c.json({ error: "wait 30 seconds before asking for another link" }, 429);
  if (!(await rateReserve(c.env.DB, `magic:ip:${ip}`, 10, 3600))) return c.json({ error: "too many requests, try again later" }, 429);
  const work = (async () => {
    const m = await findMember(c.env.DB, identifier);
    if (!m || !(await rateReserve(c.env.DB, `magic:issue:${m.jellyfin_id}`, 5, 3600))) return; // silent per-account cap
    if (!(await first(c.env.DB, "SELECT 1 AS x FROM own_auths WHERE jellyfin_id = ? LIMIT 1", m.jellyfin_id))) return; // must have signed in with their password before
    const u = await c.var.jf.getUser(m.jellyfin_id).catch(() => null);
    if (!u || u.isDisabled || u.isAdmin) return;
    const token = randomToken(32);
    await run(c.env.DB, "DELETE FROM magic_links WHERE jellyfin_id = ?", m.jellyfin_id); // one live link at a time
    await run(c.env.DB, "INSERT INTO magic_links (token_hash, jellyfin_id, expires_at) VALUES (?,?,?)", await sha256(`magic:${token}`), m.jellyfin_id, new Date(Date.now() + MINUTES * 60_000).toISOString());
    const e = renderEmail("magic_link", { name: m.username, link: `${c.env.PUBLIC_URL}/magic/${token}`, minutes: MINUTES });
    await c.var.mailer.send(m.contact_email!, e.subject, e.html, e.text, e.inline);
  })().catch(() => {});
  try { c.executionCtx.waitUntil(work); } catch { await work; }
  return c.json(GENERIC);
});

const page = (title: string, body: ReturnType<typeof html>, status: 200 | 400 | 429 = 200) =>
  ({ status, body: layout({ title, body: html`<main class="center fade"><div class="card authcard">${brand}<h1 tabindex="-1">${title}</h1>${body}</div></main>` }) });
const invalid = () => page("This link has expired", html`<p class="muted">Sign-in links work once and only for ${MINUTES} minutes.</p><a class="btn pri" href="/signin">Back to sign in</a>`, 400);
const live = async (db: D1Database, token: string) => first<{ jellyfin_id: string; username: string }>(db,
  "SELECT l.jellyfin_id, m.username FROM magic_links l JOIN members m ON m.jellyfin_id = l.jellyfin_id WHERE l.token_hash = ? AND l.expires_at > ? AND m.magic_on = 1", await sha256(`magic:${token}`), now());

magicRoutes.get("/magic/:token", async (c) => {
  const row = await live(c.env.DB, c.req.param("token"));
  if (!row) { const p = invalid(); return c.html(p.body, p.status); }
  const p = page("Sign in to Jellypass", html`<p class="muted">Signing in as <b>${row.username}</b>.</p><form method="post"><button class="btn pri">Sign in</button></form><p class="muted">Not you? Close this page; nothing happens until you press the button.</p>`);
  return c.html(p.body, p.status);
});

magicRoutes.post("/magic/:token", async (c) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  if (!(await rateReserve(c.env.DB, `magic:use:${ip}`, 20, 3600))) { const p = page("Too many tries", html`<p class="muted">Please wait a while and try again.</p>`, 429); return c.html(p.body, p.status); }
  const token = c.req.param("token"), row = await live(c.env.DB, token);
  if (!row) { const p = invalid(); return c.html(p.body, p.status); }
  const u = await c.var.jf.getUser(row.jellyfin_id).catch(() => null);
  if (!u || u.isDisabled || u.isAdmin) { const p = invalid(); return c.html(p.body, p.status); }
  // Single use: whoever deletes the row wins.
  const two = await mfaMethods(c.env.DB, row.jellyfin_id);
  if (two.totp || two.passkey) { const p = invalid(); return c.html(p.body, p.status); } // two-step sign-in is on: a link alone is not enough
  const used = await run(c.env.DB, "DELETE FROM magic_links WHERE token_hash = ?", await sha256(`magic:${token}`));
  if (used.meta.changes !== 1) { const p = invalid(); return c.html(p.body, p.status); }
  const device = deviceLabel(c.req.header("user-agent") ?? ""), cf = (c.req.raw as { cf?: { city?: string } }).cf;
  await checkPortalSignin({ db: c.env.DB, mailer: c.var.mailer, baseUrl: new URL(c.req.url).origin, secret: c.env.SESSION_SECRET, vapid: c.env.VAPID_KEYS, fetch: c.var.fetch }, { jellyfinId: u.id, device, ip: c.req.header("cf-connecting-ip") ?? "", cf: cf as never });
  const { cookieValue } = await createSession(c.env, { id: u.id, name: u.name, isAdmin: false }, { label: device, city: cf?.city ?? null });
  setCookie(c, COOKIE, cookieValue, { httpOnly: true, secure: c.env.PUBLIC_URL.startsWith("https:"), sameSite: "Lax", path: "/", maxAge: SESSION_HOURS * 3600 });
  return c.redirect("/", 303);
});
