import { run } from "../db";

const ago = (days: number) => new Date(Date.now() - days * 86400_000).toISOString();

export async function prune(db: D1Database) {
  await run(db, "DELETE FROM signins WHERE seen_at < ?", ago(90));
  await run(db, "DELETE FROM status_checks WHERE at < ?", ago(90));
  await run(db, "DELETE FROM audit WHERE at < ?", ago(365));
  await run(db, "DELETE FROM own_auths WHERE at < ?", ago(1));
  await run(db, "DELETE FROM sessions WHERE expires_at < ?", new Date().toISOString());
  await run(db, "DELETE FROM rate_limits WHERE window_start < ?", ago(2));
  await run(db, "DELETE FROM reset_codes WHERE expires_at < ?", ago(1));
  await run(db, "DELETE FROM signin_failures WHERE at < ?", ago(14));
  await run(db, "DELETE FROM notice_log WHERE at < ?", ago(30));
  await run(db, "DELETE FROM email_codes WHERE expires_at < ?", ago(1));
}
