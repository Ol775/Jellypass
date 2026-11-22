import { Hono } from "hono";
import { requireSession, type AppEnv } from "../auth";
import { audit } from "../audit";
import { all, run } from "../db";
import { sendPush } from "../push";

export const noticeRoutes = new Hono<AppEnv>();
const actor = (c: { get(k: "session"): { username: string } }) => c.get("session").username;

/** What members see in their bell: the admin's notices from the last 30 days. */
noticeRoutes.get("/api/notices", requireSession, async (c) =>
  c.json(await all(c.env.DB, "SELECT id, title, body, link FROM notices WHERE active = 1 AND created_at > ? ORDER BY id DESC LIMIT 10", new Date(Date.now() - 30 * 86400_000).toISOString())));

// Everything under /api/admin/* is already behind requireSession + requireAdmin (see index.ts).
noticeRoutes.get("/api/admin/notices", async (c) =>
  c.json(await all(c.env.DB, "SELECT id, title, body, link, created_at, pushed FROM notices WHERE active = 1 ORDER BY id DESC LIMIT 10")));

noticeRoutes.post("/api/admin/notices", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const title = typeof b.title === "string" ? b.title.trim() : "", body = typeof b.body === "string" ? b.body.trim() : "", link = typeof b.link === "string" ? b.link.trim() : "";
  if (!title || title.length > 80) return c.json({ error: "give it a title of up to 80 characters" }, 400);
  if (!body || body.length > 300) return c.json({ error: "write a message of up to 300 characters" }, 400);
  if (link && !(/^\/(?!\/)[\w\-./?=&#%]*$/.test(link) || /^https:\/\/[^\s]+$/.test(link)) || link.length > 300) return c.json({ error: "the link must start with / or https://" }, 400);
  const r = await run(c.env.DB, "INSERT INTO notices (title, body, link, created_by, created_at) VALUES (?,?,?,?,?)", title, body, link || null, actor(c), new Date().toISOString());
  const id = r.meta.last_row_id;
  let members = 0, devices = 0;
  if (b.push === true) {
    const d = { db: c.env.DB, vapid: c.env.VAPID_KEYS, baseUrl: c.env.PUBLIC_URL, fetch: c.var.fetch };
    const url = !link ? `${c.env.PUBLIC_URL}/` : link.startsWith("/") ? `${c.env.PUBLIC_URL}${link}` : link;
    for (const m of await all<{ jellyfin_id: string }>(c.env.DB, "SELECT DISTINCT jellyfin_id FROM push_subscriptions")) {
      const n = await sendPush(d, m.jellyfin_id, { title, body, url });
      if (n) { members++; devices += n; }
    }
    await run(c.env.DB, "UPDATE notices SET pushed = ? WHERE id = ?", members, id);
  }
  await audit(c.env.DB, actor(c), "notice.send", String(id), { title, push: b.push === true, members });
  return c.json({ ok: true, id, members, devices }, 201);
});

noticeRoutes.delete("/api/admin/notices/:id", async (c) => {
  await run(c.env.DB, "UPDATE notices SET active = 0 WHERE id = ?", Number(c.req.param("id")) || 0);
  await audit(c.env.DB, actor(c), "notice.remove", c.req.param("id"));
  return c.json({ ok: true });
});
