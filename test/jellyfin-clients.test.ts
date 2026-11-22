import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import clientsTs from "./fixtures/jellyfin-org/clients.ts.txt?raw";
import platformTs from "./fixtures/jellyfin-org/platform.ts.txt?raw";
import { loadClients, parseClients, parsePlatforms, refreshClients } from "../src/jellyfin-clients";
import { CLIENTS_SEED } from "../src/clients-seed";
import { run } from "../src/db";

const fakeFetch = (files: Record<string, string | number>) => (async (u: string) => {
  const f = Object.entries(files).find(([k]) => String(u).endsWith(k))?.[1];
  return typeof f === "number" ? new Response("no", { status: f }) : new Response(f ?? "", { status: f === undefined ? 404 : 200 });
}) as unknown as typeof fetch;
beforeEach(async () => { await run(env.DB, "DELETE FROM settings WHERE key LIKE 'jellyfin_clients%'"); });

describe("jellyfin.org clients parser", () => {
  test("reads the official list: names, platforms by display name, https links only", () => {
    expect(parsePlatforms(platformTs)).toMatchObject({ AndroidTV: "Android TV", FireOS: "Fire TV", MacOS: "macOS", IOS: "iOS" });
    const clients = parseClients(clientsTs, platformTs);
    expect(clients.length).toBeGreaterThanOrEqual(10);
    const android = clients.find((c) => c.id === "jellyfin-android")!;
    expect(android).toMatchObject({ name: "Jellyfin for Android", beta: false });
    expect(android.platforms).toContain("Android");
    expect(clients.find((c) => c.name.includes("Swiftfin"))?.beta).toBe(true);
    expect(clients.some((c) => c.platforms.includes("Android TV") && c.platforms.includes("Fire TV"))).toBe(true);
    for (const c of clients) for (const l of [...c.links, ...c.moreLinks]) expect(l.url.startsWith("https://")).toBe(true);
  });
  test("ignores third-party clients and rejects a file that no longer looks right", () => {
    expect(parseClients(clientsTs, platformTs).some((c) => /thirdParty/i.test(c.id))).toBe(false);
    expect(() => parseClients("export const nothing = 1;", platformTs)).toThrow();
    expect(() => parseClients("const officialClients: Array<Client> = [ { id: 'a', name: 'A', description: '', clientType: ClientType.Official } ];", platformTs)).toThrow(/looks wrong/);
  });
  test("drops links that are not https", () => {
    const src = clientsTs.replace("https://github.com/jellyfin/jellyfin-media-player/releases", "javascript:alert(1)");
    const jmp = parseClients(src, platformTs).find((c) => c.id === "jellyfin-media-player")!;
    expect(jmp.links.every((l) => l.url.startsWith("https://"))).toBe(true);
    expect(JSON.stringify(jmp)).not.toContain("javascript:");
  });
  test("the built-in seed is a valid snapshot", () => {
    expect(CLIENTS_SEED.clients.length).toBeGreaterThanOrEqual(10);
  });
});

describe("daily refresh", () => {
  const files = { "clients.ts": clientsTs, "platform.ts": platformTs };
  test("fetches once, stores it, then waits a day", async () => {
    const t0 = Date.UTC(2026, 10, 15, 8);
    expect(await refreshClients(env.DB, fakeFetch(files), t0)).toBe("updated");
    expect((await loadClients(env.DB, { ...CLIENTS_SEED, clients: [] })).clients.length).toBeGreaterThanOrEqual(10);
    expect(await refreshClients(env.DB, fakeFetch(files), t0 + 3600_000 * 5)).toBe("fresh");
    expect(await refreshClients(env.DB, fakeFetch(files), t0 + 86400_000 + 60_000)).toBe("updated");
  });
  test("a failed or garbled download keeps the old list and backs off for an hour", async () => {
    const t0 = Date.UTC(2026, 10, 15, 8);
    await refreshClients(env.DB, fakeFetch(files), t0);
    const before = (await loadClients(env.DB, CLIENTS_SEED)).updatedAt;
    const day = t0 + 86400_000 + 1000;
    expect(await refreshClients(env.DB, fakeFetch({ "clients.ts": 500, "platform.ts": platformTs }), day)).toBe("failed");
    expect(await refreshClients(env.DB, fakeFetch(files), day + 60_000)).toBe("fresh"); // within the hour: no hammering
    expect(await refreshClients(env.DB, fakeFetch({ "clients.ts": "garbage", "platform.ts": platformTs }), day + 3600_000 + 1000)).toBe("failed");
    expect((await loadClients(env.DB, CLIENTS_SEED)).updatedAt).toBe(before);
  });
  test("with nothing stored the built-in seed is used", async () => {
    expect(await loadClients(env.DB, CLIENTS_SEED)).toBe(CLIENTS_SEED);
  });
});

describe("help clients API", () => {
  test("signed-in members get the official client list and docs links; visitors do not", async () => {
    const { createApp } = await import("../src/index");
    const app = createApp({ jellyfin: (() => ({ authenticate: async () => ({ id: "h1", name: "maya", isAdmin: false }), getUser: async () => ({ id: "h1", name: "maya", isAdmin: false, isDisabled: false }) })) as never });
    expect((await app.request("/api/help/clients", {}, env)).status).toBe(401);
    const r = await app.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "maya", password: "x" }) }, env);
    const res = await app.request("/api/help/clients", { headers: { cookie: r.headers.get("set-cookie")!.split(";")[0] } }, env);
    const body = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(body.clients.length).toBeGreaterThanOrEqual(10);
    expect(body.clients.every((x: any) => x.platforms.length > 0)).toBe(true);
    expect(body.docs.every((d: any) => d.url.startsWith("https://jellyfin.org/"))).toBe(true);
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThan(0);
    // JellyTV leads; the official iOS app keeps its recommendation.
    expect(body.clients[0]).toMatchObject({ id: "jellytv", recommended: true, links: [{ url: "https://apps.apple.com/gb/app/jellytv/id6752357290" }] });
    expect(body.clients.some((x: any) => x.id !== "jellytv" && x.recommended && x.platforms.includes("iOS"))).toBe(true); // the official iOS app stays recommended too
  });
});

