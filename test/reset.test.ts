import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { first, run, all } from "../src/db";

const users: Record<string, any> = {
  u1: { id: "u1", name: "maya", isAdmin: false, isDisabled: false },
};
let sent: Array<{ to: string; subject: string; text: string }>;
let pwSet: Array<[string, string]>;
let devicesCleared: string[];
const app = createApp({
  jellyfin: (() => ({
    authenticate: async (n: string, pw: string) => (n === "maya" && pw === "x" ? { id: "u1", name: "maya", isAdmin: false } : null),
    getUser: async (id: string) => users[id] ?? null,
    setPassword: async (id: string, pw: string) => void pwSet.push([id, pw]),
    deleteDevices: async (id: string) => void devicesCleared.push(id),
  })) as never,
  mailer: (() => ({ send: async (to: string, subject: string, _h: string, text: string) => void sent.push({ to, subject, text }) })) as never,
});

beforeEach(async () => {
  sent = []; pwSet = []; devicesCleared = [];
  for (const t of ["members", "reset_codes", "email_codes", "sessions", "rate_limits", "audit"]) await run(env.DB, `DELETE FROM ${t}`);
  await run(env.DB, "INSERT INTO members (jellyfin_id, username, contact_email, email_verified) VALUES ('u1','maya','maya@example.com',1)");
  await run(env.DB, "INSERT INTO members (jellyfin_id, username, contact_email, email_verified) VALUES ('u9','unverified','x@example.com',0)");
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }, env);
const request = (identifier: string) => post("/api/reset/request", { identifier });
const verify = (identifier: string, code: string, newPassword = "a-new-password") => post("/api/reset/verify", { identifier, code, newPassword });
const codeOf = () => sent.at(-1)!.text.match(/\b(\d{6})\b/)![1];

describe("reset request", () => {
  test("unknown, unverified and valid identifiers get an identical response", async () => {
    const bodies = [];
    for (const id of ["nobody", "unverified", "maya"]) {
      const r = await request(id);
      bodies.push([r.status, await r.json()]);
    }
    expect(bodies[0]).toEqual(bodies[1]);
    expect(bodies[1]).toEqual(bodies[2]);
    expect(bodies[0][0]).toBe(200);
  });
  test("only a verified address receives a code, by username or by email", async () => {
    await request("nobody"); await request("unverified");
    expect(sent).toHaveLength(0);
    await request("MAYA@example.com");
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("maya@example.com");
    expect(sent[0].subject).toContain(codeOf());
  });
  test("the code is stored hashed, never in clear", async () => {
    await request("maya");
    const row = await first<{ code_hash: string }>(env.DB, "SELECT code_hash FROM reset_codes");
    expect(row!.code_hash).not.toContain(codeOf());
    expect(row!.code_hash).toHaveLength(64);
  });
  test("a second request inside 30 seconds is 429, for real and unknown accounts alike", async () => {
    await request("maya"); await request("nobody");
    expect((await request("maya")).status).toBe(429);
    expect((await request("nobody")).status).toBe(429);
  });
});

test("non-ASCII usernames and addresses are matched regardless of case", async () => {
  await run(env.DB, "INSERT INTO members (jellyfin_id, username, contact_email, email_verified) VALUES ('u7','Élodie','Élodie@Example.com',1)");
  expect((await request("élodie")).status).toBe(200);
  expect(sent.at(-1)).toMatchObject({ to: "Élodie@Example.com" });
});

describe("reset verify", () => {
  test("a correct code sets the password, signs out devices and sessions, and emails a notice", async () => {
    await request("maya");
    await run(env.DB, "INSERT INTO sessions (id, jellyfin_id, username, is_admin, expires_at, checked_at, csrf) VALUES ('s1','u1','maya',0,'2999-01-01','2999-01-01','c')");
    const res = await verify("maya", codeOf());
    expect(res.status).toBe(200);
    expect(pwSet).toEqual([["u1", "a-new-password"]]);
    expect(devicesCleared).toEqual(["u1"]);
    expect(await first(env.DB, "SELECT id FROM sessions")).toBeNull();
    expect(sent.at(-1)!.subject).toMatch(/password was changed/i);
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'password.reset'")).not.toBeNull();
  });
  test("a code cannot be used twice", async () => {
    await request("maya");
    const code = codeOf();
    expect((await verify("maya", code)).status).toBe(200);
    expect((await verify("maya", code)).status).toBe(400);
  });
  test("five wrong guesses destroy the code, so even the right one then fails", async () => {
    await request("maya");
    const right = codeOf();
    const wrong = right === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect((await verify("maya", wrong)).status).toBe(400);
    expect((await verify("maya", right)).status).toBe(400);
    expect(pwSet).toHaveLength(0);
  });
  test("an expired code fails", async () => {
    await request("maya");
    await run(env.DB, "UPDATE reset_codes SET expires_at = '2020-01-01T00:00:00Z'");
    expect((await verify("maya", codeOf())).status).toBe(400);
  });
  test("an unknown account gets the same error as a wrong code", async () => {
    await request("maya");
    const a = await verify("nobody", "123456"), b = await verify("maya", codeOf() === "123456" ? "654321" : "123456");
    expect(a.status).toBe(400);
    expect(await a.json()).toEqual(await b.json());
  });
  test("a weak new password is rejected without spending the code", async () => {
    await request("maya");
    const code = codeOf();
    expect((await verify("maya", code, "short")).status).toBe(400);
    expect((await verify("maya", code)).status).toBe(200);
  });
});

test("wrong guesses across re-issued codes share one hourly budget per account", async () => {
  const clear = () => run(env.DB, "DELETE FROM rate_limits WHERE key LIKE 'reset:cool:%' OR key LIKE 'reset:ip:%'");
  for (let round = 0; round < 2; round++) {
    await clear(); await request("maya");
    const wrong = codeOf() === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await verify("maya", wrong);
  }
  await clear(); await request("maya");
  expect((await verify("maya", codeOf())).status).toBe(400);
  expect(pwSet).toHaveLength(0);
});

test("guesses with no live code do not spend the account's budget", async () => {
  for (let i = 0; i < 12; i++) await verify("maya", "123456");
  await request("maya");
  expect((await verify("maya", codeOf())).status).toBe(200);
});

test("at most 5 codes per account per hour are issued, silently", async () => {
  for (let i = 0; i < 7; i++) {
    await run(env.DB, "DELETE FROM rate_limits WHERE key LIKE 'reset:cool:%' OR key LIKE 'reset:ip:%'");
    expect((await request("maya")).status).toBe(200);
  }
  expect(sent).toHaveLength(5);
});

describe("contact email verification", () => {
  async function login() {
    const r = await post("/api/signin", { username: "maya", password: "x" });
    return { cookie: r.headers.get("set-cookie")!.split(";")[0], csrf: ((await r.json()) as any).csrf as string };
  }
  const authed = (path: string, body: unknown, a: { cookie: string; csrf: string }) => post(path, { password: "x", ...(body as object) }, { cookie: a.cookie, "x-csrf-token": a.csrf });
  const clearCooldowns = () => run(env.DB, "DELETE FROM rate_limits WHERE key LIKE 'emailcode:cool:%'");

  test("a code goes to the new address, and confirming it marks the address verified", async () => {
    const a = await login();
    await run(env.DB, "UPDATE members SET email_verified = 0, contact_email = NULL WHERE jellyfin_id = 'u1'");
    expect((await authed("/api/email/send-code", { email: "new@example.com" }, a)).status).toBe(200);
    expect(sent.at(-1)!.to).toBe("new@example.com");
    expect((await authed("/api/email/confirm", { code: codeOf() }, a)).status).toBe(200);
    expect(await first(env.DB, "SELECT contact_email, email_verified FROM members WHERE jellyfin_id = 'u1'")).toEqual({ contact_email: "new@example.com", email_verified: 1 });
  });
  test("confirming a new address cancels a sign-in link already sent to the old one", async () => {
    const a = await login();
    await run(env.DB, "INSERT INTO magic_links (token_hash, jellyfin_id, expires_at) VALUES ('h','u1','2999-01-01T00:00:00Z')");
    await authed("/api/email/send-code", { email: "new@example.com" }, a);
    await authed("/api/email/confirm", { code: codeOf() }, a);
    expect(await first(env.DB, "SELECT 1 AS x FROM magic_links WHERE jellyfin_id = 'u1'")).toBeNull();
  });
  test("the old address stays in force until the new one is confirmed", async () => {
    const a = await login();
    await authed("/api/email/send-code", { email: "other@example.com" }, a);
    expect(await first(env.DB, "SELECT email_verified FROM members WHERE jellyfin_id = 'u1'")).toEqual({ email_verified: 1 }); // old, still-verified address stays until the new one is confirmed
    expect((await all(env.DB, "SELECT * FROM email_codes"))).toHaveLength(1);
  });
  test("changing the address needs the current password", async () => {
    const a = await login();
    expect((await authed("/api/email/send-code", { email: "new@example.com", password: "wrong" }, a)).status).toBe(403);
    expect(sent).toHaveLength(0);
  });
  test("confirming a new address warns the previous verified one", async () => {
    const a = await login();
    await authed("/api/email/send-code", { email: "new@example.com" }, a);
    await authed("/api/email/confirm", { code: codeOf() }, a);
    expect(sent.at(-1)).toMatchObject({ to: "maya@example.com" });
    expect(sent.at(-1)!.subject).toMatch(/address on your Jellypass account was changed/i);
  });
  test("the confirmation email says it is for confirming an address", async () => {
    const a = await login();
    await authed("/api/email/send-code", { email: "new@example.com" }, a);
    expect(sent[0].subject).toMatch(/^Confirm your email address/);
  });
  test("one recipient address gets at most 3 codes an hour", async () => {
    const a = await login();
    for (let i = 0; i < 3; i++) { await clearCooldowns(); expect((await authed("/api/email/send-code", { email: "victim@example.com" }, a)).status).toBe(200); }
    await clearCooldowns();
    expect((await authed("/api/email/send-code", { email: "Victim@example.com" }, a)).status).toBe(429);
  });
  test("five wrong confirmations lock the code", async () => {
    const a = await login();
    await authed("/api/email/send-code", { email: "new@example.com" }, a);
    const right = codeOf(), wrong = right === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect((await authed("/api/email/confirm", { code: wrong }, a)).status).toBe(400);
    expect((await authed("/api/email/confirm", { code: right }, a)).status).toBe(400);
  });
  test("an invalid address is rejected and needs a session", async () => {
    const a = await login();
    expect((await authed("/api/email/send-code", { email: "not-an-email" }, a)).status).toBe(400);
    expect((await post("/api/email/send-code", { email: "a@b.co" })).status).toBe(401);
  });
});
