import { Hono } from "hono";
import type { AppEnv } from "../auth";
import { audit } from "../audit";
import type { Env, LocalPatch, Service } from "../env";

/** Admin settings that only exist on a self-hosted install (env.LOCAL). On Cloudflare these answer 404 and the page shows nothing. */
export const selfhostRoutes = new Hono<AppEnv>();
selfhostRoutes.use("/api/admin/selfhost/*", async (c, next) => (c.env.LOCAL ? next() : c.json({ error: "not found" }, 404)));
selfhostRoutes.use("/api/admin/selfhost", async (c, next) => (c.env.LOCAL ? next() : c.json({ error: "not found" }, 404)));

const FIELDS: Record<Service, [keyof Env, keyof Env]> = { jellyfin: ["JELLYFIN_URL", "JELLYFIN_ADMIN_KEY"], seerr: ["SEERR_URL", "SEERR_API_KEY"], tracearr: ["TRACEARR_URL", "TRACEARR_TOKEN"] };
const isService = (n: string): n is Service => Object.hasOwn(FIELDS, n);
// LAN addresses are fine (Jellyfin lives there); cloud-metadata and link-local ones never are.
const cleanUrl = (x: unknown) => { let t = String(x ?? "").trim(); if (t && !/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) t = `http://${t}`; /* a bare 192.168.1.10:8096 means http */ try { const u = new URL(t); return /^https?:$/.test(u.protocol) && u.hostname && !/^(169\.254\.|\[?fe80:|\[?fd00:ec2|metadata\.)/i.test(u.hostname) ? t.replace(/\/+$/, "") : null; } catch { return null; } };

/** The site's own address as an origin (no path). A bare name means https. */
const originOf = (x: unknown) => { let t = String(x ?? "").trim(); if (t && !/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) t = `https://${t}`; try { const u = new URL(t); return /^https?:$/.test(u.protocol) && u.hostname ? u.origin : null; } catch { return null; } };
const HOSTNAME = /^[A-Za-z0-9.:\[\]-]{1,253}$/;
/** The address members use: a bare name means https (it is public), a path is kept (Jellyfin may live under one), a trailing slash goes. */
const publicUrlOf = (x: unknown) => { const t0 = String(x ?? "").trim(); let t = t0; if (t && !/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) t = `https://${t}`; try { const u = new URL(t); return /^https?:$/.test(u.protocol) && u.hostname ? t.replace(/\/+$/, "") : null; } catch { return null; } };

const SITEKEY = /^[0-9A-Za-z_-]{10,100}$/, HOST = /^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/, EMAIL = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,255}$/;

selfhostRoutes.get("/api/admin/selfhost", async (c) => c.json(await c.env.LOCAL!.get()));

selfhostRoutes.put("/api/admin/selfhost", async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as any;
  const patch: LocalPatch = {}, changed: string[] = [];
  const bad = (m: string) => c.json({ error: m }, 400);
  if (b.turnstile) {
    const t = b.turnstile, out: NonNullable<LocalPatch["turnstile"]> = {};
    if (t.siteKey !== undefined) { if (typeof t.siteKey !== "string" || (t.siteKey && !SITEKEY.test(t.siteKey.trim()))) return bad("That does not look like a Turnstile site key."); out.siteKey = t.siteKey.trim(); }
    if (t.secret !== undefined) {
      if (t.secret !== null && (typeof t.secret !== "string" || !t.secret.trim() || t.secret.length > 200)) return bad("Paste the secret key from Cloudflare.");
      out.secret = t.secret === null ? null : t.secret.trim();
      if (out.secret) {
        // A real secret with a bogus response comes back "invalid-input-response"; a wrong secret comes back "invalid-input-secret".
        try {
          const r = await c.var.fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ secret: out.secret, response: "jellypass-key-check" }) });
          const codes = ((await r.json()) as { "error-codes"?: string[] })["error-codes"] ?? [];
          if (codes.includes("invalid-input-secret")) return c.json({ error: "Cloudflare did not accept that secret key. Copy it again from the Turnstile widget." }, 422);
        } catch { /* could not reach Cloudflare: save anyway, the sign-in page will show if it fails */ }
      }
    }
    patch.turnstile = out; changed.push(...Object.keys(out).map((k) => `turnstile.${k}`));
  }
  if (b.network) {
    const n = b.network, out: NonNullable<LocalPatch["network"]> = {};
    if (n.publicUrl !== undefined) { const u = originOf(n.publicUrl); if (!u) return bad("Enter the public address, like https://jellypass.example.com."); out.publicUrl = u; }
    if (n.tlsMode !== undefined) { if (!["", "self-signed", "custom"].includes(n.tlsMode)) return bad("Choose off, self-signed or my own certificate."); out.tlsMode = n.tlsMode; }
    if (n.tlsHosts !== undefined) {
      const list = typeof n.tlsHosts === "string" ? n.tlsHosts.split(",").map((x: string) => x.trim()).filter(Boolean) : null;
      if (!list || list.length > 20 || list.some((x: string) => !HOSTNAME.test(x))) return bad("List the extra names or IP addresses separated by commas, for example 192.168.1.10,jellypass.lan.");
      out.tlsHosts = list.join(",");
    }
    if (n.trustProxy !== undefined) { if (typeof n.trustProxy !== "boolean") return bad("Trust proxy must be on or off."); out.trustProxy = n.trustProxy; }
    if (n.cert !== undefined || n.key !== undefined) {
      for (const v of [n.cert, n.key]) if (typeof v !== "string" || !v.includes("-----BEGIN") || v.length > 20000) return bad("Paste the certificate and the private key as PEM text.");
      out.cert = n.cert; out.key = n.key;
    }
    patch.network = out; changed.push(...Object.keys(out).map((k) => `network.${k}`));
  }
  if (b.updateCheck !== undefined) {
    if (typeof b.updateCheck !== "boolean") return bad("Update checks must be on or off.");
    patch.updateCheck = b.updateCheck; changed.push("updateCheck");
  }
  if (b.emailEnabled !== undefined) {
    if (typeof b.emailEnabled !== "boolean") return bad("Email must be on or off.");
    patch.emailEnabled = b.emailEnabled; changed.push("emailEnabled");
  }
  if (b.smtp) {
    const m = b.smtp, out: NonNullable<LocalPatch["smtp"]> = {};
    if (m.host !== undefined) { if (typeof m.host !== "string" || (m.host && !HOST.test(m.host.trim()))) return bad("The mail server name looks wrong."); out.host = m.host.trim(); }
    if (m.port !== undefined) { if (!Number.isInteger(m.port) || m.port < 1 || m.port > 65535) return bad("The port must be a number from 1 to 65535."); out.port = m.port; }
    if (m.secure !== undefined) { if (typeof m.secure !== "boolean") return bad("SSL must be on or off."); out.secure = m.secure; }
    if (m.user !== undefined) { if (typeof m.user !== "string" || m.user.length > 254) return bad("The username is too long."); out.user = m.user.trim(); }
    if (m.from !== undefined) { if (typeof m.from !== "string" || (m.from && !EMAIL.test(m.from.trim()))) return bad("Enter the From address as name@example.com."); out.from = m.from.trim(); }
    if (m.pass !== undefined) { if (m.pass !== null && (typeof m.pass !== "string" || m.pass.length > 500)) return bad("The password is too long."); out.pass = m.pass; }
    patch.smtp = out; changed.push(...Object.keys(out).map((k) => `smtp.${k}`));
  }
  if (!changed.length) return bad("Nothing to change.");
  try { await c.env.LOCAL!.set(patch); } catch (e) { return c.json({ error: (e as Error).message }, 422); } // e.g. a certificate that does not match: nothing was changed
  await audit(c.env.DB, c.get("session").username, "selfhost.settings", null, { fields: changed }); // names only, never values
  return c.json({ ok: true, ...(await c.env.LOCAL!.get()) });
});

selfhostRoutes.post("/api/admin/selfhost/test-email", async (c) => {
  const to = String(((await c.req.json().catch(() => ({}))) as any).to ?? "").trim();
  if (!EMAIL.test(to)) return c.json({ error: "Enter an email address to send the test to." }, 400);
  try {
    await c.var.mailer.send(to, "Jellypass test email", "<p>This is a test email from Jellypass. If you can read this, email is working.</p>", "This is a test email from Jellypass. If you can read this, email is working.");
  } catch (e) {
    return c.json({ error: `Could not send: ${String((e as Error).message).slice(0, 200)}` }, 502);
  }
  await audit(c.env.DB, c.get("session").username, "selfhost.test_email");
  return c.json({ ok: true });
});

/** Change one service's address and/or key. Checked against the live service first, so a typo cannot take the admin screens down. */
selfhostRoutes.put("/api/admin/selfhost/connection/:service", async (c) => {
  const name = c.req.param("service");
  if (!isService(name)) return c.json({ error: "unknown service" }, 404);
  const b = (await c.req.json().catch(() => ({}))) as any;
  const cur = await c.env.LOCAL!.get(), [urlField, keyField] = FIELDS[name];
  const url = b.url === undefined ? undefined : cleanUrl(b.url);
  if (url === null) return c.json({ error: "That does not look like an address. Use something like 192.168.1.10:8096 or https://jellyfin.example.com." }, 400);
  const key = b.key === undefined || b.key === "" ? undefined : typeof b.key === "string" && b.key.trim().length <= 500 ? b.key.trim() : null;
  if (key === null) return c.json({ error: "The key is too long." }, 400);
  // The address members use is optional, only for Jellyfin and Seerr, and cannot be tested from here (it is meant for members' browsers).
  const pub = b.publicUrl === undefined ? undefined : b.publicUrl === "" ? "" : publicUrlOf(b.publicUrl);
  if (pub === null) return c.json({ error: "That does not look like an address. Use something like watch.example.com or https://watch.example.com." }, 400);
  if (pub !== undefined && name === "tracearr") return c.json({ error: "Tracearr is only used by admins, so it has no separate address for members." }, 400);
  const changesConnection = url !== undefined || key !== undefined;
  if (!changesConnection && pub === undefined) return c.json({ error: "Nothing to change." }, 400);
  let verified: boolean | undefined;
  if (changesConnection) {
    const nextUrl = url ?? cur.connections[name].url;
    if (!nextUrl) return c.json({ error: "Enter the address." }, 400);
    if (key === undefined && !cur.connections[name].keySet) return c.json({ error: "Enter the key too." }, 400);
    // Test the new address with the new key, or with the key already stored when only the address changes.
    const candidate = { ...c.env, [urlField]: nextUrl, ...(key !== undefined ? { [keyField]: key } : {}) } as Env;
    const check = await c.var.testIntegration(name, candidate);
    if (!check.ok) {
      const canForce = b.force === true && !check.rejected && name !== "jellyfin"; // Jellyfin must always be proven; a refused key is simply wrong
      if (!canForce) return c.json({ error: check.rejected ? "The service refused that key." : `Could not reach it (${check.error}). Check the address; it must work from inside the container.` }, 422);
    }
    verified = check.ok;
  }
  await c.env.LOCAL!.set({ connections: { [name]: { ...(url !== undefined ? { url } : {}), ...(key !== undefined ? { key } : {}), ...(pub !== undefined ? { publicUrl: pub } : {}) } } });
  await audit(c.env.DB, c.get("session").username, "selfhost.connection", name, { url: url !== undefined, key: key !== undefined, publicUrl: pub !== undefined, verified: verified ?? null }); // never the values
  return c.json({ ok: true, verified: verified ?? null, ...(await c.env.LOCAL!.get()) });
});

/** Seerr and Tracearr are optional: removing one clears its address and key. Jellyfin cannot be removed. */
selfhostRoutes.delete("/api/admin/selfhost/connection/:service", async (c) => {
  const name = c.req.param("service");
  if (!isService(name) || name === "jellyfin") return c.json({ error: "Jellyfin cannot be removed." }, 400);
  await c.env.LOCAL!.set({ connections: { [name]: { url: "", key: null, ...(name === "seerr" ? { publicUrl: "" } : {}) } } });
  await audit(c.env.DB, c.get("session").username, "selfhost.connection_remove", name);
  return c.json({ ok: true, ...(await c.env.LOCAL!.get()) });
});

/** The certificate the site is serving, so a self-signed one can be added to a device's trust store. Never the private key. */
selfhostRoutes.get("/api/admin/selfhost/certificate", async (c) => {
  const pem = await c.env.LOCAL!.certificate();
  if (!pem) return c.json({ error: "HTTPS is off, so there is no certificate." }, 404);
  return c.body(pem, 200, { "content-type": "application/x-pem-file", "content-disposition": 'attachment; filename="jellypass.crt"', "cache-control": "no-store" });
});

/** Version, changelog and whether a newer release exists. Everything here is public information. */
selfhostRoutes.get("/api/admin/selfhost/about", async (c) => c.json(await c.env.LOCAL!.about()));
selfhostRoutes.post("/api/admin/selfhost/about/check", async (c) => c.json(await c.env.LOCAL!.checkUpdates()));
