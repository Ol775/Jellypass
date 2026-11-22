import { Hono } from "hono";
import { endSessionsFor, randomToken, requireSession, type AppEnv } from "../auth";
import { audit } from "../audit";
import { first } from "../db";
import { memberSignins } from "../signins";

export const signinRoutes = new Hono<AppEnv>();

signinRoutes.get("/api/signins", requireSession, async (c) => c.json(await memberSignins(c.env.DB, c.get("session").jellyfinId)));

/**
 * Jellyfin's device list cannot be matched to a sign-in row reliably, so "this wasn't me" signs the
 * member out everywhere and rotates their Jellyfin password to a random one. That is the only way the
 * old password stops working in Jellyfin's own apps too; they then recover through the emailed-code
 * reset (needs a confirmed address) or ask an admin.
 */
signinRoutes.post("/api/signins/:id/not-me", requireSession, async (c) => {
  const s = c.get("session");
  const row = await first(c.env.DB, "SELECT id FROM signins WHERE id = ? AND jellyfin_id = ?", c.req.param("id"), s.jellyfinId);
  if (!row) return c.json({ error: "not found" }, 404);
  try {
    await c.var.jf.setPassword(s.jellyfinId, randomToken(24));
    await c.var.jf.deleteDevices(s.jellyfinId);
  } catch { return c.json({ error: "could not secure your account right now, try again" }, 502); }
  await endSessionsFor(c.env.DB, s.jellyfinId);
  await audit(c.env.DB, s.username, "signin.not_me", s.jellyfinId, { signin: c.req.param("id") });
  return c.json({ ok: true, next: "reset" }); // the client sends them to the forgot-password page
});

/** Self-hosted map tiles (PMTiles in R2) with Range support, so no third party sees who views the map. */
signinRoutes.get("/tiles/:file", requireSession, async (c) => {
  const key = c.req.param("file");
  if (!/^[a-z0-9._-]+\.pmtiles$/i.test(key)) return c.json({ error: "not found" }, 404);
  const head = await c.env.TILES.head(key);
  if (!head) return c.json({ error: "not found" }, 404);
  const size = head.size;
  const base = { "accept-ranges": "bytes", "content-type": "application/octet-stream", "cache-control": "private, max-age=86400" };
  const m = c.req.header("range")?.match(/^bytes=(\d+)-(\d*)$/);
  if (!m) { const o = await c.env.TILES.get(key); return new Response(o!.body, { headers: { ...base, "content-length": String(size) } }); }
  const start = Number(m[1]), end = Math.min(m[2] ? Number(m[2]) : size - 1, size - 1);
  if (start >= size || end < start) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
  const o = await c.env.TILES.get(key, { range: { offset: start, length: end - start + 1 } });
  return new Response(o!.body, { status: 206, headers: { ...base, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) } });
});
