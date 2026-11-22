import { Hono } from "hono";
import type { AppEnv } from "../auth";
import { audit } from "../audit";
import { applyPresetToMembers, clonePreset, createPreset, deletePreset, getPreset, listPresets, parsePresetInput, updatePreset } from "../presets";

export const presetRoutes = new Hono<AppEnv>();

presetRoutes.get("/api/admin/presets", async (c) => c.json(await listPresets(c.env.DB)));

presetRoutes.post("/api/admin/presets", async (c) => {
  let input;
  try { input = parsePresetInput(await c.req.json()); } catch (e) { return c.json({ error: (e as Error).message }, 400); }
  const p = await createPreset(c.env.DB, input);
  await audit(c.env.DB, c.get("session").username, "preset.create", p.id, { name: p.name });
  return c.json(p, 201);
});

presetRoutes.put("/api/admin/presets/:id", async (c) => {
  const id = c.req.param("id");
  if (!(await getPreset(c.env.DB, id))) return c.json({ error: "not found" }, 404);
  let input;
  try { input = parsePresetInput(await c.req.json()); } catch (e) { return c.json({ error: (e as Error).message }, 400); }
  await updatePreset(c.env.DB, id, input);
  await audit(c.env.DB, c.get("session").username, "preset.update", id, { name: input.name });
  return c.json({ ok: true });
});

presetRoutes.post("/api/admin/presets/:id/clone", async (c) => {
  try {
    const p = await clonePreset(c.env.DB, c.req.param("id"));
    await audit(c.env.DB, c.get("session").username, "preset.clone", p.id, { from: c.req.param("id") });
    return c.json(p, 201);
  } catch (e) { return c.json({ error: (e as Error).message }, 404); }
});

presetRoutes.delete("/api/admin/presets/:id", async (c) => {
  try { await deletePreset(c.env.DB, c.req.param("id")); } catch (e) { return c.json({ error: (e as Error).message }, 409); }
  await audit(c.env.DB, c.get("session").username, "preset.delete", c.req.param("id"));
  return c.json({ ok: true });
});

presetRoutes.post("/api/admin/presets/:id/apply", async (c) => {
  try {
    return c.json(await applyPresetToMembers(c.env.DB, c.var.jf, c.req.param("id"), c.get("session").username, c.var.seerr));
  } catch (e) { return c.json({ error: (e as Error).message }, 404); }
});
