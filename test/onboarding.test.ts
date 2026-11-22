import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { first, run } from "../src/db";

const users: Record<string, any> = { u1: { id: "u1", name: "maya", isAdmin: false, isDisabled: false }, a1: { id: "a1", name: "olivia", isAdmin: true, isDisabled: false } };
let qc: Array<[string, string]>, qcFail: boolean;
const app = createApp({
  jellyfin: (() => ({
    authenticate: async (n: string) => (n === "maya" ? { id: "u1", name: "maya", isAdmin: false } : n === "olivia" ? { id: "a1", name: "olivia", isAdmin: true } : null),
    getUser: async (id: string) => users[id] ?? null,
    quickConnectAuthorize: async (id: string, code: string) => { if (qcFail) throw new Error("nope"); qc.push([id, code]); },
  })) as never,
});
const post = (path: string, body: unknown, h: Record<string, string> = {}) => app.request(path, { method: "POST", headers: { "content-type": "application/json", ...h }, body: JSON.stringify(body) }, env);
const put = (path: string, body: unknown, h: Record<string, string>) => app.request(path, { method: "PUT", headers: { "content-type": "application/json", ...h }, body: JSON.stringify(body) }, env);
async function login() {
  const r = await post("/api/signin", { username: "maya", password: "x" });
  const a = { cookie: r.headers.get("set-cookie")!.split(";")[0], "x-csrf-token": ((await r.json()) as any).csrf as string };
  return a;
}
const state = async (a: Record<string, string>) => ((await (await app.request("/api/onboarding", { headers: { cookie: a.cookie } }, env)).json()) as any);

beforeEach(async () => {
  qc = []; qcFail = false;
  for (const t of ["members", "sessions", "rate_limits"]) await run(env.DB, `DELETE FROM ${t}`);
});

describe("existing Jellyfin users", () => {
  test("first sign-in creates a member row with no expiry and starts the welcome", async () => {
    const a = await login();
    expect(await first(env.DB, "SELECT username, expires_at FROM members WHERE jellyfin_id = 'u1'")).toEqual({ username: "maya", expires_at: null });
    expect(await state(a)).toMatchObject({ needsOnboarding: true, state: { kind: "existing", step: "welcome" } });
  });
  test("a later sign-in does not restart onboarding", async () => {
    const a = await login();
    await put("/api/onboarding", { step: "tour", tourIndex: 2 }, a);
    await login();
    expect((await state(a)).state).toMatchObject({ step: "tour", tourIndex: 2 });
  });
});

describe("state", () => {
  test("progress is saved so closing the tab resumes", async () => {
    const a = await login();
    expect((await put("/api/onboarding", { step: "tour", tourIndex: 1 }, a)).status).toBe(200);
    expect((await state(a)).state).toMatchObject({ step: "tour", tourIndex: 1 });
  });
  test("going back keeps what was already chosen", async () => {
    const a = await login();
    await put("/api/onboarding", { kind: "new", experience: "knows-jellyfin", step: "account" }, a);
    await put("/api/onboarding", { step: "welcome" }, a);
    expect((await state(a)).state).toMatchObject({ experience: "knows-jellyfin", step: "welcome" });
  });
  test("optional steps can be skipped and complete ends onboarding", async () => {
    const a = await login();
    await put("/api/onboarding", { step: "done", skipped: ["device"] }, a);
    expect((await state(a)).state.skipped).toEqual(["device"]);
    expect((await post("/api/onboarding/complete", {}, a)).status).toBe(200);
    expect(await state(a)).toMatchObject({ needsOnboarding: false });
  });
  test("unknown steps, bad types and extra fields are rejected or ignored", async () => {
    const a = await login();
    expect((await put("/api/onboarding", { step: "hack" }, a)).status).toBe(400);
    expect((await put("/api/onboarding", { tourIndex: "two" }, a)).status).toBe(400);
    expect((await put("/api/onboarding", { tourIndex: 99 }, a)).status).toBe(400);
    await put("/api/onboarding", { step: "tour", expires_at: "2999-01-01", isAdmin: true }, a);
    expect(await first(env.DB, "SELECT expires_at FROM members WHERE jellyfin_id = 'u1'")).toEqual({ expires_at: null });
    expect(JSON.stringify((await state(a)).state)).not.toContain("isAdmin");
  });
  test("it needs a session and a csrf token", async () => {
    expect((await app.request("/api/onboarding", {}, env)).status).toBe(401);
    const a = await login();
    expect((await put("/api/onboarding", { step: "tour" }, { cookie: a.cookie })).status).toBe(403);
  });
  test("the expiry reminder choice is saved", async () => {
    const a = await login();
    expect((await put("/api/me/reminders", { on: false }, a)).status).toBe(200);
    expect(await first(env.DB, "SELECT reminders_on FROM members WHERE jellyfin_id = 'u1'")).toEqual({ reminders_on: 0 });
  });
});

describe("quick connect", () => {
  test("authorises the code for the signed-in member", async () => {
    const a = await login();
    expect((await post("/api/onboarding/quickconnect", { code: "123456" }, a)).status).toBe(200);
    expect(qc).toEqual([["u1", "123456"]]);
  });
  test("a malformed code is rejected without calling Jellyfin", async () => {
    const a = await login();
    for (const code of ["12345", "abcdef", "1234567", "", "12 456"]) expect((await post("/api/onboarding/quickconnect", { code }, a)).status).toBe(400);
    expect(qc).toHaveLength(0);
  });
  test("Jellyfin refusing the code gives a friendly 422", async () => {
    qcFail = true;
    const a = await login();
    expect((await post("/api/onboarding/quickconnect", { code: "123456" }, a)).status).toBe(422);
  });
  test("the 11th try in 15 minutes is rate limited", async () => {
    const a = await login();
    for (let i = 0; i < 10; i++) await post("/api/onboarding/quickconnect", { code: "123456" }, a);
    expect((await post("/api/onboarding/quickconnect", { code: "123456" }, a)).status).toBe(429);
  });
});

describe("admins", () => {
  test("skip the welcome and email verification; members still get them", async () => {
    const admin = await post("/api/signin", { username: "olivia", password: "x" });
    const cookie = admin.headers.get("set-cookie")!.split(";")[0];
    expect(((await (await app.request("/api/onboarding", { headers: { cookie } }, env)).json()) as any).needsOnboarding).toBe(false);
    expect((await app.request("/welcome", { headers: { cookie }, redirect: "manual" }, env)).headers.get("location")).toBe("/");
    const m = await login();
    expect((await state(m)).needsOnboarding).toBe(true);
  });
});
