import { all, first, run } from "../db";
import { renderEmail } from "../emails";
import type { CronDeps } from "./types";

export const SERVICE_LABELS: Record<string, string> = { jellyfin: "Jellyfin", seerr: "Requests (Seerr)", portal: "Jellypass", email: "Email delivery" };
const CHECKED = ["jellyfin", "seerr", "portal"]; // email delivery is recorded from real sends by the mailer

export async function runStatusChecks(d: CronDeps) {
  const at = () => new Date().toISOString();
  const portal = await first(d.db, "SELECT 1 AS x").then((r) => !!r, () => false);
  const results: Record<string, { ok: boolean; latencyMs: number }> = {
    jellyfin: await d.jf.publicInfo().catch(() => ({ ok: false, latencyMs: 0 })),
    seerr: await d.seerr.status().catch(() => ({ ok: false, latencyMs: 0 })),
    portal: { ok: portal, latencyMs: 0 },
  };
  for (const s of CHECKED) await run(d.db, "INSERT INTO status_checks (service, ok, latency_ms, at) VALUES (?,?,?,?)", s, results[s].ok ? 1 : 0, results[s].latencyMs, at());
  await notifyOutages(d);
}

/** Emails verified members once per outage, after two failed checks in a row, if the admin switched that on. */
async function notifyOutages(d: CronDeps) {
  const on = (await first<{ value: string }>(d.db, "SELECT value FROM settings WHERE key = 'outage_email'"))?.value === "1";
  for (const s of CHECKED) {
    const last = await all<{ ok: number; at: string }>(d.db, "SELECT ok, at FROM status_checks WHERE service = ? ORDER BY id DESC LIMIT 2", s);
    const flag = `outage_notified:${s}`;
    if (last[0]?.ok === 1) { await run(d.db, "DELETE FROM settings WHERE key = ?", flag); continue; }
    if (last.length < 2 || last[1].ok !== 0 || !on) continue;
    if (await first(d.db, "SELECT 1 AS x FROM settings WHERE key = ?", flag)) continue;
    await run(d.db, "INSERT INTO settings (key, value) VALUES (?, '1')", flag); // set first so a slow send cannot double up
    const e = renderEmail("outage", { service: SERVICE_LABELS[s], when: new Date(last[1].at).toUTCString() });
    for (const m of await all<{ contact_email: string }>(d.db, "SELECT contact_email FROM members WHERE email_verified = 1 AND contact_email IS NOT NULL"))
      await d.mailer.send(m.contact_email, e.subject, e.html, e.text).catch(() => {});
  }
}
