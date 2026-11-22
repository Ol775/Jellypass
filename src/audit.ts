import { run } from "./db";

/** Record who did what. Never pass secrets, invite tokens or codes in `detail`. */
export function audit(db: D1Database, actor: string, action: string, target: string | null = null, detail: Record<string, unknown> = {}) {
  return run(db, "INSERT INTO audit (actor, action, target, detail_json) VALUES (?,?,?,?)", actor, action, target, JSON.stringify(detail));
}
