import { env } from "cloudflare:workers";
import { expect, test } from "vitest";
import { all, first, run } from "../src/db";

const TABLES = ["presets", "invites", "members", "sessions", "reset_codes", "signins", "audit", "announcements", "status_checks", "email_codes", "rate_limits"];

test("migration creates every table", async () => {
  const rows = await all<{ name: string }>(env.DB, "SELECT name FROM sqlite_master WHERE type='table'");
  const names = rows.map((r) => r.name);
  for (const t of TABLES) expect(names).toContain(t);
});

test("signins rejects an exact duplicate row", async () => {
  const sql = "INSERT INTO signins (source, jellyfin_id, device, ip, seen_at) VALUES ('activity','u1','Safari','1.2.3.4','2026-11-14T10:00:00Z')";
  await run(env.DB, sql);
  await expect(run(env.DB, sql)).rejects.toThrow(/UNIQUE/);
});

test("default presets Standard, Family and Guest are seeded", async () => {
  const rows = await all<{ name: string; is_default: number }>(env.DB, "SELECT name, is_default FROM presets ORDER BY name");
  expect(rows.map((r) => r.name)).toEqual(["Family", "Guest", "Standard"]);
  expect(rows.every((r) => r.is_default === 1)).toBe(true);
});

test("first returns null when no row matches", async () => {
  expect(await first(env.DB, "SELECT * FROM members WHERE jellyfin_id = ?", "nope")).toBeNull();
});
