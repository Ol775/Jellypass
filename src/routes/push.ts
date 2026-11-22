import { Hono } from "hono";
import { rateReserve, requireSession, type AppEnv } from "../auth";
import { all, run } from "../db";
import { sendPush, validEndpoint, vapidPublicKey } from "../push";

export const pushRoutes = new Hono<AppEnv>();
pushRoutes.use("/api/push/*", requireSession);
const MAX_DEVICES = 5;

/** The browser needs this public key to subscribe. 404 when push is not set up here. */
pushRoutes.get("/api/push/key", (c) => {
  const key = vapidPublicKey(c.env.VAPID_KEYS);
  return key ? c.json({ key }) : c.json({ error: "push notifications are not set up" }, 404);
});

pushRoutes.post("/api/push/subscribe", async (c) => {
  if (!vapidPublicKey(c.env.VAPID_KEYS)) return c.json({ error: "push notifications are not set up" }, 404);
  const b = await c.req.json().catch(() => ({})), s = c.get("session");
  const p256dh = String(b.keys?.p256dh ?? ""), auth = String(b.keys?.auth ?? "");
  if (!validEndpoint(b.endpoint) || !/^[\w-]{80,100}$/.test(p256dh) || !/^[\w-]{16,32}$/.test(auth)) return c.json({ error: "that device cannot receive push notices" }, 400);
  const label = String(c.req.header("user-agent") ?? "").slice(0, 120) || null;
  await run(c.env.DB, "INSERT INTO push_subscriptions (endpoint, jellyfin_id, p256dh, auth, label, created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET jellyfin_id = excluded.jellyfin_id, p256dh = excluded.p256dh, auth = excluded.auth, label = excluded.label", b.endpoint, s.jellyfinId, p256dh, auth, label, new Date().toISOString());
  // Keep the newest few devices; the rest are forgotten.
  await run(c.env.DB, "DELETE FROM push_subscriptions WHERE jellyfin_id = ? AND endpoint NOT IN (SELECT endpoint FROM push_subscriptions WHERE jellyfin_id = ? ORDER BY created_at DESC LIMIT ?)", s.jellyfinId, s.jellyfinId, MAX_DEVICES);
  return c.json({ ok: true });
});

pushRoutes.post("/api/push/unsubscribe", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  await run(c.env.DB, "DELETE FROM push_subscriptions WHERE endpoint = ? AND jellyfin_id = ?", String(b.endpoint ?? ""), c.get("session").jellyfinId);
  return c.json({ ok: true });
});

/** Whether this browser (by endpoint) is subscribed, and how many devices the member has. */
pushRoutes.get("/api/push/status", async (c) => {
  const s = c.get("session"), endpoint = c.req.query("endpoint") ?? "";
  const rows = await all<{ endpoint: string }>(c.env.DB, "SELECT endpoint FROM push_subscriptions WHERE jellyfin_id = ?", s.jellyfinId);
  return c.json({ available: !!vapidPublicKey(c.env.VAPID_KEYS), devices: rows.length, thisDevice: !!endpoint && rows.some((r) => r.endpoint === endpoint) });
});

pushRoutes.post("/api/push/test", async (c) => {
  const s = c.get("session");
  if (!(await rateReserve(c.env.DB, `pushtest:${s.jellyfinId}`, 5, 900))) return c.json({ error: "too many tests, try again later" }, 429);
  const sent = await sendPush({ db: c.env.DB, vapid: c.env.VAPID_KEYS, baseUrl: c.env.PUBLIC_URL, fetch: c.var.fetch }, s.jellyfinId, { title: "Jellypass", body: "Notices will arrive on this device.", url: "/settings" });
  return sent ? c.json({ ok: true, sent }) : c.json({ error: "could not reach any of your devices" }, 502);
});
