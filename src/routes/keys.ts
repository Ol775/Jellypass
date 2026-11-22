import { Hono } from "hono";
import type { AppEnv } from "../auth";
import { audit } from "../audit";
import { all, run } from "../db";
import { effectiveEnv, encryptSecret, isKeyName, KEYS } from "../keys";
import { INTEGRATIONS } from "../integrations";

export const keyRoutes = new Hono<AppEnv>();

/** Which keys are set and where from. Values are never returned, not even partly. */
keyRoutes.get("/api/admin/keys", async (c) => {
  const rows = await all<{ name: string; updated_at: string; updated_by: string }>(c.env.DB, "SELECT name, updated_at, updated_by FROM integration_keys").catch(() => []);
  const stored = new Map(rows.map((r) => [r.name, r]));
  return c.json({
    canStore: !!c.env.KEYS_SECRET,
    keys: Object.entries(KEYS).map(([name, k]) => ({ name, label: k.label, integration: k.integration, source: stored.has(name) ? "stored" : !!(c.env as unknown as Record<string, unknown>)[k.env] ? "worker" : "missing", updatedAt: stored.get(name)?.updated_at ?? null, updatedBy: stored.get(name)?.updated_by ?? null })),
  });
});

keyRoutes.put("/api/admin/keys/:name", async (c) => {
  const name = c.req.param("name");
  if (!isKeyName(name)) return c.json({ error: "unknown key" }, 404);
  const b = await c.req.json().catch(() => ({}));
  const value = typeof b.value === "string" ? b.value.trim() : "";
  if (!value || value.length > 500) return c.json({ error: "paste the key (up to 500 characters)" }, 400);
  if (!c.env.KEYS_SECRET) return c.json({ error: "key storage is not set up: add the KEYS_SECRET Worker secret first" }, 503);
  // Prove the key works before storing it, so a typo cannot take the admin screens down with it.
  const k = KEYS[name];
  const check = await c.var.testIntegration(k.integration, { ...(await effectiveEnv(c.env)), [k.env]: value });
  if (!check.ok) {
    const canForce = b.force === true && !check.rejected && name !== "jellyfin_admin_key"; // a refused key is wrong; Jellyfin's key must always be proven
    if (!canForce) return check.rejected ? c.json({ error: "that key was refused by the service" }, 422) : c.json({ error: `could not check the key (${check.error}); try again, or tick “save anyway”` }, 502);
  }
  const by = c.get("session").username;
  await run(c.env.DB, "INSERT INTO integration_keys (name, ciphertext, updated_at, updated_by) VALUES (?,?,?,?) ON CONFLICT(name) DO UPDATE SET ciphertext = excluded.ciphertext, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
    name, await encryptSecret(c.env.KEYS_SECRET, name, value), new Date().toISOString(), by);
  await audit(c.env.DB, by, "key.set", name, { verified: check.ok }); // never the value
  return c.json({ ok: true, verified: check.ok });
});

/** Removes the stored key; the Worker secret (if any) takes over again. */
keyRoutes.delete("/api/admin/keys/:name", async (c) => {
  const name = c.req.param("name");
  if (!isKeyName(name)) return c.json({ error: "unknown key" }, 404);
  await run(c.env.DB, "DELETE FROM integration_keys WHERE name = ?", name);
  await audit(c.env.DB, c.get("session").username, "key.remove", name);
  return c.json({ ok: true });
});

keyRoutes.post("/api/admin/integrations/:name/test", async (c) => {
  const name = c.req.param("name");
  if (!(INTEGRATIONS as readonly string[]).includes(name)) return c.json({ error: "unknown integration" }, 404);
  const r = await c.var.testIntegration(name, await effectiveEnv(c.env));
  return c.json(r.ok ? { ok: true } : { ok: false, error: r.error });
});
