import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { all, run } from "../src/db";
import { readyRequests, streamWarnings } from "../src/cron/notify";
import { b64u, encryptPayload, sendPush, unb64u, validEndpoint, vapidPublicKey } from "../src/push";

const keyPair = () => crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]) as Promise<CryptoKeyPair>;
const ecdh = () => crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as Promise<CryptoKeyPair>;
const newVapid = async () => { const { privateKey } = await keyPair(); const { kty, crv, x, y, d } = await crypto.subtle.exportKey("jwk", privateKey); return JSON.stringify({ kty, crv, x, y, d }); };
const device = async (endpoint = "https://fcm.googleapis.com/fcm/send/abc") => { const k = await ecdh(); return { endpoint, keys: { p256dh: b64u(await crypto.subtle.exportKey("raw", k.publicKey)), auth: b64u(crypto.getRandomValues(new Uint8Array(16))) } }; };

describe("payload encryption", () => {
  test("matches the RFC 8291 appendix A test vector", async () => {
    const asPublic = unb64u("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8");
    const privateKey = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: b64u(asPublic.slice(1, 33)), y: b64u(asPublic.slice(33)), d: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw" }, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const publicKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, true, []);
    const out = await encryptPayload(unb64u("V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24"), unb64u("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4"), unb64u("BTBZMqHH6r4Tts7J_aSIgg"), { keys: { privateKey, publicKey }, salt: unb64u("DGv6ra1nlYgDCS1FRnbzlw") });
    expect(b64u(out.slice(0, 86))).toBe("DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8");
    expect(b64u(out.slice(86))).toBe("8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ");
  });
  test("only the real browser push services are accepted as endpoints", () => {
    for (const ok of ["https://fcm.googleapis.com/fcm/send/x", "https://updates.push.services.mozilla.com/wpush/v2/x", "https://web.push.apple.com/x", "https://wns2-par02p.notify.windows.com/?token=x"]) expect(validEndpoint(ok)).toBe(true);
    for (const bad of ["http://fcm.googleapis.com/x", "https://evil.test/x", "https://fcm.googleapis.com.evil.test/x", "https://user@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x", "https://127.0.0.1/x", "javascript:alert(1)", 5, null]) expect(validEndpoint(bad)).toBe(false);
  });
});

describe("service worker", () => {
  test("is served from the root with a scope header and only shows notices and opens https links", async () => {
    const res = await createApp().request("/sw.js", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("service-worker-allowed")).toBe("/");
    expect(res.headers.get("content-type")).toContain("javascript");
    const body = await res.text();
    expect(body).toContain("showNotification");
    expect(body).toContain("u.protocol === 'https:'");
  });
});

describe("icons and search engines", () => {
  test("tab, Home Screen and notification icons are served; robots and headers keep the site out of search; the sitemap is hidden and public-only", async () => {
    const app = createApp();
    for (const [path, type] of [["/favicon.svg", "image/svg+xml"], ["/favicon.ico", "image/png"], ["/apple-touch-icon.png", "image/png"], ["/assets/icon-192.png", "image/png"], ["/assets/icon-512.png", "image/png"]] as const) {
      const r = await app.request(path, {}, env);
      expect(r.status, path).toBe(200); expect(r.headers.get("content-type")).toBe(type);
    }
    expect(new Uint8Array(await (await app.request("/favicon.ico", {}, env)).arrayBuffer()).slice(0, 4)).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    expect(await (await app.request("/robots.txt", {}, env)).text()).toBe("User-agent: *\nDisallow: /\n");
    const page = await app.request("/signin", {}, env);
    expect(page.headers.get("x-robots-tag")).toContain("noindex");
    const html = await page.text();
    expect(html).toContain('name="robots" content="noindex,nofollow,noarchive"'); expect(html).toContain('rel="icon" href="/favicon.svg"');
    expect(html).not.toContain("sitemap"); // hidden: nothing links to it
    const map = await app.request("/sitemap.xml", {}, env);
    expect(map.status).toBe(200); expect(map.headers.get("x-robots-tag")).toContain("noindex");
    const xml = await map.text();
    expect(xml).toContain("/signin"); expect(xml).not.toContain("/admin");
    expect((await app.request("/api/me", {}, env)).headers.get("x-robots-tag")).toContain("noindex");
  });
});

describe("web app manifest", () => {
  test("lets phones install Jellypass, and pages link to it", async () => {
    const app = createApp();
    const m = (await (await app.request("/manifest.webmanifest", {}, env)).json()) as any;
    expect(m.display).toBe("standalone");
    expect(await (await app.request("/signin", {}, env)).text()).toContain('rel="manifest"');
  });
});

describe("push routes", () => {
  let calls: Array<{ url: string; headers: Record<string, string> }>, status: number;
  const fetchStub = (async (url: string, init: any) => { calls.push({ url, headers: init.headers }); return new Response(null, { status }); }) as never;
  const app = createApp({
    fetch: fetchStub,
    jellyfin: (() => ({ authenticate: async () => ({ id: "u1", name: "maya", isAdmin: false }), getUser: async () => ({ id: "u1", name: "maya", isAdmin: false, isDisabled: false }), activity: async () => [], sessions: async () => [] })) as never,
  });
  let penv: any;
  const req = (method: string, path: string, body?: unknown, h: any = {}) => app.request(path, { method, headers: { "content-type": "application/json", ...h }, body: body === undefined ? undefined : JSON.stringify(body) }, penv);
  const login = async () => { const r = await req("POST", "/api/signin", { username: "maya", password: "x" }); return { cookie: r.headers.get("set-cookie")!.split(";")[0], "x-csrf-token": ((await r.json()) as any).csrf as string }; };
  beforeEach(async () => {
    calls = []; status = 201; penv = { ...env, VAPID_KEYS: await newVapid() };
    for (const t of ["members", "sessions", "rate_limits", "push_subscriptions"]) await run(env.DB, `DELETE FROM ${t}`);
  });
  test("without keys push is off: the key is 404 and nobody can subscribe", async () => {
    penv = { ...env }; const a = await login();
    expect((await req("GET", "/api/push/key", undefined, a)).status).toBe(404);
    expect((await req("POST", "/api/push/subscribe", await device(), a)).status).toBe(404);
  });
  test("subscribe keeps one row per device, refuses bad endpoints and keys, and unsubscribe only removes your own", async () => {
    const a = await login(), dev = await device();
    expect(((await (await req("GET", "/api/push/key", undefined, a)).json()) as any).key).toBe(vapidPublicKey(penv.VAPID_KEYS));
    expect((await req("POST", "/api/push/subscribe", { ...dev, endpoint: "https://evil.test/x" }, a)).status).toBe(400);
    expect((await req("POST", "/api/push/subscribe", { endpoint: dev.endpoint, keys: { p256dh: "short", auth: "x" } }, a)).status).toBe(400);
    expect((await req("POST", "/api/push/subscribe", dev, a)).status).toBe(200);
    expect((await req("POST", "/api/push/subscribe", dev, a)).status).toBe(200);
    expect(await all(env.DB, "SELECT 1 FROM push_subscriptions")).toHaveLength(1);
    await run(env.DB, "INSERT INTO push_subscriptions (endpoint, jellyfin_id, p256dh, auth, created_at) VALUES ('https://fcm.googleapis.com/other','u2','p','a','now')");
    await req("POST", "/api/push/unsubscribe", { endpoint: "https://fcm.googleapis.com/other" }, a);
    expect(await all(env.DB, "SELECT 1 FROM push_subscriptions WHERE jellyfin_id = 'u2'")).toHaveLength(1);
    await req("POST", "/api/push/unsubscribe", { endpoint: dev.endpoint }, a);
    expect(await all(env.DB, "SELECT 1 FROM push_subscriptions WHERE jellyfin_id = 'u1'")).toHaveLength(0);
  });
  test("a member keeps at most five devices", async () => {
    const a = await login();
    for (let i = 0; i < 7; i++) { await req("POST", "/api/push/subscribe", await device(`https://fcm.googleapis.com/fcm/send/d${i}`), a); await new Promise((r) => setTimeout(r, 2)); }
    expect(await all(env.DB, "SELECT 1 FROM push_subscriptions")).toHaveLength(5);
  });
  test("the test notice is signed, encrypted and sent to the push service; a gone device is forgotten", async () => {
    const a = await login();
    await req("POST", "/api/push/subscribe", await device(), a);
    expect((await req("POST", "/api/push/test", {}, a)).status).toBe(200);
    expect(calls[0].url).toBe("https://fcm.googleapis.com/fcm/send/abc");
    expect(calls[0].headers["Content-Encoding"]).toBe("aes128gcm");
    expect(calls[0].headers.Authorization).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]{87}$/);
    status = 410;
    expect((await req("POST", "/api/push/test", {}, a)).status).toBe(502);
    expect(await all(env.DB, "SELECT 1 FROM push_subscriptions")).toHaveLength(0);
  });
  test("it needs a session and CSRF", async () => {
    expect((await req("GET", "/api/push/key")).status).toBe(401);
    const a = await login();
    expect((await req("POST", "/api/push/test", {}, { cookie: a.cookie })).status).toBe(403);
  });
});

describe("notices go to subscribed devices", () => {
  let pushed: string[];
  const fetchStub = (async (url: string) => { pushed.push(url); return new Response(null, { status: 201 }); }) as never;
  const jf = { sessions: async () => [{ id: "a", userName: "maya", deviceName: "TV", remoteIp: "1.1.1.1", itemId: "i" }, { id: "b", userName: "maya", deviceName: "TV", remoteIp: "2.2.2.2", itemId: "i" }], libraryItem: async () => ({ id: "a".repeat(32), quality: null }) };
  const seerr = { userRequests: async () => [{ id: 1, media: { status: 5, mediaType: "movie", tmdbId: 1, updatedAt: new Date().toISOString() } }], summary: async () => ({ title: "Heat" }) };
  const mail: string[] = [];
  const d = (vapid?: string) => ({ env: { ...env, VAPID_KEYS: vapid } as never, db: env.DB, jf: jf as never, seerr: seerr as never, mailer: { send: async (to: string) => void mail.push(to) }, baseUrl: "https://jp.test", fetch: fetchStub });
  beforeEach(async () => {
    pushed = []; mail.length = 0;
    for (const t of ["members", "push_subscriptions", "notice_log"]) await run(env.DB, `DELETE FROM ${t}`);
    await run(env.DB, "INSERT INTO members (jellyfin_id, username, seerr_user_id) VALUES ('u1','maya',7)"); // no email at all
    const dev = await device();
    await run(env.DB, "INSERT INTO push_subscriptions (endpoint, jellyfin_id, p256dh, auth, created_at) VALUES (?,?,?,?,?)", dev.endpoint, "u1", dev.keys.p256dh, dev.keys.auth, "now");
  });
  test("a member with a device and no email still gets ready and two-places notices; with push off they get nothing", async () => {
    const vapid = await newVapid();
    expect(await readyRequests(d(vapid))).toEqual({ sent: 1 });
    expect(pushed).toHaveLength(1);
    expect((await streamWarnings(d(vapid))).warned).toBe(1);
    expect(pushed).toHaveLength(2);
    expect(mail).toEqual([]);
    await run(env.DB, "DELETE FROM notice_log");
    expect(await readyRequests(d(undefined))).toEqual({ sent: 0 });
    expect(pushed).toHaveLength(2);
  });
  test("sendPush never throws, even when the push service is down", async () => {
    const dead = (async () => { throw new Error("down"); }) as never;
    expect(await sendPush({ db: env.DB, vapid: await newVapid(), baseUrl: "https://jp.test", fetch: dead }, "u1", { title: "t", body: "b", url: "/" })).toBe(0);
  });
});
