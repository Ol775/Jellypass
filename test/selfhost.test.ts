import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { all, run } from "../src/db";
import { adminJs } from "../src/views/js/admin";
import type { Env, LocalConfig, LocalPatch, LocalSettings } from "../src/env";

let siteverify: string[];
let sent: Array<{ to: string; subject: string }>;
let mailFails = false;
let verdict: "ok" | "refused" | "unreachable" = "ok";
let tested: Record<string, unknown> = {};
const jf = () => ({ authenticate: async (n: string) => ({ id: n === "olivia" ? "a1" : "u1", name: n, isAdmin: n === "olivia" }), getUser: async (id: string) => ({ id, name: id === "a1" ? "olivia" : "maya", isAdmin: id === "a1", isDisabled: false, policy: {} }) }) as never;
const app = createApp({
  jellyfin: (() => jf()) as never,
  fetch: (async () => new Response(JSON.stringify({ "error-codes": siteverify }))) as never,
  testIntegration: (async (n: string, e: Env) => { tested = { n, ...e as any }; return verdict === "ok" ? { ok: true } : { ok: false, rejected: verdict === "refused", error: "x" }; }) as never,
  mailer: (() => ({ send: async (to: string, subject: string) => { if (mailFails) throw new Error("535 bad login"); sent.push({ to, subject }); } })) as never,
});

function localStore(): LocalConfig & { saved: LocalPatch[]; setNetError(m: string | null): void } {
  const saved: LocalPatch[] = []; const st: LocalSettings = { network: { publicUrl: "https://jp.example", tlsMode: "", tlsHosts: "", trustProxy: false, https: false, port: 8787, restarting: false, cert: null }, emailEnabled: true, connections: { jellyfin: { url: "http://jf.lan:8096", keySet: true }, seerr: { url: "", keySet: false }, tracearr: { url: "", keySet: false } }, turnstile: { siteKey: "", secretSet: false }, smtp: { host: "", port: 587, secure: false, user: "", from: "", passSet: false } };
  let netErr: string | null = null;
  let checks = 0;
  const about = () => ({ version: "1.0.0", repo: "x/y", updateCheck: true, latest: { version: "1.1.0", url: "https://github.com/x/y/releases/tag/v1.1.0", notes: "Fixes", publishedAt: null }, updateAvailable: true, checkedAt: null, error: null, changelog: [{ version: "1.0.0", date: "2026-11-22", body: "First release" }] });
  return { saved, setNetError(m: string | null) { netErr = m; }, async about() { return about(); }, async checkUpdates() { checks++; return { ...about(), checkedAt: `check-${checks}` }; }, async certificate() { return st.network.https ? "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----\n" : null; }, async get() { return st; }, async set(p) { if (p.network && netErr) throw new Error(netErr); saved.push(p); if (p.network?.tlsMode !== undefined) { st.network.tlsMode = p.network.tlsMode; st.network.https = !!p.network.tlsMode; } if (p.network?.publicUrl) st.network.publicUrl = p.network.publicUrl; if (p.turnstile?.siteKey !== undefined) st.turnstile.siteKey = p.turnstile.siteKey; if (p.turnstile?.secret !== undefined) st.turnstile.secretSet = !!p.turnstile.secret; for (const [k, v] of Object.entries(p.connections ?? {})) { if (v.url !== undefined) st.connections[k as keyof typeof st.connections].url = v.url; if (v.key !== undefined) st.connections[k as keyof typeof st.connections].keySet = !!v.key; }
    if (p.smtp?.host !== undefined) st.smtp.host = p.smtp.host; if (p.smtp?.pass !== undefined) st.smtp.passSet = !!p.smtp.pass; } };
}
let local: ReturnType<typeof localStore>;
const e = () => ({ ...env, LOCAL: local, SESSION_SECRET: "test-secret" }) as unknown as Env;
const j = (method: string, body?: unknown, h: Record<string, string> = {}) => ({ method, headers: { "content-type": "application/json", ...h }, body: body === undefined ? undefined : JSON.stringify(body) });
async function login(name: string, env_: Env) {
  const r = await app.request("/api/signin", j("POST", { username: name, password: "x" }), env_);
  return { cookie: r.headers.get("set-cookie")!.split(";")[0], "x-csrf-token": ((await r.json()) as any).csrf as string };
}
beforeEach(async () => {
  verdict = "ok"; tested = {}; local = localStore(); siteverify = ["invalid-input-response"]; sent = []; mailFails = false;
  for (const t of ["audit", "sessions", "rate_limits", "members"]) await run(env.DB, `DELETE FROM ${t}`);
});

describe("self-hosted settings", () => {
  test("do not exist on Cloudflare (no LOCAL binding) and need an admin", async () => {
    const plain = { ...env, SESSION_SECRET: "test-secret" } as unknown as Env;
    const a = await login("olivia", plain);
    expect((await app.request("/api/admin/selfhost", j("GET", undefined, a), plain)).status).toBe(404);
    const m = await login("maya", e());
    expect((await app.request("/api/admin/selfhost", j("GET", undefined, m), e())).status).toBe(403);
  });

  test("Turnstile: a secret Cloudflare refuses is not saved; a good one is saved, never echoed, and audited by field name only", async () => {
    const a = await login("olivia", e());
    siteverify = ["invalid-input-secret"];
    expect((await app.request("/api/admin/selfhost", j("PUT", { turnstile: { siteKey: "0x4AAAAAAAsitekey123", secret: "bad-secret" } }, a), e())).status).toBe(422);
    expect(local.saved).toHaveLength(0);
    siteverify = ["invalid-input-response"];
    const ok = await app.request("/api/admin/selfhost", j("PUT", { turnstile: { siteKey: "0x4AAAAAAAsitekey123", secret: "good-secret-value" } }, a), e());
    expect(ok.status).toBe(200);
    const body = await ok.text();
    expect(body).not.toContain("good-secret-value");
    expect(JSON.parse(body).turnstile).toEqual({ siteKey: "0x4AAAAAAAsitekey123", secretSet: true });
    const audits = JSON.stringify(await all(env.DB, "SELECT * FROM audit WHERE action = 'selfhost.settings'"));
    expect(audits).toContain("turnstile.secret");
    expect(audits).not.toContain("good-secret-value");
  });

  test("SMTP: rejects bad input, saves good input without returning the password", async () => {
    const a = await login("olivia", e());
    const put = (smtp: unknown) => app.request("/api/admin/selfhost", j("PUT", { smtp }, a), e());
    expect((await put({ port: 99999 })).status).toBe(400);
    expect((await put({ host: "bad host!" })).status).toBe(400);
    expect((await put({ from: "not-an-email" })).status).toBe(400);
    const ok = await put({ host: "smtp.example.com", port: 465, secure: true, user: "me", from: "jellypass@example.com", pass: "hunter2-secret" });
    expect(ok.status).toBe(200);
    expect(await ok.text()).not.toContain("hunter2-secret");
    expect(JSON.stringify(await all(env.DB, "SELECT * FROM audit"))).not.toContain("hunter2-secret");
    expect(local.saved.at(-1)?.smtp?.pass).toBe("hunter2-secret");
  });

  test("test email sends through the mailer and reports a failure plainly", async () => {
    const a = await login("olivia", e());
    const post = (to: string) => app.request("/api/admin/selfhost/test-email", j("POST", { to }, a), e());
    expect((await post("nope")).status).toBe(400);
    expect((await post("me@example.com")).status).toBe(200);
    expect(sent).toEqual([{ to: "me@example.com", subject: "Jellypass test email" }]);
    mailFails = true;
    const bad = await post("me@example.com");
    expect(bad.status).toBe(502);
    expect(((await bad.json()) as any).error).toContain("535 bad login");
  });
});

describe("connections", () => {
  const put = (a: any, svc: string, body: unknown, m = "PUT") => app.request(`/api/admin/selfhost/connection/${svc}`, j(m, body, a), e());
  test("an address and key are tested together before anything is saved, and the key is never echoed", async () => {
    const a = await login("olivia", e());
    verdict = "refused";
    expect((await put(a, "seerr", { url: "http://seerr.lan:5055", key: "wrong-key" })).status).toBe(422);
    expect(local.saved).toHaveLength(0);
    verdict = "ok";
    const r = await put(a, "seerr", { url: "http://seerr.lan:5055/", key: "right-key-123" });
    expect(r.status).toBe(200);
    expect(await r.clone().text()).not.toContain("right-key-123");
    expect(tested).toMatchObject({ n: "seerr", SEERR_URL: "http://seerr.lan:5055", SEERR_API_KEY: "right-key-123" });
    expect((await r.json() as any).connections.seerr).toEqual({ url: "http://seerr.lan:5055", keySet: true });
    expect(JSON.stringify(await all(env.DB, "SELECT * FROM audit"))).not.toContain("right-key-123");
  });
  test("only the address can change: the stored key is kept and still used for the check", async () => {
    const a = await login("olivia", e());
    expect((await put(a, "jellyfin", { url: "http://new-jf.lan:8096" })).status).toBe(200);
    expect(local.saved.at(-1)).toEqual({ connections: { jellyfin: { url: "http://new-jf.lan:8096" } } });
    expect((await put(a, "seerr", { url: "http://seerr.lan" })).status).toBe(400); // no key stored yet, so it needs one
  });
  test("bad addresses are refused, unreachable optional services can be saved anyway, Jellyfin cannot", async () => {
    const a = await login("olivia", e());
    for (const url of ["ftp://x", "http://", "http://169.254.169.254/x"]) expect((await put(a, "seerr", { url, key: "k" })).status).toBe(400);
    verdict = "unreachable";
    expect((await put(a, "seerr", { url: "http://down.lan", key: "k" })).status).toBe(422);
    expect((await put(a, "seerr", { url: "http://down.lan", key: "k", force: true })).status).toBe(200);
    expect((await put(a, "jellyfin", { url: "http://down.lan", key: "k", force: true })).status).toBe(422);
  });
  test("an address typed without http:// is accepted as http", async () => {
    const a = await login("olivia", e());
    expect(((await (await put(a, "seerr", { url: "192.168.1.5:5055", key: "k" })).json()) as any).connections.seerr.url).toBe("http://192.168.1.5:5055");
  });
  test("optional services can be removed; Jellyfin cannot", async () => {
    const a = await login("olivia", e());
    expect((await put(a, "tracearr", {}, "DELETE")).status).toBe(200);
    expect(local.saved.at(-1)).toEqual({ connections: { tracearr: { url: "", key: null } } });
    expect((await put(a, "jellyfin", {}, "DELETE")).status).toBe(400);
  });
});

test("the admin script is valid JavaScript (a syntax slip silently disables every admin page)", () => {
  // Parse only: imports are removed because the module is served to the browser, not run here.
  expect(() => new Function(`return async()=>{${adminJs.replace(/^import .*$/gm, "").replace(/^export /gm, "")}}`)).not.toThrow();
});

describe("email off", () => {
  const offEnv = () => ({ ...e(), EMAIL_OFF: "true" }) as unknown as Env;
  const realMailer = createApp({ jellyfin: (() => jf()) as never });
  const asJson = (method: string, body?: unknown, h: Record<string, string> = {}) => j(method, body, h);
  test("the real mailer refuses to send, and the user-facing email flows answer 409", async () => {
    const a = await login("maya", offEnv());
    const post = (path: string, body: unknown, h = {}) => realMailer.request(path, asJson("POST", body, h), offEnv());
    expect((await post("/api/reset/request", { identifier: "maya" })).status).toBe(409);
    expect((await post("/api/magic/request", { identifier: "maya" })).status).toBe(409);
    expect((await post("/api/email/send-code", { email: "m@example.com", password: "x" }, a)).status).toBe(409);
  });
  test("the pages drop the email-only parts and /api/me says so", async () => {
    const a = await login("maya", offEnv());
    const me = (await (await realMailer.request("/api/me", { headers: { cookie: a.cookie } }, offEnv())).json()) as any;
    expect(me.emailOn).toBe(false);
    const signin = await (await realMailer.request("/signin", {}, offEnv())).text();
    expect(signin).not.toContain('href="/forgot"');
    expect(await (await realMailer.request("/forgot", {}, offEnv())).text()).toContain("Email is turned off");
    expect(await (await realMailer.request("/signin", {}, e())).text()).toContain('href="/forgot"');
  });
  test("with email off a member skips the welcome (no redirect loop), with it on they still get it", async () => {
    const off = await login("maya", offEnv());
    expect((await realMailer.request("/welcome", { headers: { cookie: off.cookie }, redirect: "manual" }, offEnv())).headers.get("location")).toBe("/");
    expect((await realMailer.request("/", { headers: { cookie: off.cookie }, redirect: "manual" }, offEnv())).headers.get("location")).not.toBe("/welcome");
    await run(env.DB, "DELETE FROM members"); await run(env.DB, "DELETE FROM sessions");
    const on = await login("maya", e());
    expect((await realMailer.request("/welcome", { headers: { cookie: on.cookie }, redirect: "manual" }, e())).status).toBe(200);
  });
  test("admins can switch email off from settings", async () => {
    const a = await login("olivia", e());
    expect((await app.request("/api/admin/selfhost", j("PUT", { emailEnabled: "no" }, a), e())).status).toBe(400);
    expect((await app.request("/api/admin/selfhost", j("PUT", { emailEnabled: false }, a), e())).status).toBe(200);
    expect(local.saved.at(-1)).toEqual({ emailEnabled: false });
  });
});

describe("network settings", () => {
  const put = (a: any, network: unknown) => app.request("/api/admin/selfhost", j("PUT", { network }, a), e());
  test("addresses, mode and hosts are validated; a bare name becomes https; a path is dropped", async () => {
    const a = await login("olivia", e());
    expect((await put(a, { publicUrl: "ftp://x" })).status).toBe(400);
    expect((await put(a, { tlsMode: "weird" })).status).toBe(400);
    expect((await put(a, { tlsHosts: "bad host!" })).status).toBe(400);
    expect((await put(a, { trustProxy: "yes" })).status).toBe(400);
    expect((await put(a, { cert: "nope", key: "nope" })).status).toBe(400);
    expect((await put(a, { publicUrl: "jellypass.example.com/some/path", tlsMode: "self-signed", tlsHosts: "192.168.1.10, jellypass.lan", trustProxy: true })).status).toBe(200);
    expect(local.saved.at(-1)).toEqual({ network: { publicUrl: "https://jellypass.example.com", tlsMode: "self-signed", tlsHosts: "192.168.1.10,jellypass.lan", trustProxy: true } });
  });
  test("a certificate the server rejects changes nothing and its message reaches the admin; keys are never audited", async () => {
    const a = await login("olivia", e());
    local.setNetError("The private key does not belong to that certificate.");
    const r = await put(a, { tlsMode: "custom", cert: "-----BEGIN CERTIFICATE-----x", key: "-----BEGIN PRIVATE KEY-----secret-key-body" });
    expect(r.status).toBe(422);
    expect(((await r.json()) as any).error).toContain("does not belong");
    expect(local.saved).toHaveLength(0);
    local.setNetError(null);
    expect((await put(a, { tlsMode: "custom", cert: "-----BEGIN CERTIFICATE-----x", key: "-----BEGIN PRIVATE KEY-----secret-key-body" })).status).toBe(200);
    expect(JSON.stringify(await all(env.DB, "SELECT * FROM audit"))).not.toContain("secret-key-body");
  });
  test("the certificate download needs HTTPS to be on and never includes a key", async () => {
    const a = await login("olivia", e());
    expect((await app.request("/api/admin/selfhost/certificate", j("GET", undefined, a), e())).status).toBe(404);
    await put(a, { tlsMode: "self-signed" });
    const r = await app.request("/api/admin/selfhost/certificate", j("GET", undefined, a), e());
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).toContain("BEGIN CERTIFICATE"); expect(body).not.toContain("PRIVATE KEY");
  });
});

describe("version and updates", () => {
  test("about and check-now are admin-only and exist only on self-hosted installs", async () => {
    const plain = { ...env, SESSION_SECRET: "test-secret" } as unknown as Env;
    const a0 = await login("olivia", plain);
    expect((await app.request("/api/admin/selfhost/about", j("GET", undefined, a0), plain)).status).toBe(404);
    const m = await login("maya", e());
    expect((await app.request("/api/admin/selfhost/about", j("GET", undefined, m), e())).status).toBe(403);
    const a = await login("olivia", e());
    const r = (await (await app.request("/api/admin/selfhost/about", j("GET", undefined, a), e())).json()) as any;
    expect(r).toMatchObject({ version: "1.0.0", updateAvailable: true, latest: { version: "1.1.0" } });
    const c = (await (await app.request("/api/admin/selfhost/about/check", j("POST", {}, a), e())).json()) as any;
    expect(c.checkedAt).toBe("check-1");
  });
  test("update checks can be switched off and on, and only with a real boolean", async () => {
    const a = await login("olivia", e());
    const put = (b: unknown) => app.request("/api/admin/selfhost", j("PUT", b, a), e());
    expect((await put({ updateCheck: "no" })).status).toBe(400);
    expect((await put({ updateCheck: false })).status).toBe(200);
    expect(local.saved.at(-1)).toEqual({ updateCheck: false });
  });
});

test("the sign-in page hides the emailed-link option when email is off (and keeps it when on)", async () => {
  const page = async (extra: Record<string, string>) => (await (await createApp({}).request("/signin", {}, { ...env, ...extra } as unknown as Env)).text());
  const hiddenOpen = /<button[^>]*id="magic-open"[^>]*\shidden[\s>]/;
  expect(await page({ EMAIL_OFF: "true" })).toMatch(hiddenOpen);
  expect(await page({})).not.toMatch(hiddenOpen);
});
