import { Hono } from "hono";
import { html } from "hono/html";
import { endSessionsFor, randomToken, rateReserve, type AppEnv } from "../auth";
import { audit } from "../audit";
import { first, run } from "../db";
import { readSecureToken } from "../signins";
import { brand, layout } from "../views/layout";

/** The "This wasn't me" link in a sign-in alert. It needs no sign-in (a thief may hold the password), so the signed, expiring token is the proof.
 *  GET only shows a button, so a mail scanner opening the link changes nothing; the POST does the work. */
export const secureRoutes = new Hono<AppEnv>();

const page = (title: string, body: ReturnType<typeof html>, status: 200 | 400 | 429 | 502 = 200) =>
  ({ status, body: layout({ title, body: html`<main class="center fade"><div class="card authcard">${brand}<h1 tabindex="-1">${title}</h1>${body}</div></main>` }) });
const expired = () => page("This link has expired", html`<p class="muted">For your safety these links only work for a week. Sign in and change your password from Account and security, or reset it if you cannot sign in.</p><p><a class="btn pri" href="/forgot">Reset my password</a></p>`, 400);

secureRoutes.get("/secure/:token", async (c) => {
  const id = await readSecureToken(c.env.SESSION_SECRET, c.req.param("token"));
  if (!id) { const p = expired(); return c.html(p.body, p.status); }
  return c.html(layout({ title: "Secure your account", body: html`<main class="center fade"><div class="card authcard">${brand}<h1 tabindex="-1">Was this sign-in you?</h1><p class="muted">If it was not, we will sign you out of Jellypass and every Jellyfin app and TV, and change your password so the old one stops working. You then choose a new one with a code we email you. Nothing is deleted.</p><form method="post"><button class="btn danger" type="submit">No, secure my account</button></form><p class="muted">If it was you, close this page. Nothing has changed.</p></div></main>` }));
});

secureRoutes.post("/secure/:token", async (c) => {
  const id = await readSecureToken(c.env.SESSION_SECRET, c.req.param("token"));
  if (!id) { const p = expired(); return c.html(p.body, p.status); }
  if (!(await rateReserve(c.env.DB, `secure:${id}`, 5, 900))) { const p = page("Too many tries", html`<p class="muted">Please wait a few minutes and try again.</p>`, 429); return c.html(p.body, p.status); }
  const m = await first<{ username: string }>(c.env.DB, "SELECT username FROM members WHERE jellyfin_id = ?", id);
  if (!m) { const p = expired(); return c.html(p.body, p.status); }
  // Same as "This wasn't me" in the portal: a random Jellyfin password is the only way the old one stops working in Jellyfin's own apps.
  try { await c.var.jf.setPassword(id, randomToken(24)); await c.var.jf.deleteDevices(id); }
  catch { const f = page("We could not do that just now", html`<p class="muted">Please try this link again in a few minutes, or ask an admin to help.</p>`, 502); return c.html(f.body, f.status); }
  await endSessionsFor(c.env.DB, id);
  await run(c.env.DB, "DELETE FROM magic_links WHERE jellyfin_id = ?", id);
  await run(c.env.DB, "UPDATE members SET secured_at = ? WHERE jellyfin_id = ?", new Date().toISOString(), id);
  await audit(c.env.DB, m.username, "account.secured_not_me", id);
  const p = page("Your account is secured", html`<p class="muted">You are signed out of Jellypass and every Jellyfin app and TV, and your old password no longer works.</p><p><b>Now choose a new password</b> using the code we email you.</p><p><a class="btn pri" href="/forgot">Choose a new password</a></p>`);
  return c.html(p.body, p.status);
});
