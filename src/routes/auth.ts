import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { COOKIE, SESSION_HOURS, type AppEnv, createSession, rateClear, rateRelease, rateReserve, requireSession, verifyTurnstile } from "../auth";
import { run } from "../db";
import { ensureMember } from "../members";
import { emailOn } from "../mail";
import { checkPortalSignin, deviceLabel, markOwnAuth } from "../signins";
import { mfaMethods, newPendingToken, pendingKey, putChallenge } from "../mfa";
import type { Context } from "hono";

const MAX_FAILS = 5, WINDOW = 15 * 60;

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/api/signin", async (c) => {
  const body = await c.req.json<{ username?: string; password?: string; turnstile?: string }>().catch(() => ({}) as never);
  const username = String(body.username ?? "").trim(), password = String(body.password ?? "");
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  if (!username || !password) return c.json({ error: "username and password required" }, 400);
  if (!(await verifyTurnstile(c.env, body.turnstile, ip))) return c.json({ error: "challenge failed" }, 400);

  const ipKey = `signin:ip:${ip}`, userKey = `signin:user:${username.toLowerCase()}`;
  const okIp = await rateReserve(c.env.DB, ipKey, MAX_FAILS, WINDOW);
  const okUser = await rateReserve(c.env.DB, userKey, MAX_FAILS, WINDOW);
  if (!okIp || !okUser) return c.json({ error: "too many attempts, try again later" }, 429);

  let user;
  try { user = await c.var.jf.authenticate(username, password); } catch { return c.json({ error: "jellyfin unavailable" }, 503); }
  if (!user) { await run(c.env.DB, "INSERT INTO signin_failures (username, ip, at) VALUES (?,?,?)", username.slice(0, 64), ip, new Date().toISOString()); return c.json({ error: "wrong username or password" }, 401); }
  await rateClear(c.env.DB, userKey);
  await rateRelease(c.env.DB, ipKey);
  const methods = await mfaMethods(c.env.DB, user.id);
  if (methods.totp || methods.passkey) { // password was right; the session waits for the second step
    const token = newPendingToken();
    await putChallenge(c.env.DB, await pendingKey(token), user.id, null);
    return c.json({ mfa: { token, ...methods } });
  }
  return finishSignin(c, user);
});

/** Everything that happens once a person has fully proved who they are (password, plus the second step if they have one). */
export async function finishSignin(c: Context<AppEnv>, user: { id: string; name: string; isAdmin: boolean }) {
  await markOwnAuth(c.env.DB, user.id);
  await ensureMember(c.env.DB, user.id, user.name);
  // Admins run the portal, and with email off the welcome has nothing to ask: both skip the email-verification welcome. Invited newcomers still finish their own steps.
  if (user.isAdmin || !emailOn(c.env)) await run(c.env.DB, "UPDATE members SET onboarding_state = ? WHERE jellyfin_id = ? AND onboarding_state NOT LIKE '%\"done\":true%' AND onboarding_state NOT LIKE '%\"kind\":\"new\"%'", '{"kind":"existing","done":true}', user.id);
  await checkPortalSignin({ db: c.env.DB, mailer: c.var.mailer, baseUrl: new URL(c.req.url).origin, secret: c.env.SESSION_SECRET, vapid: c.env.VAPID_KEYS, fetch: c.var.fetch }, { jellyfinId: user.id, device: deviceLabel(c.req.header("user-agent") ?? ""), ip: c.req.header("cf-connecting-ip") ?? "", cf: (c.req.raw as { cf?: { city?: string; latitude?: string; longitude?: string } }).cf });
  const { cookieValue, csrf } = await createSession(c.env, user, { label: deviceLabel(c.req.header("user-agent") ?? ""), city: (c.req.raw as { cf?: { city?: string } }).cf?.city ?? null });
  setCookie(c, COOKIE, cookieValue, { httpOnly: true, secure: c.env.PUBLIC_URL.startsWith("https:"), sameSite: "Lax", path: "/", maxAge: SESSION_HOURS * 3600 });
  return c.json({ user, csrf });
}

authRoutes.post("/api/signout", requireSession, async (c) => {
  await run(c.env.DB, "DELETE FROM sessions WHERE id = ?", c.get("session").id);
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ ok: true });
});

authRoutes.get("/api/me", requireSession, (c) => {
  const s = c.get("session");
  return c.json({ user: { id: s.jellyfinId, name: s.username, isAdmin: s.isAdmin }, csrf: s.csrf, emailOn: emailOn(c.env) });
});

authRoutes.get("/api/admin/ping", (c) => c.json({ ok: true }));
