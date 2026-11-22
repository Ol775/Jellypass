import { Hono } from "hono";
import { rateReserve, randomToken, type AppEnv } from "../auth";
import { audit } from "../audit";
import { all, first, run } from "../db";
import { renderEmail } from "../emails";
import { createInvite, findValidInvite, hashToken, isEmail, redeemInvite } from "../invites";
import { describePreset, getPreset } from "../presets";

export const inviteRoutes = new Hono<AppEnv>();
const linkFor = (c: { req: { url: string } }, token: string) => `${new URL(c.req.url).origin}/join/${token}`;
const RESEND_COOLDOWN_MS = 60_000;

async function sendInviteEmail(c: any, to: string, token: string, presetId: string, expiresAtIso: string) {
  const preset = (await getPreset(c.env.DB, presetId))!;
  const e = renderEmail("invite", { link: linkFor(c, token), presetName: preset.name, grants: describePreset(preset), expiresAt: new Date(expiresAtIso).toUTCString().slice(5, 16), invitedBy: c.get("session").username });
  await c.var.mailer.send(to, e.subject, e.html, e.text, e.inline);
}

inviteRoutes.get("/api/admin/invites", async (c) =>
  c.json(await all(c.env.DB, "SELECT id, preset_id, email, max_uses, uses, expires_at, created_by, created_at, last_sent_at FROM invites ORDER BY created_at DESC")));

/** The real invite email, rendered exactly as it is sent, with a placeholder link. Shown in a sandboxed frame on the Invites page. */
inviteRoutes.get("/api/admin/invites/preview", async (c) => {
  const preset = await getPreset(c.env.DB, c.req.query("preset") ?? "");
  if (!preset) return c.json({ error: "choose an access level" }, 404);
  const days = Math.min(Math.max(parseInt(c.req.query("days") ?? "7", 10) || 7, 1), 90);
  const e = renderEmail("invite", { link: linkFor(c, "example-invite-link"), presetName: preset.name, grants: describePreset(preset), expiresAt: new Date(Date.now() + days * 86400_000).toUTCString().slice(5, 16), invitedBy: c.get("session").username });
  return c.html(e.html, 200, { "content-security-policy": `default-src 'none'; img-src 'self' ${new URL(c.env.PUBLIC_URL).origin}; style-src 'unsafe-inline'; frame-ancestors 'self'` });
});

inviteRoutes.post("/api/admin/invites", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const preset = await getPreset(c.env.DB, String(b.presetId ?? ""));
  const emails: string[] = Array.isArray(b.emails) ? b.emails.map((e: unknown) => String(e).trim()) : [];
  if (!preset) return c.json({ error: "choose an access level" }, 400);
  if (!Number.isInteger(b.maxUses) || b.maxUses < 1 || b.maxUses > 100) return c.json({ error: "uses must be between 1 and 100" }, 400);
  if (!Number.isInteger(b.expiresInDays) || b.expiresInDays < 1 || b.expiresInDays > 90) return c.json({ error: "expiry must be between 1 and 90 days" }, 400);
  if (emails.length > 25 || emails.some((e) => !isEmail(e))) return c.json({ error: "check the email addresses (up to 25)" }, 400);
  const session = c.get("session");
  const targets: Array<string | undefined> = emails.length ? emails : [undefined];
  const invites = [];
  for (const email of targets) {
    const inv = await createInvite(c.env.DB, { presetId: preset.id, email, maxUses: emails.length ? 1 : b.maxUses, expiresInDays: b.expiresInDays, createdBy: session.username, sent: !!email });
    let ok = true, error: string | undefined;
    if (email) {
      try { await sendInviteEmail(c, email, inv.token, preset.id, new Date(Date.now() + b.expiresInDays * 86400_000).toISOString()); }
      catch { ok = false; error = "the email could not be sent; copy the link instead"; }
    }
    await audit(c.env.DB, session.username, "invite.create", inv.id, { preset: preset.name, email: email ?? null });
    invites.push({ id: inv.id, email: email ?? null, link: linkFor(c, inv.token), ok, error });
  }
  return c.json({ invites }, 201);
});

inviteRoutes.post("/api/admin/invites/:id/resend", async (c) => {
  const id = c.req.param("id");
  const inv = await first<{ email: string | null; preset_id: string; expires_at: string; last_sent_at: string | null }>(c.env.DB, "SELECT email, preset_id, expires_at, last_sent_at FROM invites WHERE id = ? AND uses < max_uses AND expires_at > ?", id, new Date().toISOString());
  if (!inv) return c.json({ error: "not found or no longer valid" }, 404);
  if (!inv.email) return c.json({ error: "this invite has no email address" }, 400);
  if (inv.last_sent_at && Date.now() - Date.parse(inv.last_sent_at) < RESEND_COOLDOWN_MS) return c.json({ error: "wait a minute before resending" }, 429);
  const token = randomToken(24); // a new link; the old one stops working only once the new one has actually been emailed
  try { await sendInviteEmail(c, inv.email, token, inv.preset_id, inv.expires_at); } catch { return c.json({ error: "the email could not be sent, the old link still works" }, 502); }
  await run(c.env.DB, "UPDATE invites SET token_hash = ?, last_sent_at = ? WHERE id = ?", await hashToken(token), new Date().toISOString(), id);
  await audit(c.env.DB, c.get("session").username, "invite.resend", id);
  return c.json({ ok: true });
});

inviteRoutes.delete("/api/admin/invites/:id", async (c) => {
  await run(c.env.DB, "DELETE FROM invites WHERE id = ?", c.req.param("id"));
  await audit(c.env.DB, c.get("session").username, "invite.revoke", c.req.param("id"));
  return c.json({ ok: true });
});

inviteRoutes.get("/api/invites/:token", async (c) => {
  const inv = await findValidInvite(c.env.DB, c.req.param("token"));
  if (!inv) return c.json({ error: "this invite is not valid any more" }, 404);
  const p = (await getPreset(c.env.DB, inv.preset_id))!;
  return c.json({ presetName: p.name, grants: describePreset(p), expiresAt: inv.expires_at, email: inv.email });
});

inviteRoutes.post("/api/invites/redeem", async (c) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  if (!(await rateReserve(c.env.DB, `redeem:ip:${ip}`, 20, 3600))) return c.json({ error: "too many attempts, try again later" }, 429);
  const b = await c.req.json().catch(() => ({}));
  const r = await redeemInvite({ env: c.env, jf: c.var.jf, seerr: c.var.seerr }, { token: String(b.token ?? ""), username: String(b.username ?? ""), password: String(b.password ?? ""), contactEmail: b.contactEmail ? String(b.contactEmail) : undefined });
  return r.ok ? c.json({ ok: true, name: r.name }, 201) : c.json({ error: r.error }, r.status);
});
