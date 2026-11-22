import { describe, expect, test } from "vitest";
import { BetaGuardError, makeJellyfin } from "../src/jellyfin";
import type { Env } from "../src/env";

type Call = { method: string; path: string; auth: string | null; body: unknown; upstream?: string | null };

function fake(routes: Record<string, (body: any) => { status?: number; json?: unknown }>) {
  const calls: Call[] = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const headers = new Headers(init?.headers);
    calls.push({ method, path: url.pathname, auth: headers.get("authorization"), body, upstream: headers.get("x-jellypass-key") });
    const r = routes[`${method} ${url.pathname}`];
    if (!r) return new Response("no route", { status: 404 });
    const out = r(body);
    return new Response(out.json === undefined ? null : JSON.stringify(out.json), { status: out.status ?? 200 });
  };
  return { fetchImpl: fetchImpl as typeof fetch, calls };
}

const env = (e: "beta" | "prod") => ({ ENVIRONMENT: e, JELLYFIN_URL: "https://jf.test", JELLYFIN_ADMIN_KEY: "KEY" }) as Env;

describe("authenticate", () => {
  test("posts credentials with no admin key and returns the user", async () => {
    const { fetchImpl, calls } = fake({
      "POST /Users/AuthenticateByName": () => ({ json: { User: { Id: "u1", Name: "maya", Policy: { IsAdministrator: false } } } }),
    });
    const u = await makeJellyfin(env("prod"), fetchImpl).authenticate("maya", "pw");
    expect(u).toEqual({ id: "u1", name: "maya", isAdmin: false });
    expect(calls[0].auth).not.toContain("KEY");
    expect(calls[0].body).toEqual({ Username: "maya", Pw: "pw" });
  });
  test("returns null on 401", async () => {
    const { fetchImpl } = fake({ "POST /Users/AuthenticateByName": () => ({ status: 401 }) });
    expect(await makeJellyfin(env("prod"), fetchImpl).authenticate("maya", "bad")).toBeNull();
  });
});

describe("beta guard", () => {
  test("createUser refuses names without the beta- prefix", async () => {
    const { fetchImpl, calls } = fake({});
    await expect(makeJellyfin(env("beta"), fetchImpl).createUser("maya", "pw")).rejects.toBeInstanceOf(BetaGuardError);
    expect(calls).toHaveLength(0);
  });
  test("createUser allows beta- names and sends the admin key", async () => {
    const { fetchImpl, calls } = fake({ "POST /Users/New": () => ({ json: { Id: "u2", Name: "beta-maya", Policy: {} } }) });
    const u = await makeJellyfin(env("beta"), fetchImpl).createUser("beta-maya", "pw");
    expect(u.id).toBe("u2");
    expect(calls[0].auth).toContain('Token="KEY"');
  });
  test.each(["deleteUser", "setPassword", "deleteDevices"] as const)("%s refuses a non-beta target", async (fn) => {
    const { fetchImpl, calls } = fake({ "GET /Users/u1": () => ({ json: { Id: "u1", Name: "maya", Policy: {} } }) });
    const jf = makeJellyfin(env("beta"), fetchImpl) as any;
    await expect(jf[fn]("u1", "pw")).rejects.toBeInstanceOf(BetaGuardError);
    expect(calls.filter((c) => c.method !== "GET")).toHaveLength(0);
  });
  test("setPolicy refuses a non-beta target", async () => {
    const { fetchImpl, calls } = fake({ "GET /Users/u1": () => ({ json: { Id: "u1", Name: "maya", Policy: {} } }) });
    await expect(makeJellyfin(env("beta"), fetchImpl).setPolicy("u1", { IsDisabled: true })).rejects.toBeInstanceOf(BetaGuardError);
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });
  test("prod has no guard", async () => {
    const { fetchImpl } = fake({ "POST /Users/New": () => ({ json: { Id: "u3", Name: "maya", Policy: {} } }) });
    expect((await makeJellyfin(env("prod"), fetchImpl).createUser("maya", "pw")).id).toBe("u3");
  });
});

describe("policy", () => {
  test("setPolicy merges the patch into the full existing policy", async () => {
    const { fetchImpl, calls } = fake({
      "GET /Users/u1": () => ({ json: { Id: "u1", Name: "beta-x", Policy: { IsDisabled: false, EnableRemoteAccess: true, MaxActiveSessions: 2 } } }),
      "POST /Users/u1/Policy": () => ({}),
    });
    await makeJellyfin(env("beta"), fetchImpl).setPolicy("u1", { IsDisabled: true });
    expect(calls.at(-1)!.body).toEqual({ IsDisabled: true, EnableRemoteAccess: true, MaxActiveSessions: 2 });
  });
});

describe("misc", () => {
  test("getUser returns null on 404", async () => {
    const { fetchImpl } = fake({});
    expect(await makeJellyfin(env("prod"), fetchImpl).getUser("zz")).toBeNull();
  });
  test("publicInfo reports ok and latency, and not-ok on failure", async () => {
    const good = fake({ "GET /System/Info/Public": () => ({ json: {} }) });
    expect((await makeJellyfin(env("prod"), good.fetchImpl).publicInfo()).ok).toBe(true);
    const bad = fake({ "GET /System/Info/Public": () => ({ status: 503 }) });
    expect((await makeJellyfin(env("prod"), bad.fetchImpl).publicInfo()).ok).toBe(false);
  });
  test("activity maps entries and passes the date filter", async () => {
    const { fetchImpl, calls } = fake({
      "GET /System/ActivityLog/Entries": () => ({ json: { Items: [{ Id: 1, Name: "maya is online from Safari", Overview: "IP address: 1.2.3.4", Type: "SessionStarted", UserId: "u1", Date: "2026-11-14T10:00:00Z", Severity: "Information" }] } }),
    });
    const rows = await makeJellyfin(env("prod"), fetchImpl).activity("2026-11-14T09:00:00Z");
    expect(rows[0]).toMatchObject({ id: 1, userId: "u1", overview: "IP address: 1.2.3.4" });
    expect(calls[0].path).toBe("/System/ActivityLog/Entries");
  });
});

describe("review fixes", () => {
  test("deleteDevice refuses a device that is not in that user's device list", async () => {
    const { fetchImpl, calls } = fake({ "GET /Devices": () => ({ json: { Items: [{ Id: "mine", Name: "TV", AppName: "Jellyfin" }] } }) });
    await expect(makeJellyfin(env("prod"), fetchImpl).deleteDevice("u1", "someone-elses")).rejects.toThrow(/does not belong/);
    expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(0);
  });
  test("deleteDevice deletes a device that belongs to the user", async () => {
    const { fetchImpl, calls } = fake({ "GET /Devices": () => ({ json: { Items: [{ Id: "mine", Name: "TV", AppName: "Jellyfin" }] } }), "DELETE /Devices": () => ({}) });
    await makeJellyfin(env("prod"), fetchImpl).deleteDevice("u1", "mine");
    expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(1);
  });
  test("quickConnectAuthorize refuses a non-beta target in beta", async () => {
    const { fetchImpl, calls } = fake({ "GET /Users/u1": () => ({ json: { Id: "u1", Name: "maya", Policy: {} } }) });
    await expect(makeJellyfin(env("beta"), fetchImpl).quickConnectAuthorize("u1", "123456")).rejects.toBeInstanceOf(BetaGuardError);
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });
});

test("listUsers maps every Jellyfin user", async () => {
  const { fetchImpl } = fake({ "GET /Users": () => ({ json: [{ Id: "a", Name: "maya", Policy: { IsAdministrator: false, IsDisabled: true } }, { Id: "b", Name: "olivia", Policy: { IsAdministrator: true } }] }) });
  expect(await makeJellyfin(env("prod"), fetchImpl).listUsers()).toEqual([
    { id: "a", name: "maya", isAdmin: false, isDisabled: true },
    { id: "b", name: "olivia", isAdmin: true, isDisabled: false },
  ]);
});

test("authenticate ends the Jellyfin session it created", async () => {
  const { fetchImpl, calls } = fake({
    "POST /Users/AuthenticateByName": () => ({ json: { AccessToken: "tok123", User: { Id: "u1", Name: "maya", Policy: {} } } }),
    "POST /Sessions/Logout": () => ({ status: 204 }),
  });
  await makeJellyfin(env("prod"), fetchImpl).authenticate("maya", "pw");
  const out = calls.find((c) => c.path === "/Sessions/Logout")!;
  expect(out.auth).toContain('Token="tok123"');
});

test("libraries lists Jellyfin's media folders", async () => {
  const { fetchImpl } = fake({ "GET /Library/VirtualFolders": () => ({ json: [{ Name: "Films", ItemId: "f1" }, { Name: "TV", ItemId: "t1" }] }) });
  expect(await makeJellyfin(env("prod"), fetchImpl).libraries()).toEqual([{ id: "f1", name: "Films" }, { id: "t1", name: "TV" }]);
});

test("clearResume refuses a non-beta user in beta", async () => {
  const { fetchImpl, calls } = fake({ "GET /Users/u1": () => ({ json: { Id: "u1", Name: "maya", Policy: {} } }) });
  await expect(makeJellyfin(env("beta"), fetchImpl).clearResume("u1", "item")).rejects.toBeInstanceOf(BetaGuardError);
  expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
});

test("the upstream key header is sent to Jellyfin when configured, and not otherwise", async () => {
  const a = fake({ "GET /System/Info/Public": () => ({ json: {} }) });
  await makeJellyfin({ ...env("prod"), UPSTREAM_KEY: "k-123" } as Env, a.fetchImpl).publicInfo();
  expect(a.calls[0].upstream).toBe("k-123");
  const b = fake({ "GET /System/Info/Public": () => ({ json: {} }) });
  await makeJellyfin(env("prod"), b.fetchImpl).publicInfo();
  expect(b.calls[0].upstream).toBeNull();
});

test('avatar reads primary bytes with upstream headers in beta, handles missing and failed images', async () => {
  let status = 200;
  const fetchImpl = (async (input, init) => {
    expect(String(input)).toBe('https://jf.test/Users/abc/Images/Primary?maxWidth=96');
    expect(new Headers(init?.headers).get('x-jellypass-key')).toBe('upstream');
    expect(new Headers(init?.headers).get('authorization')).toContain('Token="KEY"');
    return new Response(new Uint8Array([1,2,3]), {status, headers:{'content-type':'image/jpeg'}});
  }) as typeof fetch;
  const jf = makeJellyfin({...env('beta'), UPSTREAM_KEY:'upstream'},fetchImpl);
  const picture = await jf.avatar('abc');
  expect(picture?.contentType).toBe('image/jpeg');
  expect([...new Uint8Array(picture!.body)]).toEqual([1,2,3]);
  status=404;expect(await jf.avatar('abc')).toBeNull();
  status=503;await expect(jf.avatar('abc')).rejects.toThrow(/503/);
});

describe("libraryQuality", () => {
  test("films use their own video stream; series use their first episode; a title not in the library is null", async () => {
    const { fetchImpl, calls } = fake({
      "GET /Items": (_b) => ({ json: { Items: [] } }),
    });
    expect(await makeJellyfin(env("prod"), fetchImpl).libraryQuality("movie", 9001)).toBeNull();
    const film = fake({ "GET /Items": () => ({ json: { Items: [{ Id: "f", MediaStreams: [{ Type: "Audio" }, { Type: "Video", Width: 1920, Height: 800 }] }] } }) });
    expect(await makeJellyfin(env("prod"), film.fetchImpl).libraryQuality("movie", 9002)).toBe("1080p");
    const uhd = fake({ "GET /Items": () => ({ json: { Items: [{ Id: "f", MediaStreams: [{ Type: "Video", Width: 3840, Height: 1600 }] }] } }) });
    expect(await makeJellyfin(env("prod"), uhd.fetchImpl).libraryQuality("movie", 9003)).toBe("4K");
    const sd = fake({ "GET /Items": () => ({ json: { Items: [{ Id: "f", MediaStreams: [{ Type: "Video", Width: 720, Height: 404 }] }] } }) });
    expect(await makeJellyfin(env("prod"), sd.fetchImpl).libraryQuality("tv", 9004)).toBe("SD"); // series: one lookup for the show, one for an episode
    expect(sd.calls).toHaveLength(2);
    expect(calls[0].auth).toContain("KEY");
    expect(await makeJellyfin(env("prod"), fetchImpl).libraryQuality("movie", -1)).toBeNull();
  });
});

describe("libraryItem", () => {
  test("returns the Jellyfin item id for deep links; a malformed id is dropped", async () => {
    const id = "0123456789abcdef0123456789abcdef";
    const ok = fake({ "GET /Items": () => ({ json: { Items: [{ Id: id, MediaStreams: [{ Type: "Video", Width: 1920, Height: 1080 }] }] } }) });
    expect(await makeJellyfin(env("prod"), ok.fetchImpl).libraryItem("movie", 9101)).toEqual({ id, quality: "1080p" });
    const bad = fake({ "GET /Items": () => ({ json: { Items: [{ Id: "../x", MediaStreams: [] }] } }) });
    expect((await makeJellyfin(env("prod"), bad.fetchImpl).libraryItem("movie", 9102)).id).toBeNull();
  });
});
