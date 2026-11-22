import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { makeAsn, makeGeo } from "../src/geoip";
import { makeTracearr } from "../src/tracearr";
import { all, first, run } from "../src/db";
import type { Env } from "../src/env";
import { CITY_TEST_MMDB_B64 } from "./fixtures/city-test-mmdb";
import { ASN_TEST_MMDB_B64 } from "./fixtures/asn-test-mmdb";

type U = { id: string; name: string; isAdmin: boolean; isDisabled: boolean };
let sessionsDown = false;
let mayaIp = "81.1.2.3"; let mayaJfDevice = "Living room TV";
let users: U[], policies: Array<[string, any]>, devices: string[], deletedJf: string[], deletedSeerr: number[], terminated: Array<[string, any]>, streamsDown: boolean;
const jfMessages: Array<[string, string]> = [];
const jf = () => ({
  authenticate: async (n: string) => { const u = users.find((x) => x.name === n); return u ? { id: u.id, name: u.name, isAdmin: u.isAdmin } : null; },
  getUser: async (id: string) => users.find((u) => u.id === id) ?? null,
  listUsers: async () => users,
  libraries: async () => [{ id: "f1", name: "Films" }],
  sessions: async () => { if (sessionsDown) throw new Error("down"); return [{ userName: "maya", deviceName: mayaJfDevice, remoteIp: mayaIp, id: "jfs1", itemId: "item1" }, { userName: "Olivia", deviceName: "Browser", remoteIp: "9.9.9.9" }]; },
  setPolicy: async (id: string, p: any) => { policies.push([id, p]); const u = users.find((x) => x.id === id)!; if ("IsDisabled" in p) u.isDisabled = p.IsDisabled; },
  deleteDevices: async (id: string) => void devices.push(id),
  deleteUser: async (id: string) => { deletedJf.push(id); users = users.filter((u) => u.id !== id); },
  sendMessage: async (sid: string, text: string) => void jfMessages.push([sid, text]),
});
let seerrPerms: Array<[number, string]> = [];
const seerr = () => ({ deleteUser: async (id: number) => void deletedSeerr.push(id), setPermissions: async (id: number, r: string) => void seerrPerms.push([id, r]) });
const tracearr = () => ({
  liveStreams: async () => { if (streamsDown) throw new Error("down"); return [{ id: "s1", username: "maya", title: "Heat", device: "Living room TV", state: "playing" }]; },
  terminate: async (id: string, msg?: string) => { if (streamsDown) throw new Error("down"); terminated.push([id, msg]); },
});
const app = createApp({ geo: () => makeGeo(env.TILES), asn: () => makeAsn(env.TILES), jellyfin: jf as never, seerr: seerr as never, tracearr: tracearr as never });
const j = (body: unknown, h: Record<string, string> = {}) => ({ method: "POST", headers: { "content-type": "application/json", ...h }, body: JSON.stringify(body) });
async function login(name: string) {
  const r = await app.request("/api/signin", j({ username: name, password: "x" }), env);
  return { cookie: r.headers.get("set-cookie")!.split(";")[0], "x-csrf-token": ((await r.json()) as any).csrf as string };
}
const get = (a: any, path: string) => app.request(path, { headers: { cookie: a.cookie } }, env);
const send = (a: any, method: string, path: string, body?: unknown) => app.request(path, { method, headers: { "content-type": "application/json", ...a }, body: body === undefined ? undefined : JSON.stringify(body) }, env);
const days = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();

beforeEach(async () => {
  users = [
    { id: "a1", name: "olivia", isAdmin: true, isDisabled: false },
    { id: "u1", name: "maya", isAdmin: false, isDisabled: false },
    { id: "u2", name: "ben", isAdmin: false, isDisabled: false },
    { id: "u3", name: "zed", isAdmin: false, isDisabled: true },
    { id: "a2", name: "otheradmin", isAdmin: true, isDisabled: false },
  ];
  seerrPerms = []; sessionsDown = false; mayaIp = "81.1.2.3"; mayaJfDevice = "Living room TV"; policies = []; devices = []; deletedJf = []; deletedSeerr = []; terminated = []; streamsDown = false;
  for (const t of ["members", "sessions", "rate_limits", "audit", "announcements", "signins", "settings", "help_messages"]) await run(env.DB, `DELETE FROM ${t}`);
  await run(env.DB, "INSERT INTO members (jellyfin_id, username, contact_email, email_verified, expires_at, preset_id, seerr_user_id) VALUES ('u1','maya','m@example.com',1,?, 'preset-standard', 5),('u2','ben',NULL,0,?, 'preset-guest', NULL)", days(30), days(-2));
});

describe("access", () => {
  test("a member is refused everywhere under /api/admin", async () => {
    const a = await login("maya");
    for (const p of ["/api/admin/users", "/api/admin/streams", "/api/admin/audit", "/api/admin/settings", "/api/admin/messages"]) expect((await get(a, p)).status, p).toBe(403);
  });
});

describe("users", () => {
  test("lists Jellyfin users with their Jellypass details, and filters", async () => {
    const a = await login("olivia");
    const all_ = (await (await get(a, "/api/admin/users")).json()) as any[];
    expect(all_.find((u) => u.name === "maya")).toMatchObject({ id: "u1", presetName: "Standard", contactEmail: "m@example.com", emailVerified: true });
    expect(((await (await get(a, "/api/admin/users?search=BE")).json()) as any[]).map((u) => u.name)).toEqual(["ben"]);
    expect(((await (await get(a, "/api/admin/users?filter=expired")).json()) as any[]).map((u) => u.name)).toEqual(["ben"]);
    expect(((await (await get(a, "/api/admin/users?filter=disabled")).json()) as any[]).map((u) => u.name)).toEqual(["zed"]);
    expect(((await (await get(a, "/api/admin/users?filter=admins")).json()) as any[]).map((u) => u.name).sort()).toEqual(["olivia", "otheradmin"]);
  });
  test("disable locks the account, signs it out everywhere and is audited; enable undoes it", async () => {
    const a = await login("olivia");
    await run(env.DB, "INSERT INTO sessions (id, jellyfin_id, username, is_admin, expires_at, checked_at, csrf) VALUES ('s','u1','maya',0,'2999-01-01','2999-01-01','c')");
    expect((await send(a, "POST", "/api/admin/users/u1/disable")).status).toBe(200);
    expect(policies).toContainEqual(["u1", { IsDisabled: true }]);
    expect(devices).toEqual(["u1"]);
    expect(await first(env.DB, "SELECT id FROM sessions WHERE jellyfin_id = 'u1'")).toBeNull();
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'user.disable' AND target = 'u1'")).not.toBeNull();
    await send(a, "POST", "/api/admin/users/u1/enable");
    expect(policies.at(-1)).toEqual(["u1", { IsDisabled: false }]);
  });
  test("an admin cannot disable or delete themselves or another admin", async () => {
    const a = await login("olivia");
    expect((await send(a, "POST", "/api/admin/users/a1/disable")).status).toBe(400);
    expect((await send(a, "POST", "/api/admin/users/a2/disable")).status).toBe(400);
    expect((await send(a, "DELETE", "/api/admin/users/a2", { confirm: "otheradmin" })).status).toBe(400);
  });
  test("end-date sets an exact end for a member with none, rejects the past, bad dates and admins, and re-arms expiry", async () => {
    const a = await login("olivia");
    await send(a, "POST", "/api/admin/users/u1/indefinite");
    await run(env.DB, "UPDATE members SET expiry_done = 1 WHERE jellyfin_id = 'u1'");
    expect((await send(a, "POST", "/api/admin/users/u1/end-date", { date: "2099-03-04" })).status).toBe(200);
    expect(await first(env.DB, "SELECT expires_at AS e, expiry_done AS d FROM members WHERE jellyfin_id = 'u1'")).toEqual({ e: "2099-03-04T23:59:59.000Z", d: 0 });
    expect((await send(a, "POST", "/api/admin/users/u1/end-date", { date: "2020-01-01" })).status).toBe(400);
    expect((await send(a, "POST", "/api/admin/users/u1/end-date", { date: "soon" })).status).toBe(400);
    expect((await send(a, "POST", "/api/admin/users/a2/end-date", { date: "2099-03-04" })).status).toBe(400);
  });
  test("extend adds days to the later of now and the current end, and re-enables an expired account", async () => {
    const a = await login("olivia");
    await send(a, "POST", "/api/admin/users/u1/extend", { days: 10 });
    const m1 = (await first<any>(env.DB, "SELECT expires_at FROM members WHERE jellyfin_id = 'u1'"))!;
    expect(Math.round((Date.parse(m1.expires_at) - Date.now()) / 86400_000)).toBe(40);
    await run(env.DB, "UPDATE members SET expiry_done = 1 WHERE jellyfin_id = 'u1'");
    await send(a, "POST", "/api/admin/users/u1/extend", { days: 1 });
    expect(await first(env.DB, "SELECT expiry_done AS d FROM members WHERE jellyfin_id = 'u1'")).toEqual({ d: 0 }); // extending re-arms expiry
    await send(a, "POST", "/api/admin/users/u2/extend", { days: 10 }); // expired 2 days ago → now + 10
    const m2 = (await first<any>(env.DB, "SELECT expires_at FROM members WHERE jellyfin_id = 'u2'"))!;
    expect(Math.round((Date.parse(m2.expires_at) - Date.now()) / 86400_000)).toBe(10);
    users.find((u) => u.id === "u3")!.isDisabled = true;
    await run(env.DB, "INSERT INTO members (jellyfin_id, username, expires_at) VALUES ('u3','zed',?)", days(-1));
    await send(a, "POST", "/api/admin/users/u3/extend", { days: 5 });
    expect(policies).toContainEqual(["u3", { IsDisabled: false }]);
    expect((await send(a, "POST", "/api/admin/users/u1/extend", { days: 0 })).status).toBe(400);
    expect((await send(a, "POST", "/api/admin/users/u1/extend", { days: 9999 })).status).toBe(400);
  });
  test("no end date clears an expiry, re-enables an expired account, works in bulk for never-visited users, and leaves admins alone", async () => {
    const a = await login("olivia");
    await run(env.DB, "INSERT OR REPLACE INTO members (jellyfin_id, username, expires_at, expiry_done) VALUES ('u3','zed',?,1)", days(-1));
    users.find((u) => u.id === "u3")!.isDisabled = true;
    expect((await send(a, "POST", "/api/admin/users/u3/indefinite")).status).toBe(200);
    expect(await first(env.DB, "SELECT expires_at, expiry_done FROM members WHERE jellyfin_id = 'u3'")).toEqual({ expires_at: null, expiry_done: 0 });
    expect(policies).toContainEqual(["u3", { IsDisabled: false }]);
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'user.indefinite'")).not.toBeNull();
    // bulk, including a user who has never used Jellypass (no row yet) and an admin
    await run(env.DB, "UPDATE members SET expires_at = ? WHERE jellyfin_id = 'u1'", days(10));
    const r = await send(a, "POST", "/api/admin/users/bulk", { action: "indefinite", ids: ["u1", "u2", "a1"] });
    expect(r.status).toBe(200);
    expect(((await r.json()) as any).results.every((x: any) => x.ok)).toBe(true);
    expect(await first(env.DB, "SELECT expires_at FROM members WHERE jellyfin_id = 'u1'")).toEqual({ expires_at: null });
    expect(await first(env.DB, "SELECT expires_at FROM members WHERE jellyfin_id = 'u2'")).toEqual({ expires_at: null });
    expect((await send(await login("maya"), "POST", "/api/admin/users/u1/indefinite")).status).toBe(403);
  });
  test("delete needs the username typed back and removes Jellyfin, Jellypass and Seerr records", async () => {
    const a = await login("olivia");
    expect((await send(a, "DELETE", "/api/admin/users/u1", { confirm: "wrong" })).status).toBe(400);
    expect(deletedJf).toHaveLength(0);
    expect((await send(a, "DELETE", "/api/admin/users/u1", { confirm: "maya" })).status).toBe(200);
    expect(deletedJf).toEqual(["u1"]);
    expect(deletedSeerr).toEqual([5]);
    expect(await first(env.DB, "SELECT * FROM members WHERE jellyfin_id = 'u1'")).toBeNull();
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'user.delete'")).not.toBeNull();
  });
  test("bulk actions report each user, including ones that fail", async () => {
    const a = await login("olivia");
    const res = (await (await send(a, "POST", "/api/admin/users/bulk", { action: "disable", ids: ["u1", "a1", "nobody"] })).json()) as any;
    expect(res.results).toEqual([{ id: "u1", ok: true }, { id: "a1", ok: false, error: expect.any(String) }, { id: "nobody", ok: false, error: expect.any(String) }]);
    expect((await send(a, "POST", "/api/admin/users/bulk", { action: "delete", ids: ["u1"] })).status).toBe(400);
    expect((await send(a, "POST", "/api/admin/users/bulk", { action: "disable", ids: Array.from({ length: 101 }, (_, i) => `x${i}`) })).status).toBe(400);
  });
});

describe("libraries", () => {
  test("admins can list Jellyfin libraries for the preset editor; members cannot", async () => {
    expect(await (await get(await login("olivia"), "/api/admin/libraries")).json()).toEqual([{ id: "f1", name: "Films" }]);
    expect((await get(await login("maya"), "/api/admin/libraries")).status).toBe(403);
  });
});

describe("assigning an access level", () => {
  test("sets the preset, pushes its Jellyfin policy and Seerr rights, and is audited", async () => {
    const a = await login("olivia");
    expect((await send(a, "POST", "/api/admin/users/u1/preset", { presetId: "preset-family" })).status).toBe(200);
    expect(await first(env.DB, "SELECT preset_id FROM members WHERE jellyfin_id = 'u1'")).toEqual({ preset_id: "preset-family" });
    expect(policies.at(-1)).toEqual(["u1", expect.objectContaining({ EnableAllFolders: true, RemoteClientBitrateLimit: 0 })]);
    expect(seerrPerms).toEqual([[5, "auto"]]);
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'user.preset'")).not.toBeNull();
  });
  test("works for an existing Jellyfin user with no Jellypass row yet, and refuses unknown presets or users", async () => {
    const a = await login("olivia");
    expect((await send(a, "POST", "/api/admin/users/u3/preset", { presetId: "preset-guest" })).status).toBe(200);
    expect(await first(env.DB, "SELECT preset_id FROM members WHERE jellyfin_id = 'u3'")).toEqual({ preset_id: "preset-guest" });
    expect((await send(a, "POST", "/api/admin/users/u1/preset", { presetId: "nope" })).status).toBe(400);
    expect((await send(a, "POST", "/api/admin/users/ghost/preset", { presetId: "preset-guest" })).status).toBe(404);
  });
});

describe("admins are protected from member-level changes", () => {
  test("an access level cannot be assigned to an admin, and nothing is pushed to Jellyfin or Seerr", async () => {
    const a = await login("olivia");
    await run(env.DB, "INSERT INTO members (jellyfin_id, username, seerr_user_id) VALUES ('a2','otheradmin',3)");
    expect((await send(a, "POST", "/api/admin/users/a2/preset", { presetId: "preset-guest" })).status).toBe(400);
    expect((await send(a, "POST", "/api/admin/users/a1/preset", { presetId: "preset-guest" })).status).toBe(400);
    expect(policies).toHaveLength(0);
    expect(seerrPerms).toHaveLength(0);
  });
  test("an admin cannot be given an expiry", async () => {
    const a = await login("olivia");
    expect((await send(a, "POST", "/api/admin/users/a2/extend", { days: 30 })).status).toBe(400);
    expect(await first(env.DB, "SELECT * FROM members WHERE jellyfin_id = 'a2'")).toBeNull();
  });
});

describe("live stream locations", () => {
  const stream = async () => ((await (await get(await login("olivia"), "/api/admin/streams")).json()) as any).streams[0];
  test("shows the poster of what is playing, loaded from Jellyfin", async () => {
    expect(await stream()).toMatchObject({ posterUrl: "https://jf.test/Items/item1/Images/Primary?maxHeight=300" });
  });
  test("still finds the address when Jellyfin names the device differently from Tracearr", async () => {
    mayaJfDevice = "Maya's Living room TV";
    expect(await stream()).toMatchObject({ ip: "81.1.2.3" });
  });
  test("falls back to the local GeoIP database when no portal sign-in has seen the IP", async () => {
    await env.TILES.put("geoip-city.mmdb", Uint8Array.from(atob(CITY_TEST_MMDB_B64), (c) => c.charCodeAt(0)));
    mayaIp = "81.2.69.142";
    expect(await stream()).toMatchObject({ ip: "81.2.69.142", city: "London" });
  });
  test("a country-only database (or record) shows the country instead of nothing", async () => {
    await env.TILES.put("geoip-city.mmdb", Uint8Array.from(atob(CITY_TEST_MMDB_B64), (c) => c.charCodeAt(0)));
    mayaIp = "2a02:ff80::1"; // a test-database record with a country but no city
    expect(await stream()).toMatchObject({ ip: "2a02:ff80::1", city: "Germany" });
  });
  test("a city already seen at a portal sign-in wins", async () => {
    await env.TILES.put("geoip-city.mmdb", Uint8Array.from(atob(CITY_TEST_MMDB_B64), (c) => c.charCodeAt(0)));
    mayaIp = "81.2.69.142";
    await run(env.DB, "INSERT INTO signins (source, jellyfin_id, device, ip, city, lat, lng, seen_at) VALUES ('portal','u1','x','81.2.69.142','Leeds',53.8,-1.5,?)", new Date().toISOString());
    expect((await stream()).city).toBe("Leeds");
  });
  test("shows the ISP (network) from the local ASN database; none when the file or the address is missing", async () => {
    await env.TILES.put("geoip-asn.mmdb", Uint8Array.from(atob(ASN_TEST_MMDB_B64), (c) => c.charCodeAt(0)));
    mayaIp = "1.128.0.1";
    expect(await stream()).toMatchObject({ ip: "1.128.0.1", isp: "Telstra Pty Ltd" });
    mayaIp = "81.2.69.142";
    expect((await stream()).isp).toBeNull();
    await env.TILES.delete("geoip-asn.mmdb");
    mayaIp = "1.128.0.1";
    expect((await stream()).isp).toBeNull();
  });
  test("no database means no city, not an error", async () => {
    await env.TILES.delete("geoip-city.mmdb");
    mayaIp = "81.2.69.142";
    expect(await stream()).toMatchObject({ ip: "81.2.69.142", city: null });
  });
});

describe("live stream messages", () => {
  test("sends an on-screen message without stopping the stream, admins only, and audits it", async () => {
    jfMessages.length = 0;
    const a = await login("olivia");
    expect((await send(a, "POST", "/api/admin/streams/s1/message", { message: "Back in 5" })).status).toBe(200);
    expect(jfMessages).toEqual([["jfs1", "Back in 5"]]);
    expect(terminated).toEqual([]);
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'stream.message'")).not.toBeNull();
    expect((await send(a, "POST", "/api/admin/streams/s1/message", { message: "  " })).status).toBe(400);
    expect((await send(await login("maya"), "POST", "/api/admin/streams/s1/message", { message: "hi" })).status).toBe(403);
  });
});
describe("live streams (Tracearr)", () => {
  test("lists streams and stops one, for admins only", async () => {
    const a = await login("olivia");
    expect(((await (await get(a, "/api/admin/streams")).json()) as any).streams[0]).toMatchObject({ id: "s1", username: "maya", title: "Heat" });
    expect((await send(a, "POST", "/api/admin/streams/s1/terminate", { message: "Maintenance" })).status).toBe(200);
    expect(terminated).toEqual([["s1", "Maintenance"]]);
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'stream.terminate'")).not.toBeNull();
    const m = await login("maya");
    expect((await send(m, "POST", "/api/admin/streams/s1/terminate")).status).toBe(403);
  });
  test("streams show the viewer's IP from Jellyfin's live sessions, and the city only if that IP was seen in a portal sign-in", async () => {
    await run(env.DB, "INSERT INTO signins (source, jellyfin_id, device, ip, city, lat, lng, seen_at) VALUES ('portal','u1','Safari','81.1.2.3','Uppingham',52.6,-0.7,'2026-11-14T10:00:00Z')");
    const a = await login("olivia");
    const body = (await (await get(a, "/api/admin/streams")).json()) as any;
    expect(body.streams[0]).toMatchObject({ id: "s1", username: "maya", device: "Living room TV", ip: "81.1.2.3", city: "Uppingham", lat: 52.6, lng: -0.7 });
  });
  test("an IP with no recorded city is shown without a location, and a stream with no matching session has neither", async () => {
    const a = await login("olivia");
    const b1 = (await (await get(a, "/api/admin/streams")).json()) as any;
    expect(b1.streams[0]).toMatchObject({ ip: "81.1.2.3", city: null });
    users = users; // streams fake always returns maya on 'Living room TV'; make the session list not match
    sessionsDown = true;
    const b2 = (await (await get(a, "/api/admin/streams")).json()) as any;
    expect(b2.streams[0]).toMatchObject({ ip: null, city: null }); // Jellyfin down: streams still listed
  });
  test("a malformed stream id is refused", async () => {
    const a = await login("olivia");
    expect((await send(a, "POST", "/api/admin/streams/..%2Fx/terminate")).status).toBe(400);
  });
  test("Tracearr being down gives a degraded notice, not an error page", async () => {
    streamsDown = true;
    const a = await login("olivia");
    const res = await get(a, "/api/admin/streams");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ streams: [], degraded: true });
    expect((await send(a, "POST", "/api/admin/streams/s1/terminate")).status).toBe(503);
  });
  test("the client maps Tracearr's real stream fields: title, episode, device, progress, transcode", async () => {
    const raw = { id: "s9", username: "Olivia", media_title: "The Wedding of River Song", show_title: "Doctor Who", season_number: 6, episode_number: 13, media_type: "episode", year: 2011, state: "paused", progress_ms: 1_800_000, duration_ms: 2_700_000, device: "Browser", player: "Chrome", product: "Jellyfin Web", is_transcode: true, resolution: "1080p", started_at: "2026-11-14T15:00:00Z" };
    const film = { id: "s10", username: "Maya", media_title: "Heat", show_title: null, season_number: null, episode_number: null, media_type: "movie", year: 1995, state: "playing", progress_ms: 0, duration_ms: 0, device: null, player: "Apple TV", is_transcode: false };
    const t = makeTracearr({ ...env, TRACEARR_URL: "https://t.test", TRACEARR_TOKEN: "x", CF_ACCESS_CLIENT_ID: "i", CF_ACCESS_CLIENT_SECRET: "s" } as Env, (async () => new Response(JSON.stringify({ data: [raw, film] }))) as never);
    expect(await t.liveStreams()).toEqual([
      { id: "s9", username: "Olivia", title: "Doctor Who", subtitle: "S6E13 · The Wedding of River Song", device: "Browser", state: "paused", progressPct: 67, durationMinutes: 45, remainingMinutes: 15, transcoding: true, resolution: "1080p", startedAt: "2026-11-14T15:00:00Z" },
      { id: "s10", username: "Maya", title: "Heat", subtitle: "1995", device: "Apple TV", state: "playing", progressPct: null, durationMinutes: null, remainingMinutes: null, transcoding: false, resolution: null, startedAt: null },
    ]);
  });
  test("the client sends the bearer token and both Access service-token headers", async () => {
    let seen: Headers | undefined; let url = "";
    const t = makeTracearr({ ...env, TRACEARR_URL: "https://t.test/", TRACEARR_TOKEN: "trr_pub_x", CF_ACCESS_CLIENT_ID: "id", CF_ACCESS_CLIENT_SECRET: "sec" } as Env, (async (u: string, init: RequestInit) => { url = u; seen = new Headers(init.headers); return new Response(JSON.stringify({ data: [] })); }) as never);
    await t.liveStreams();
    expect(url).toBe("https://t.test/api/v2/public/streams");
    expect(seen!.get("authorization")).toBe("Bearer trr_pub_x");
    expect(seen!.get("cf-access-client-id")).toBe("id");
    expect(seen!.get("cf-access-client-secret")).toBe("sec");
  });
});

describe("announcements", () => {
  test("admins post and remove; members see only active ones", async () => {
    const a = await login("olivia"), m = await login("maya");
    const created = (await (await send(a, "POST", "/api/admin/announcements", { title: "Maintenance", body: "Sunday 2am", kind: "info" })).json()) as any;
    expect(((await (await get(m, "/api/announcements")).json()) as any[]).map((x) => x.title)).toEqual(["Maintenance"]);
    await send(a, "DELETE", `/api/admin/announcements/${created.id}`);
    expect((await (await get(m, "/api/announcements")).json()) as any[]).toEqual([]);
    expect((await send(m, "POST", "/api/admin/announcements", { title: "x", body: "y" })).status).toBe(403);
  });
  test("empty or oversized text and unknown kinds are refused", async () => {
    const a = await login("olivia");
    for (const bad of [{ title: "", body: "x" }, { title: "x", body: "" }, { title: "x".repeat(121), body: "y" }, { title: "x", body: "y".repeat(2001) }, { title: "x", body: "y", kind: "bogus" }]) expect((await send(a, "POST", "/api/admin/announcements", bad)).status).toBe(400);
  });
});

describe("audit log and settings", () => {
  test("the audit log is newest first and limited", async () => {
    const a = await login("olivia");
    for (let i = 0; i < 5; i++) await run(env.DB, "INSERT INTO audit (actor, action) VALUES ('x', ?)", `a${i}`);
    const rows = (await (await get(a, "/api/admin/audit?limit=3")).json()) as any[];
    expect(rows).toHaveLength(3);
    expect(rows[0].id).toBeGreaterThan(rows[1].id);
  });
  test("an entry about a member's id also carries the member's name", async () => {
    const a = await login("olivia");
    await run(env.DB, "INSERT INTO members (jellyfin_id, username) VALUES ('m-1','maya')");
    await run(env.DB, "INSERT INTO audit (actor, action, target) VALUES ('olivia','user.extend','m-1'), ('olivia','invite.create','not-a-member')");
    const rows = (await (await get(a, "/api/admin/audit?limit=2")).json()) as any[];
    expect(rows.find((r) => r.target === "m-1").target_name).toBe("maya");
    expect(rows.find((r) => r.target === "not-a-member").target_name).toBeNull();
  });
  test("the outage-email setting is stored and validated", async () => {
    const a = await login("olivia");
    expect(await (await get(a, "/api/admin/settings")).json()).toEqual({ outageEmail: false });
    expect((await send(a, "PUT", "/api/admin/settings", { outageEmail: true })).status).toBe(200);
    expect(await (await get(a, "/api/admin/settings")).json()).toEqual({ outageEmail: true });
    expect((await send(a, "PUT", "/api/admin/settings", { outageEmail: "yes" })).status).toBe(400);
  });
});

describe("help messages", () => {
  test("a member can message the admins, with server-built diagnostics only if they ticked the box", async () => {
    const m = await login("maya");
    await run(env.DB, "INSERT INTO signins (source, jellyfin_id, device, ip, seen_at) VALUES ('portal','u1','Safari on macOS','9.9.9.9','2026-11-14T10:00:00Z')");
    expect((await send(m, "POST", "/api/help/message", { subject: "No sound", body: "TV has no audio", diagnostics: true })).status).toBe(201);
    expect((await send(m, "POST", "/api/help/message", { subject: "Other", body: "Hi", diagnostics: false })).status).toBe(201);
    const a = await login("olivia");
    const msgs = (await (await get(a, "/api/admin/messages")).json()) as any[];
    const withDiag = msgs.find((x) => x.subject === "No sound");
    expect(withDiag).toMatchObject({ username: "maya", resolved: false });
    expect(withDiag.diagnostics).toContain("Safari on macOS");
    expect(withDiag.diagnostics).not.toContain("9.9.9.9");
    expect(msgs.find((x) => x.subject === "Other").diagnostics).toBeNull();
    expect((await send(a, "POST", `/api/admin/messages/${withDiag.id}/resolve`)).status).toBe(200);
  });
  test("it is rate limited and length limited", async () => {
    const m = await login("maya");
    expect((await send(m, "POST", "/api/help/message", { subject: "", body: "x" })).status).toBe(400);
    expect((await send(m, "POST", "/api/help/message", { subject: "s", body: "x".repeat(4001) })).status).toBe(400);
    for (let i = 0; i < 5; i++) await send(m, "POST", "/api/help/message", { subject: "s", body: "b" });
    expect((await send(m, "POST", "/api/help/message", { subject: "s", body: "b" })).status).toBe(429);
  });
});

describe("404 and maintenance mode", () => {
  test("unknown pages get the 404 page; unknown API paths get JSON", async () => {
    const page = await app.request("/no/such/page", {}, env);
    expect(page.status).toBe(404);
    const html404 = await page.text();
    expect(html404).toContain("A spaceship has stolen this page");
    expect(html404).toContain('id="poster-wall"');
    expect(html404).toContain('/assets/wall.js'); // the wall needs both its container and its script
    const api = await app.request("/api/no-such", {}, env);
    expect(api.status).toBe(404);
    expect(await api.json()).toEqual({ error: "not found" });
  });
  test("maintenance blocks members and visitors with 503 but lets admins and sign-in through, and is audited", async () => {
    const a = await login("olivia"), m = await login("maya");
    expect(await (await get(a, "/api/admin/maintenance")).json()).toEqual({ enabled: false, message: "", startsAt: null, endsAt: null, active: false });
    expect((await send(a, "PUT", "/api/admin/maintenance", { enabled: "yes" })).status).toBe(400);
    expect((await send(m, "PUT", "/api/admin/maintenance", { enabled: true })).status).toBe(403);
    expect((await send(a, "PUT", "/api/admin/maintenance", { enabled: true, message: "Back at 9" })).status).toBe(200);
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'settings.maintenance'")).not.toBeNull();
    const visitor = await app.request("/", {}, env);
    expect(visitor.status).toBe(503);
    expect(visitor.headers.get("retry-after")).toBe("300");
    expect(await visitor.text()).toContain("Back at 9");
    const memberApi = await get(m, "/api/me");
    expect(memberApi.status).toBe(503);
    expect(((await memberApi.json()) as any).message).toBe("Back at 9");
    expect((await get(m, "/")).status).toBe(503);
    expect((await app.request("/signin", {}, env)).status).toBe(503);
    expect((await app.request("/signin?admin=1", {}, env)).status).toBe(200);
    expect((await get(a, "/api/me")).status).toBe(200);
    expect((await get(a, "/api/admin/maintenance")).status).toBe(200);
    expect((await app.request("/assets/app.css", {}, env)).status).toBe(200);
    expect((await send(a, "PUT", "/api/admin/maintenance", { enabled: false })).status).toBe(200);
    expect((await get(m, "/api/me")).status).toBe(200);
  });
  test("a scheduled window turns maintenance on and off by itself and shows the expected return", async () => {
    const a = await login("olivia"), m = await login("maya");
    const hour = 3600_000, iso = (ms: number) => new Date(Date.now() + ms).toISOString();
    expect((await send(a, "PUT", "/api/admin/maintenance", { enabled: false, startsAt: "nonsense" })).status).toBe(400);
    expect((await send(a, "PUT", "/api/admin/maintenance", { enabled: false, startsAt: iso(hour), endsAt: iso(-hour) })).status).toBe(400);
    expect((await send(a, "PUT", "/api/admin/maintenance", { enabled: false, endsAt: iso(hour) })).status).toBe(400);
    // window not started yet: members are fine
    expect((await send(a, "PUT", "/api/admin/maintenance", { enabled: false, startsAt: iso(hour), endsAt: iso(2 * hour) })).status).toBe(200);
    expect(((await (await get(a, "/api/admin/maintenance")).json()) as any).active).toBe(false);
    expect((await get(m, "/api/me")).status).toBe(200);
    // inside the window: blocked, with the expected return time
    expect((await send(a, "PUT", "/api/admin/maintenance", { enabled: false, message: "Disk swap", startsAt: iso(-hour), endsAt: iso(hour) })).status).toBe(200);
    const blocked = await get(m, "/api/me");
    expect(blocked.status).toBe(503);
    expect(((await blocked.json()) as any).message).toMatch(/Disk swap Expected back around/);
    expect((await get(a, "/api/me")).status).toBe(200);
    // window over: members are back without anyone switching anything
    expect((await send(a, "PUT", "/api/admin/maintenance", { enabled: false, startsAt: iso(-2 * hour), endsAt: iso(-hour) })).status).toBe(200);
    expect((await get(m, "/api/me")).status).toBe(200);
    expect((await send(a, "PUT", "/api/admin/maintenance", { enabled: false })).status).toBe(200);
  });
});

describe("admin security page", () => {
  test("shows checks, sessions and lockouts to admins only; can end sessions, sign everyone out and clear lockouts", async () => {
    const a = await login("olivia"), m = await login("maya"), other = await login("otheradmin");
    expect((await get(m, "/api/admin/security")).status).toBe(403);
    const overview = (await (await get(a, "/api/admin/security")).json()) as any;
    expect(overview.checks.map((x: any) => x.id)).toEqual(expect.arrayContaining(["keys-secret", "admins", "lockouts", "emails", "maintenance"]));
    expect(overview.sessions.filter((s: any) => s.current)).toHaveLength(1);
    const mayaSession = overview.sessions.find((s: any) => s.username === "maya");
    expect(mayaSession).toBeTruthy();
    await run(env.DB, "INSERT INTO rate_limits (key, window_start, count) VALUES ('signin:user:bob', ?, 5)", new Date().toISOString());
    const again = (await (await get(a, "/api/admin/security")).json()) as any;
    expect(again.lockouts).toEqual([expect.objectContaining({ kind: "user", subject: "bob", attempts: 5 })]);
    expect(again.checks.find((x: any) => x.id === "lockouts").status).toBe("warn");
    expect((await send(a, "POST", "/api/admin/security/lockouts/clear", { key: "reset:fail:x" })).status).toBe(400);
    expect((await send(a, "POST", "/api/admin/security/lockouts/clear", { key: "signin:user:bob" })).status).toBe(200);
    expect(((await (await get(a, "/api/admin/security")).json()) as any).lockouts).toEqual([]);
    expect((await send(a, "POST", `/api/admin/security/sessions/${overview.sessions.find((s: any) => s.current).id}/revoke`)).status).toBe(400);
    expect((await send(a, "POST", `/api/admin/security/sessions/${mayaSession.id}/revoke`)).status).toBe(200);
    expect((await get(m, "/api/me")).status).toBe(401);
    expect((await send(a, "POST", `/api/admin/security/sessions/${mayaSession.id}/revoke`)).status).toBe(404);
    const m2 = await login("maya");
    expect((await send(a, "POST", "/api/admin/security/sign-out-all", {})).status).toBe(200);
    expect((await get(m2, "/api/me")).status).toBe(401);
    expect((await get(other, "/api/me")).status).toBe(200);
    expect((await send(a, "POST", "/api/admin/security/sign-out-all", { includeAdmins: true })).status).toBe(200);
    expect((await get(other, "/api/me")).status).toBe(401);
    expect((await get(a, "/api/me")).status).toBe(200);
    for (const action of ["security.revoke_session", "security.sign_out_all", "security.clear_lockout"]) expect(await first(env.DB, "SELECT id FROM audit WHERE action = ?", action), action).not.toBeNull();
  });
});

