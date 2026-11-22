import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { all, first, run } from "../src/db";
import { decryptSecret, effectiveEnv, encryptSecret } from "../src/keys";
import type { Env } from "../src/env";

describe("encryption", () => {
  test("round-trips, uses a fresh IV each time, and is bound to the key name and the master secret", async () => {
    const a = await encryptSecret("master-one", "seerr_api_key", "s3cret-value"), b = await encryptSecret("master-one", "seerr_api_key", "s3cret-value");
    expect(a).not.toBe(b);
    expect(a).not.toContain("s3cret");
    expect(await decryptSecret("master-one", "seerr_api_key", a)).toBe("s3cret-value");
    await expect(decryptSecret("master-one", "tracearr_token", a)).rejects.toThrow();
    await expect(decryptSecret("master-two", "seerr_api_key", a)).rejects.toThrow();
  });
});

let seen: Record<string, string>;
let verdict: "ok" | "refused" | "unreachable";
const jf = () => ({ authenticate: async (n: string) => ({ id: n === "olivia" ? "a1" : "u1", name: n, isAdmin: n === "olivia" }), getUser: async (id: string) => ({ id, name: id === "a1" ? "olivia" : "maya", isAdmin: id === "a1", isDisabled: false }) });
const app = createApp({
  jellyfin: ((e: Env) => { seen = { jf: e.JELLYFIN_ADMIN_KEY, seerr: e.SEERR_API_KEY, tr: e.TRACEARR_TOKEN }; return jf(); }) as never,
  testIntegration: (async () => (verdict === "ok" ? { ok: true } : { ok: false, rejected: verdict === "refused", error: "x" })) as never,
});
const e0 = { ...env, JELLYFIN_ADMIN_KEY: "wrangler-jf", SEERR_API_KEY: "wrangler-seerr", TRACEARR_TOKEN: "wrangler-tr", KEYS_SECRET: "test-master-secret-123" } as Env;
const j = (method: string, body?: unknown, h: Record<string, string> = {}) => ({ method, headers: { "content-type": "application/json", ...h }, body: body === undefined ? undefined : JSON.stringify(body) });
async function login(name: string, e = e0) {
  const r = await app.request("/api/signin", j("POST", { username: name, password: "x" }), e);
  return { cookie: r.headers.get("set-cookie")!.split(";")[0], "x-csrf-token": ((await r.json()) as any).csrf as string };
}
const call = (a: any, method: string, path: string, body?: unknown, e = e0) => app.request(path, j(method, body, a), e);

beforeEach(async () => {
  verdict = "ok";
  for (const t of ["integration_keys", "audit", "sessions", "rate_limits", "members"]) await run(env.DB, `DELETE FROM ${t}`);
});

describe("managing keys", () => {
  test("a stored key is encrypted at rest, never returned, and audited without its value", async () => {
    const a = await login("olivia");
    expect((await call(a, "PUT", "/api/admin/keys/seerr_api_key", { value: "brand-new-key-123" })).status).toBe(200);
    expect(JSON.stringify(await all(env.DB, "SELECT * FROM integration_keys"))).not.toContain("brand-new-key-123");
    const listed = await (await call(a, "GET", "/api/admin/keys")).text();
    expect(listed).not.toContain("brand-new-key-123");
    expect(JSON.parse(listed).keys.find((k: any) => k.name === "seerr_api_key")).toMatchObject({ source: "stored", updatedBy: "olivia" });
    expect(JSON.parse(listed).keys.find((k: any) => k.name === "tracearr_token")).toMatchObject({ source: "worker" });
    expect(JSON.stringify(await all(env.DB, "SELECT * FROM audit"))).not.toContain("brand-new-key-123");
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'key.set' AND target = 'seerr_api_key'")).not.toBeNull();
  });
  test("a stored key overrides the Worker secret from the next request, and removing it goes back", async () => {
    const a = await login("olivia");
    await call(a, "PUT", "/api/admin/keys/seerr_api_key", { value: "stored-seerr" });
    await call(a, "GET", "/api/me");
    expect(seen.seerr).toBe("stored-seerr");
    expect((await effectiveEnv(e0)).SEERR_API_KEY).toBe("stored-seerr");
    expect((await call(a, "DELETE", "/api/admin/keys/seerr_api_key")).status).toBe(200);
    await call(a, "GET", "/api/me");
    expect(seen.seerr).toBe("wrangler-seerr");
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'key.remove'")).not.toBeNull();
  });
  test("a key is checked against the real service first: refused or unreachable keys are not stored", async () => {
    const a = await login("olivia");
    verdict = "refused";
    expect((await call(a, "PUT", "/api/admin/keys/seerr_api_key", { value: "bad-key-123456" })).status).toBe(422);
    verdict = "unreachable";
    expect((await call(a, "PUT", "/api/admin/keys/seerr_api_key", { value: "bad-key-123456" })).status).toBe(502);
    expect(await first(env.DB, "SELECT * FROM integration_keys")).toBeNull();
  });
  test("force stores an unreachable key, but never the Jellyfin admin key", async () => {
    const a = await login("olivia");
    verdict = "unreachable";
    expect((await call(a, "PUT", "/api/admin/keys/seerr_api_key", { value: "later-key-123456", force: true })).status).toBe(200);
    expect((await call(a, "PUT", "/api/admin/keys/jellyfin_admin_key", { value: "later-key-123456", force: true })).status).toBe(502);
  });
  test("unknown names, empty or oversized values are refused", async () => {
    const a = await login("olivia");
    expect((await call(a, "PUT", "/api/admin/keys/whatever", { value: "abcdefghij" })).status).toBe(404);
    for (const value of ["", "   ", "x".repeat(501), 5]) expect((await call(a, "PUT", "/api/admin/keys/seerr_api_key", { value })).status).toBe(400);
  });
  test("without a master secret nothing can be stored, but the list still works", async () => {
    const e = { ...e0, KEYS_SECRET: undefined } as unknown as Env;
    const a = await login("olivia", e);
    expect((await call(a, "PUT", "/api/admin/keys/seerr_api_key", { value: "abcdefghij" }, e)).status).toBe(503);
    expect((await call(a, "GET", "/api/admin/keys", undefined, e)).status).toBe(200);
  });
  test("members cannot see or change keys", async () => {
    const m = await login("maya");
    expect((await call(m, "GET", "/api/admin/keys")).status).toBe(403);
    expect((await call(m, "PUT", "/api/admin/keys/seerr_api_key", { value: "abcdefghij" })).status).toBe(403);
    expect((await call(m, "DELETE", "/api/admin/keys/seerr_api_key")).status).toBe(403);
  });
  test("an integration can be tested on demand", async () => {
    const a = await login("olivia");
    expect(await (await call(a, "POST", "/api/admin/integrations/seerr/test")).json()).toEqual({ ok: true });
    verdict = "refused";
    expect(await (await call(a, "POST", "/api/admin/integrations/seerr/test")).json()).toMatchObject({ ok: false });
    expect((await call(a, "POST", "/api/admin/integrations/nope/test")).status).toBe(404);
  });
  test("a stored value that cannot be decrypted is ignored and the Worker secret is used", async () => {
    await run(env.DB, "INSERT INTO integration_keys (name, ciphertext, updated_at, updated_by) VALUES ('seerr_api_key','garbage','2026-01-01','x')");
    expect((await effectiveEnv(e0)).SEERR_API_KEY).toBe("wrangler-seerr");
  });
});
