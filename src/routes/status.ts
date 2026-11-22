import { Hono } from "hono";
import { SERVICE_LABELS } from "../cron/status";
import { requireSession, type AppEnv } from "../auth";
import { all } from "../db";

export const statusRoutes = new Hono<AppEnv>();

statusRoutes.get("/api/status", requireSession, async (c) => {
  const since = new Date(Date.now() - 90 * 86400_000);
  // Aggregated in SQL so a page view reads a few hundred rows, not every 5-minute check.
  const byDay = await all<{ service: string; day: string; n: number; good: number }>(c.env.DB, "SELECT service, substr(at,1,10) AS day, COUNT(*) AS n, SUM(ok) AS good FROM status_checks WHERE at > ? GROUP BY service, day", since.toISOString());
  const latest = await all<{ service: string; ok: number; latency_ms: number | null; at: string }>(c.env.DB, "SELECT service, ok, latency_ms, at FROM status_checks WHERE id IN (SELECT MAX(id) FROM status_checks GROUP BY service)");
  const days = Array.from({ length: 90 }, (_, i) => new Date(since.getTime() + (i + 1) * 86400_000).toISOString().slice(0, 10));
  const services = Object.keys(SERVICE_LABELS).map((service) => {
    const rows = new Map(byDay.filter((r) => r.service === service).map((r) => [r.day, r]));
    const total = [...rows.values()].reduce((a, r) => a + r.n, 0), good = [...rows.values()].reduce((a, r) => a + r.good, 0);
    const l = latest.find((x) => x.service === service);
    // Email delivery is only measured when an email is sent, so quiet days are not "no data": with no failed send they count as ready.
    const first = service === "email" ? [...rows.keys()].sort()[0] : undefined;
    return { service, label: SERVICE_LABELS[service], ok: l ? !!l.ok : service === "email" ? true : null, latencyMs: l?.latency_ms ?? null, checkedAt: l?.at ?? null, uptime: total ? Math.round((good / total) * 1000) / 10 : null,
      days: days.map((day) => { const r = rows.get(day); return { day, ok: r ? r.good === r.n : null, checks: r?.n ?? 0, failed: r ? r.n - r.good : 0, ...(!r && first !== undefined && day > first ? { quiet: true } : {}) }; }) };
  });
  const incidents = await all(c.env.DB, "SELECT id, title, body, created_at FROM announcements WHERE active = 1 AND kind = 'incident' ORDER BY id DESC LIMIT 20");
  const firstDay = byDay.map((r) => r.day).sort()[0] ?? null; // first day anything was recorded
  return c.json({ services, incidents, since: firstDay });
});
