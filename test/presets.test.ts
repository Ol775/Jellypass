import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { run, first, all } from "../src/db";
import { applyPresetToMembers, clonePreset, createPreset, deletePreset, listPresets, presetToPolicy, updatePreset } from "../src/presets";

beforeEach(async () => {
  for (const t of ["invites", "members", "audit", "sessions"]) await run(env.DB, `DELETE FROM ${t}`);
  await run(env.DB, "DELETE FROM presets WHERE is_default = 0");
});

const cfg = { name: "Cousins", libraries: ["lib-films"], bitrateLimit: 4000000, remoteAccess: false, requestRights: "request" as const, membershipDays: 90 };

test("presetToPolicy maps config to Jellyfin policy fields", () => {
  expect(presetToPolicy({ id: "p", name: "x", libraries: ["a", "b"], bitrateLimit: 4000000, remoteAccess: false, requestRights: "none", membershipDays: null, isDefault: false })).toEqual({
    EnableAllFolders: false, EnabledFolders: ["a", "b"], RemoteClientBitrateLimit: 4000000, EnableRemoteAccess: false,
  });
  expect(presetToPolicy({ id: "p", name: "x", libraries: "all", bitrateLimit: 0, remoteAccess: true, requestRights: "none", membershipDays: null, isDefault: false })).toMatchObject({ EnableAllFolders: true, EnableRemoteAccess: true, RemoteClientBitrateLimit: 0 });
});

test("create, update and clone round-trip", async () => {
  const p = await createPreset(env.DB, cfg);
  expect((await listPresets(env.DB)).map((x) => x.name)).toContain("Cousins");
  await updatePreset(env.DB, p.id, { ...cfg, name: "Cousins 2", membershipDays: null });
  expect((await listPresets(env.DB)).find((x) => x.id === p.id)).toMatchObject({ name: "Cousins 2", membershipDays: null, libraries: ["lib-films"] });
  const c = await clonePreset(env.DB, p.id);
  expect(c.name).toBe("Cousins 2 (copy)");
  expect(c.id).not.toBe(p.id);
  expect(c.isDefault).toBe(false);
});

test("delete is blocked while an invite references the preset", async () => {
  const p = await createPreset(env.DB, cfg);
  await run(env.DB, "INSERT INTO invites (id, token_hash, preset_id, expires_at, created_by, created_at) VALUES ('i1','h',?,'2999-01-01','a','2026-01-01')", p.id);
  await expect(deletePreset(env.DB, p.id)).rejects.toThrow(/in use/i);
  await run(env.DB, "DELETE FROM invites");
  await deletePreset(env.DB, p.id);
  expect((await listPresets(env.DB)).find((x) => x.id === p.id)).toBeUndefined();
});

test("editing a preset does not touch members; applyPresetToMembers does, with one audit row", async () => {
  const p = await createPreset(env.DB, cfg);
  await run(env.DB, "INSERT INTO members (jellyfin_id, username, preset_id) VALUES ('u1','a',?),('u2','b',?),('u3','c','preset-guest')", p.id, p.id);
  const calls: Array<[string, unknown]> = [];
  const jf = { setPolicy: async (id: string, patch: unknown) => void calls.push([id, patch]), listUsers: async () => [{ id: "u1", isAdmin: false }, { id: "u2", isAdmin: false }] } as never;
  await updatePreset(env.DB, p.id, { ...cfg, bitrateLimit: 1000 });
  expect(calls).toHaveLength(0);
  const n = await applyPresetToMembers(env.DB, jf, p.id, "olivia");
  expect(n.applied).toBe(2);
  expect(calls.map((c) => c[0]).sort()).toEqual(["u1", "u2"]);
  expect(calls[0][1]).toMatchObject({ RemoteClientBitrateLimit: 1000 });
  expect(await all(env.DB, "SELECT * FROM audit WHERE action = 'preset.apply'")).toHaveLength(1);
});

describe("preset routes", () => {
  const users: Record<string, any> = { u1: { id: "u1", name: "maya", isAdmin: false, isDisabled: false }, u2: { id: "u2", name: "olivia", isAdmin: true, isDisabled: false } };
  const app = createApp({ jellyfin: (() => ({
    authenticate: async (n: string) => { const u = Object.values(users).find((x: any) => x.name === n); return u ? { id: u.id, name: u.name, isAdmin: u.isAdmin } : null; },
    getUser: async (id: string) => users[id] ?? null,
    setPolicy: async () => {},
  })) as never });
  async function login(name: string) {
    const r = await app.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: name, password: "x" }) }, env);
    return { cookie: r.headers.get("set-cookie")!.split(";")[0], csrf: ((await r.json()) as any).csrf as string };
  }
  test("a member gets 403 on every preset route", async () => {
    const { cookie, csrf } = await login("maya");
    expect((await app.request("/api/admin/presets", { headers: { cookie } }, env)).status).toBe(403);
    expect((await app.request("/api/admin/presets", { method: "POST", headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json" }, body: JSON.stringify(cfg) }, env)).status).toBe(403);
  });
  test("an admin creates a preset and it is audited", async () => {
    const { cookie, csrf } = await login("olivia");
    const res = await app.request("/api/admin/presets", { method: "POST", headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json" }, body: JSON.stringify(cfg) }, env);
    expect(res.status).toBe(201);
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'preset.create'")).not.toBeNull();
    const list = await app.request("/api/admin/presets", { headers: { cookie } }, env);
    expect(((await list.json()) as any[]).map((p) => p.name)).toContain("Cousins");
  });
  test("invalid config is rejected", async () => {
    const { cookie, csrf } = await login("olivia");
    const res = await app.request("/api/admin/presets", { method: "POST", headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json" }, body: JSON.stringify({ ...cfg, bitrateLimit: -5 }) }, env);
    expect(res.status).toBe(400);
  });
});

test("applyPresetToMembers also updates Seerr rights for members with a Seerr account", async () => {
  const p = await createPreset(env.DB, { ...cfg, requestRights: "auto" });
  await run(env.DB, "INSERT INTO members (jellyfin_id, username, preset_id, seerr_user_id) VALUES ('s1','a',?,7),('s2','b',?,NULL)", p.id, p.id);
  const perms: Array<[number, string]> = [];
  await applyPresetToMembers(env.DB, { setPolicy: async () => {}, listUsers: async () => [{ id: "s1", isAdmin: false }, { id: "s2", isAdmin: false }] } as never, p.id, "olivia", { setPermissions: async (id: number, r: string) => void perms.push([id, r]) } as never);
  expect(perms).toEqual([[7, "auto"]]);
});

test("applyPresetToMembers skips admins and carries on past a failure, reporting each", async () => {
  const p = await createPreset(env.DB, cfg);
  await run(env.DB, "INSERT INTO members (jellyfin_id, username, preset_id, seerr_user_id) VALUES ('a1','boss',?,3),('u1','a',?,NULL),('u2','b',?,NULL),('u3','c',?,NULL)", p.id, p.id, p.id, p.id);
  const done: string[] = [], perms: number[] = [];
  const jf = { listUsers: async () => [{ id: "a1", isAdmin: true }, { id: "u1", isAdmin: false }, { id: "u2", isAdmin: false }, { id: "u3", isAdmin: false }], setPolicy: async (id: string) => { if (id === "u2") throw new Error("boom"); done.push(id); } } as never;
  const r = await applyPresetToMembers(env.DB, jf, p.id, "olivia", { setPermissions: async (id: number) => void perms.push(id) } as never);
  expect(r).toEqual({ applied: 2, skipped: [{ id: "a1", reason: "admin" }], failed: [{ id: "u2", error: expect.any(String) }] });
  expect(done.sort()).toEqual(["u1", "u3"]);
  expect(perms).toEqual([]); // the admin's Seerr account is untouched
});
