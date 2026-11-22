import { pollActivity } from "../signins";
import { expireAccounts } from "./expiry";
import { prune } from "./prune";
import { sendReminders } from "./reminders";
import { runStatusChecks } from "./status";
import { refreshClients } from "../jellyfin-clients";
import { adminDigest, readyRequests, streamWarnings, weeklySummaries } from "./notify";
import type { CronDeps } from "./types";

/** One cron trigger every 5 minutes. Heavy-but-rare jobs run only in their window; one failing job never stops the rest. */
export async function runScheduled(d: CronDeps, when: Date) {
  const jobs: Array<[string, () => Promise<unknown>]> = [
    ["expiry", () => expireAccounts(d)],
    ["activity", () => pollActivity({ db: d.db, jf: d.jf, mailer: d.mailer, baseUrl: d.baseUrl, secret: d.env.SESSION_SECRET, vapid: d.env.VAPID_KEYS, fetch: d.fetch })],
    ["status", () => runStatusChecks(d)],
    ["clients", () => refreshClients(d.db)], // jellyfin.org's official client list for the Help page; fetches at most daily
  ];
  jobs.push(["streams", () => streamWarnings(d)]);
  if (when.getUTCMinutes() < 5) jobs.push(["ready", () => readyRequests(d)]);
  if (when.getUTCHours() === 8 && when.getUTCMinutes() < 5) {
    jobs.push(["reminders", () => sendReminders(d)], ["digest", () => adminDigest(d)]);
    if (when.getUTCDay() === 1) jobs.push(["weekly", () => weeklySummaries(d)]);
  }
  if (when.getUTCHours() === 3 && when.getUTCMinutes() < 5) jobs.push(["prune", () => prune(d.db)]);
  const out: Record<string, "ok" | "failed"> = {};
  for (const [name, job] of jobs) {
    try { await job(); out[name] = "ok"; } catch (e) { out[name] = "failed"; console.error(`cron ${name} failed`, (e as Error).message); }
  }
  return out;
}
