import { Hono } from "hono";
import { rateReserve, requireSession, type AppEnv } from "../auth";
import { first, run } from "../db";
import { getMember } from "../members";
import { parsePatch, type OnboardingState } from "../onboarding";

export const onboardingRoutes = new Hono<AppEnv>();
onboardingRoutes.use("/api/onboarding/*", requireSession);
onboardingRoutes.use("/api/onboarding", requireSession);
onboardingRoutes.use("/api/me/reminders", requireSession);

const read = (json: string): OnboardingState => { try { return JSON.parse(json); } catch { return {}; } };

onboardingRoutes.get("/api/onboarding", async (c) => {
  const m = await getMember(c.env.DB, c.get("session").jellyfinId);
  const state = read(m?.onboarding_state ?? "{}");
  return c.json({ state: { kind: "existing", ...state }, needsOnboarding: !state.done, contactEmail: m?.contact_email ?? null, emailVerified: !!m?.email_verified, remindersOn: m?.reminders_on !== 0 });
});

onboardingRoutes.put("/api/onboarding", async (c) => {
  let patch;
  try { patch = parsePatch(await c.req.json()); } catch (e) { return c.json({ error: (e as Error).message }, 400); }
  const id = c.get("session").jellyfinId;
  const m = await getMember(c.env.DB, id);
  if (!m) return c.json({ error: "not found" }, 404);
  const next = { ...read(m.onboarding_state), ...patch }; // merge, so going back keeps earlier choices
  await run(c.env.DB, "UPDATE members SET onboarding_state = ? WHERE jellyfin_id = ?", JSON.stringify(next), id);
  return c.json({ state: next });
});

onboardingRoutes.post("/api/onboarding/complete", async (c) => {
  const id = c.get("session").jellyfinId;
  const m = await getMember(c.env.DB, id);
  if (!m) return c.json({ error: "not found" }, 404);
  await run(c.env.DB, "UPDATE members SET onboarding_state = ? WHERE jellyfin_id = ?", JSON.stringify({ ...read(m.onboarding_state), step: "done", done: true }), id);
  return c.json({ ok: true });
});

onboardingRoutes.post("/api/onboarding/quickconnect", async (c) => {
  const code = String((await c.req.json().catch(() => ({}))).code ?? "").trim();
  if (!/^\d{6}$/.test(code)) return c.json({ error: "enter the 6-digit code shown on your TV" }, 400);
  const id = c.get("session").jellyfinId;
  if (!(await rateReserve(c.env.DB, `qc:${id}`, 10, 900))) return c.json({ error: "too many tries, wait a few minutes" }, 429);
  try { await c.var.jf.quickConnectAuthorize(id, code); } catch { return c.json({ error: "that code did not work; check it and try again" }, 422); }
  return c.json({ ok: true });
});

onboardingRoutes.put("/api/me/reminders", async (c) => {
  const on = (await c.req.json().catch(() => ({}))).on;
  if (typeof on !== "boolean") return c.json({ error: "on must be true or false" }, 400);
  await run(c.env.DB, "UPDATE members SET reminders_on = ? WHERE jellyfin_id = ?", on ? 1 : 0, c.get("session").jellyfinId);
  return c.json({ ok: true });
});
