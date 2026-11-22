import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { all, first, run } from "../src/db";
import { checkPortalSignin, cityForIp, deviceLabel, parseActivity, pollActivity, recordPortalSignin } from "../src/signins";

let sent: Array<{ to: string; subject: string; text: string }>;
let entries: any[];
let devicesCleared: string[];
let passwordsSet: Array<[string, string]>;
const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString();
const entry = (over: Partial<any> = {}) => ({ id: 1, name: "maya is online from Safari", overview: "IP address: 9.9.9.9", shortOverview: "", type: "SessionStarted", userId: "u1", date: iso(1), severity: "Information", ...over });
const mailer = { send: async (to: string, subject: string, _h: string, text: string) => void sent.push({ to, subject, text }) };
const jfStub = () => ({ activity: async () => entries });
const users: Record<string, any> = { u1: { id: "u1", name: "maya", isAdmin: false, isDisabled: false }, u2: { id: "u2", name: "ben", isAdmin: false, isDisabled: false } };
const app = createApp({
  jellyfin: (() => ({
    authenticate: async (n: string) => { const u = Object.values(users).find((x: any) => x.name === n); return u ? { id: u.id, name: u.name, isAdmin: false } : null; },
    getUser: async (id: string) => users[id] ?? null,
    deleteDevices: async (id: string) => void devicesCleared.push(id),
    setPassword: async (id: string, p: string) => void passwordsSet.push([id, p]),
  })) as never,
});

beforeEach(async () => {
  sent = []; entries = []; devicesCleared = []; passwordsSet = [];
  for (const t of ["signins", "members", "sessions", "rate_limits", "audit", "own_auths"]) await run(env.DB, `DELETE FROM ${t}`);
  await run(env.DB, "INSERT INTO members (jellyfin_id, username, contact_email, email_verified) VALUES ('u1','maya','maya@example.com',1),('u2','ben','ben@example.com',0)");
  await run(env.DB, "UPDATE members SET alerts_email = 1 WHERE jellyfin_id = 'u1'"); // alerts are opt-in
});
const poll = () => pollActivity({ db: env.DB, jf: jfStub() as never, mailer, baseUrl: "https://jp.test", secret: "test-secret" });
const afterFirstPoll = () => run(env.DB, "INSERT INTO signins (source, jellyfin_id, device, ip, seen_at) VALUES ('activity','u1','Safari','1.1.1.1',?)", iso(60)); // the first poll only backfills
const rows = () => all<any>(env.DB, "SELECT * FROM signins ORDER BY id");

test("deviceLabel summarises browser and system", () => {
  expect(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15")).toBe("Safari on macOS");
  expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36 Edg/120")).toBe("Edge on Windows");
  expect(deviceLabel("")).toBe("Unknown device");
});

describe("portal sign-ins", () => {
  test("record Cloudflare's city and coordinates", async () => {
    await recordPortalSignin(env.DB, { jellyfinId: "u1", device: "Safari on macOS", ip: "1.2.3.4", cf: { city: "Leeds", latitude: "53.8", longitude: "-1.55" } });
    expect((await rows())[0]).toMatchObject({ source: "portal", city: "Leeds", lat: 53.8, lng: -1.55, ip: "1.2.3.4" });
  });
  test("a real sign-in through the API leaves a portal row", async () => {
    await app.request("/api/signin", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "5.6.7.8", "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17 Safari/605" }, body: JSON.stringify({ username: "maya", password: "x" }) }, env);
    expect((await rows())[0]).toMatchObject({ source: "portal", jellyfin_id: "u1", ip: "5.6.7.8", device: "Safari on macOS" });
  });
});

describe("parsing the Jellyfin activity log", () => {
  test("reads device and IP from an online entry", () => {
    expect(parseActivity(entry())).toMatchObject({ userId: "u1", device: "Safari", ip: "9.9.9.9" });
  });
  test("reads IPv6 addresses", () => {
    expect(parseActivity(entry({ overview: "IP address: 2a00:23c8::1" }))!.ip).toBe("2a00:23c8::1");
  });
  test("an entry without an IP still parses with an empty IP", () => {
    expect(parseActivity(entry({ overview: "" }))).toMatchObject({ device: "Safari", ip: "" });
  });
  test("the IP is taken only from the server-written fields, never from the device name", () => {
    expect(parseActivity(entry({ name: "maya is online from IP address: 1.1.1.1", overview: "" }))!.ip).toBe("");
  });
  test("text that is not an IP address is ignored", () => {
    expect(parseActivity(entry({ overview: "IP address: not-an-ip" }))!.ip).toBe("");
    expect(parseActivity(entry({ overview: "IP address: 999.1.1.1" }))!.ip).toBe("");
  });
  test("a device called Jellypass still parses; whether it is Jellypass's own session is decided against recorded authentications", () => {
    expect(parseActivity(entry({ name: "maya is online from Jellypass" }))).toMatchObject({ device: "Jellypass" });
  });
  test("unrelated entries and entries with no user are ignored", () => {
    expect(parseActivity(entry({ type: "PluginInstalled", name: "Plugin installed" }))).toBeNull();
    expect(parseActivity(entry({ userId: null }))).toBeNull();
  });
});

describe("Jellypass's own Jellyfin sessions", () => {
  const own = (id: string, minsAgo: number) => run(env.DB, "INSERT INTO own_auths (jellyfin_id, at) VALUES (?,?)", id, iso(minsAgo));
  const seed = async () => { await recordPortalSignin(env.DB, { jellyfinId: "u1", device: "Safari on macOS", ip: "1.1.1.1", cf: {} }); await afterFirstPoll(); };
  test("an entry called Jellypass that matches a recorded authentication moment is ignored", async () => {
    await seed(); await own("u1", 0.3);
    entries = [entry({ name: "maya is online from Jellypass", overview: "", date: iso(0.2) })];
    await poll();
    expect((await rows()).filter((r) => r.device === "Jellypass")).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });
  test("the same name WITHOUT a matching moment is a real sign-in: recorded, shown and alerted (a spoofed client name hides nothing)", async () => {
    await seed();
    entries = [entry({ name: "maya is online from Jellypass", overview: "IP address: 7.7.7.7", date: iso(0.2) })];
    await poll();
    expect((await rows()).filter((r) => r.device === "Jellypass")).toHaveLength(1);
    expect(sent).toHaveLength(1);
  });
  test("one recorded authentication hides exactly one entry, even if a second one arrives in the same moment", async () => {
    await seed(); await own("u1", 0.3);
    entries = [
      entry({ id: 1, name: "maya is online from Jellypass", overview: "", date: iso(0.25) }),
      entry({ id: 2, name: "maya is online from Jellypass", overview: "IP address: 7.7.7.7", date: iso(0.2) }),
    ];
    await poll();
    expect((await rows()).filter((r) => r.device === "Jellypass")).toHaveLength(1);
    expect(sent).toHaveLength(1);
  });
  test("a marker more than 30 seconds away from the entry does not match", async () => {
    await seed(); await own("u1", 2);
    entries = [entry({ name: "maya is online from Jellypass", overview: "IP address: 7.7.7.7", date: iso(1) })];
    await poll();
    expect((await rows()).filter((r) => r.device === "Jellypass")).toHaveLength(1);
  });
  test("a marker for another member, or from long ago, suppresses nothing", async () => {
    await seed(); await own("u2", 0.3); await own("u1", 30);
    entries = [entry({ name: "maya is online from Jellypass", overview: "IP address: 7.7.7.7", date: iso(0.2) })];
    await poll();
    expect((await rows()).filter((r) => r.device === "Jellypass")).toHaveLength(1);
  });
  test("the member's own list shows such a row, because nothing is hidden by name", async () => {
    await run(env.DB, "INSERT INTO signins (source, jellyfin_id, device, ip, seen_at) VALUES ('activity','u1','Jellypass','',?)", iso(5));
    const r = await app.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "maya", password: "x" }) }, env);
    const body = (await (await app.request("/api/signins", { headers: { cookie: r.headers.get("set-cookie")!.split(";")[0] } }, env)).json()) as any[];
    expect(body.map((x) => x.device)).toContain("Jellypass");
  });
  test("a portal sign-in records the authentication moment", async () => {
    await app.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "maya", password: "x" }) }, env);
    expect(await first(env.DB, "SELECT jellyfin_id FROM own_auths")).toEqual({ jellyfin_id: "u1" });
  });
});

describe("polling", () => {
  test("polling twice does not duplicate rows, even with no IP", async () => {
    entries = [entry({ id: 1 }), entry({ id: 2, overview: "", date: iso(2) })];
    await poll(); await poll();
    expect(await rows()).toHaveLength(2);
  });
  test("an IP already seen in a portal sign-in gets that city; an unseen one gets none", async () => {
    await recordPortalSignin(env.DB, { jellyfinId: "u1", device: "Safari on macOS", ip: "9.9.9.9", cf: { city: "Leeds", latitude: "53.8", longitude: "-1.55" } });
    entries = [entry({ id: 1 }), entry({ id: 2, overview: "IP address: 7.7.7.7", date: iso(0) })];
    await poll();
    const a = (await rows()).filter((r) => r.source === "activity");
    expect(a.find((r) => r.ip === "9.9.9.9")).toMatchObject({ city: "Leeds", lat: 53.8 });
    expect(a.find((r) => r.ip === "7.7.7.7")).toMatchObject({ city: null });
    expect(await cityForIp(env.DB, "7.7.7.7")).toBeNull();
  });
  test("an unseen IP for a member with history sends a new sign-in alert even without a city", async () => {
    await recordPortalSignin(env.DB, { jellyfinId: "u1", device: "Safari on macOS", ip: "1.1.1.1", cf: {} });
    await afterFirstPoll();
    entries = [entry({ overview: "IP address: 7.7.7.7" })];
    await poll();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "maya@example.com", subject: "New sign-in to your account" });
    expect(sent[0].text).toContain("an unknown location");
    expect(sent[0].text).toContain("https://jp.test/secure/u1.");
  });
  test("a member who switched alerts off gets no new sign-in email (the sign-in is still recorded)", async () => {
    await run(env.DB, "UPDATE members SET alerts_email = 0 WHERE jellyfin_id = 'u1'");
    await recordPortalSignin(env.DB, { jellyfinId: "u1", device: "Safari on macOS", ip: "1.1.1.1", cf: {} });
    await afterFirstPoll();
    entries = [entry({ overview: "IP address: 7.7.7.7" })];
    await poll();
    expect(sent).toHaveLength(0);
    expect((await all<any>(env.DB, "SELECT ip FROM signins WHERE jellyfin_id = 'u1'")).map((r) => r.ip)).toContain("7.7.7.7");
  });
  test("an entry with no usable IP still alerts a member with history (fail closed)", async () => {
    await recordPortalSignin(env.DB, { jellyfinId: "u1", device: "Safari on macOS", ip: "1.1.1.1", cf: {} });
    await afterFirstPoll();
    entries = [entry({ overview: "" })];
    await poll();
    expect(sent).toHaveLength(1);
  });
  test("a portal sign-in from a new IP alerts, and that IP is then known to the poller", async () => {
    const base = { jellyfinId: "u1", device: "Safari on macOS" };
    const check = (ip: string, city: string) => checkPortalSignin({ db: env.DB, mailer, baseUrl: "https://jp.test", secret: "test-secret" }, { ...base, ip, cf: { city } });
    await check("1.1.1.1", "Leeds"); expect(sent).toHaveLength(0);   // first ever
    await check("1.1.1.1", "Leeds"); expect(sent).toHaveLength(0);   // known place
    await check("2.2.2.2", "Leeds"); expect(sent).toHaveLength(0);   // new IP, same city: phone moved from wifi to mobile data, no alert
    await check("6.6.6.6", "Paris"); expect(sent).toHaveLength(1);   // new city
    expect(sent[0].text).toContain("Paris");
    expect((await rows()).filter((r) => r.unusual === 1)).toHaveLength(1); // flagged for the banner and the admin digest too
    entries = [entry({ overview: "IP address: 6.6.6.6" })]; await poll();
    expect(sent).toHaveLength(1);
  });
  test("a late entry (poller or Jellyfin was down) still alerts, but the very first poll never alerts on backfilled history", async () => {
    await recordPortalSignin(env.DB, { jellyfinId: "u1", device: "Safari on macOS", ip: "1.1.1.1", cf: {} });
    entries = [entry({ id: 1, overview: "IP address: 4.4.4.4", date: iso(600) })]; await poll();   // first poll: backfill, silent
    expect(sent).toHaveLength(0);
    entries = [entry({ id: 2, overview: "IP address: 5.5.5.5", date: iso(120) })]; await poll();   // later poll, old entry: still reported
    expect(sent).toHaveLength(1);
  });
  test("no alert for a first-ever sign-in, a repeat IP, or an unverified address", async () => {
    entries = [entry({ id: 1 })]; await poll();                       // first ever
    entries = [entry({ id: 2, date: iso(0) })]; await poll();         // same IP again
    await recordPortalSignin(env.DB, { jellyfinId: "u1", device: "x", ip: "1.1.1.1", cf: {} });
    await recordPortalSignin(env.DB, { jellyfinId: "u2", device: "x", ip: "2.2.2.2", cf: {} });
    entries = [entry({ id: 4, userId: "u2", overview: "IP address: 3.3.3.3" })]; await poll();   // unverified email
    expect(sent).toHaveLength(0);
  });
});

describe("member API", () => {
  async function login(name = "maya") {
    const r = await app.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: name, password: "x" }) }, env);
    return { cookie: r.headers.get("set-cookie")!.split(";")[0], "x-csrf-token": ((await r.json()) as any).csrf as string };
  }
  test("'this wasn't me' signs out everywhere and rotates the Jellyfin password so the old one stops working", async () => {
    const a = await login();
    const id = (await first<any>(env.DB, "SELECT id FROM signins WHERE jellyfin_id = 'u1'"))!.id;
    const res = await app.request(`/api/signins/${id}/not-me`, { method: "POST", headers: a }, env);
    expect(res.status).toBe(200);
    expect(devicesCleared).toEqual(["u1"]);
    expect(passwordsSet).toHaveLength(1);
    expect(passwordsSet[0][1]).toMatch(/^[0-9a-f]{48}$/);
    expect(await first(env.DB, "SELECT id FROM sessions")).toBeNull();
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'signin.not_me'")).not.toBeNull();
  });
  test("another member's sign-in cannot be flagged", async () => {
    await recordPortalSignin(env.DB, { jellyfinId: "u2", device: "Other", ip: "8.8.8.8", cf: {} });
    const other = (await first<any>(env.DB, "SELECT id FROM signins WHERE jellyfin_id = 'u2'"))!.id;
    const a = await login();
    expect((await app.request(`/api/signins/${other}/not-me`, { method: "POST", headers: a }, env)).status).toBe(404);
    expect(devicesCleared).toHaveLength(0);
  });
});

describe("map tiles", () => {
  const bytes = new Uint8Array(100).map((_, i) => i);
  beforeEach(async () => { await env.TILES.put("uk.pmtiles", bytes); });
  const get = async (path: string, headers: Record<string, string> = {}, authed = true) => {
    const a = authed ? await (async () => { const r = await app.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "maya", password: "x" }) }, env); return r.headers.get("set-cookie")!.split(";")[0]; })() : "";
    return app.request(path, { headers: { cookie: a, ...headers } }, env);
  };
  test("serves a byte range with 206 and Content-Range", async () => {
    const res = await get("/tiles/uk.pmtiles", { range: "bytes=10-19" });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 10-19/100");
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });
  test("serves the whole file without a range", async () => {
    const res = await get("/tiles/uk.pmtiles");
    expect(res.status).toBe(200);
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect((await res.arrayBuffer()).byteLength).toBe(100);
  });
  test("404 for missing or oddly named files; 401 without a session", async () => {
    expect((await get("/tiles/nope.pmtiles")).status).toBe(404);
    expect((await get("/tiles/..%2Fsecret")).status).toBe(404);
    expect((await get("/tiles/uk.pmtiles", {}, false)).status).toBe(401);
  });
});
