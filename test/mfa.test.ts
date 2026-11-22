import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { run } from "../src/db";
import { b64u, base32, totpCode, totpMatch } from "../src/mfa";

const users: Record<string, any> = { u1: { id: "u1", name: "maya", isAdmin: false, isDisabled: false } };
const app = createApp({
  jellyfin: (() => ({
    authenticate: async (n: string, p: string) => (n === "maya" && p === "pw" ? { id: "u1", name: "maya", isAdmin: false } : null),
    getUser: async (id: string) => users[id] ?? null,
  })) as never,
  mailer: (() => ({ send: async () => {} })) as never,
});
const req = (method: string, path: string, body?: unknown, h: Record<string, string> = {}) =>
  app.request(path, { method, headers: { "content-type": "application/json", ...h }, body: body === undefined ? undefined : JSON.stringify(body) }, env);
const post = (path: string, body: unknown, h: Record<string, string> = {}) => req("POST", path, body, h);
async function login() {
  const r = await post("/api/signin", { username: "maya", password: "pw" });
  const j = (await r.json()) as any;
  return { cookie: r.headers.get("set-cookie")!.split(";")[0], "x-csrf-token": j.csrf as string };
}
const step = () => Math.floor(Date.now() / 30_000);
/** Turn on an authenticator app for maya; returns her secret and recovery codes. */
async function enableTotp(a: Record<string, string>) {
  const { secret } = (await (await post("/api/account/2fa/totp/start", { password: "pw" }, a)).json()) as any;
  const r = await post("/api/account/2fa/totp/enable", { code: await totpCode(secret, step()) }, a);
  expect(r.status).toBe(200);
  return { secret, codes: ((await r.json()) as any).recoveryCodes as string[] };
}
const firstStep = async (pw = "pw") => (await (await post("/api/signin", { username: "maya", password: pw })).json()) as any;

beforeEach(async () => {
  for (const t of ["members", "sessions", "rate_limits", "audit", "signins", "mfa_totp", "passkeys", "mfa_recovery", "mfa_challenges", "magic_links"]) await run(env.DB, `DELETE FROM ${t}`);
});

describe("authenticator app codes", () => {
  test("matches the RFC 6238 test vector", async () => {
    const secret = base32(new TextEncoder().encode("12345678901234567890"));
    expect(await totpCode(secret, Math.floor(59 / 30))).toBe("287082"); // 94287082 in the RFC's 8-digit form
    expect(await totpMatch(secret, "287082", 59_000)).toBe(1);
    expect(await totpMatch(secret, "287082", 59_000 + 90_000)).toBeNull(); // too far from now
    expect(await totpMatch(secret, "12345", 59_000)).toBeNull();
  });

  test("nothing changes for a member without it", async () => {
    const r = await post("/api/signin", { username: "maya", password: "pw" });
    expect(r.headers.get("set-cookie")).toMatch(/jp_session/);
  });

  test("with it on, the password alone gives no session, the code does", async () => {
    const a = await login();
    const { secret } = await enableTotp(a);
    const r = await post("/api/signin", { username: "maya", password: "pw" });
    expect(r.headers.get("set-cookie")).toBeNull();
    const { mfa } = (await r.json()) as any;
    expect(mfa).toMatchObject({ totp: true, passkey: false });
    expect((await post("/api/signin/2fa", { token: mfa.token, code: "000000" })).status).toBe(401);
    const ok = await post("/api/signin/2fa", { token: mfa.token, code: await totpCode(secret, step() + 1) }); // the next step is inside the allowed drift
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/jp_session/);
    expect((await post("/api/signin/2fa", { token: mfa.token, code: await totpCode(secret, step()) })).status).toBe(401); // the token worked once
  });

  test("a used code cannot be replayed, even with a fresh password step", async () => {
    const a = await login();
    const { secret } = await enableTotp(a); // enabling uses the current step
    const code = await totpCode(secret, step());
    const { mfa } = await firstStep();
    expect((await post("/api/signin/2fa", { token: mfa.token, code })).status).toBe(401);
  });

  test("guesses are limited per member, not per token", async () => {
    const a = await login();
    await enableTotp(a);
    for (let i = 0; i < 8; i++) expect((await post("/api/signin/2fa", { token: (await firstStep()).mfa.token, code: "111111" })).status).toBe(401);
    expect((await post("/api/signin/2fa", { token: (await firstStep()).mfa.token, code: "111111" })).status).toBe(429);
  });

  test("setup needs a right code; a wrong code leaves it off", async () => {
    const a = await login();
    await post("/api/account/2fa/totp/start", { password: "pw" }, a);
    expect((await post("/api/account/2fa/totp/enable", { code: "000000" }, a)).status).toBe(400);
    expect(((await (await req("GET", "/api/account/2fa", undefined, a)).json()) as any).totp).toBe(false);
    expect((await post("/api/signin", { username: "maya", password: "pw" })).headers.get("set-cookie")).toMatch(/jp_session/);
  });

  test("recovery codes work once each, and turning it off works", async () => {
    const a = await login();
    const { codes } = await enableTotp(a);
    expect(codes).toHaveLength(8);
    const use = async (code: string) => post("/api/signin/2fa", { token: (await firstStep()).mfa.token, code });
    expect((await use(codes[0])).status).toBe(200);
    expect((await use(codes[0])).status).toBe(401);
    expect((await use(codes[1].toUpperCase().replace("-", " "))).status).toBe(200); // forgiving about case and spacing
    expect((await req("DELETE", "/api/account/2fa/totp", { password: "nope" }, a)).status).toBe(403);
    expect((await req("DELETE", "/api/account/2fa/totp", { password: "pw" }, a)).status).toBe(200);
    expect((await post("/api/signin", { username: "maya", password: "pw" })).headers.get("set-cookie")).toMatch(/jp_session/);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM mfa_recovery").first("n")).toBe(0);
  });

  test("new recovery codes need the password and replace the old ones", async () => {
    const a = await login();
    const { codes } = await enableTotp(a);
    expect((await post("/api/account/2fa/recovery", {}, a)).status).toBe(403);
    const fresh = ((await (await post("/api/account/2fa/recovery", { password: "pw" }, a)).json()) as any).recoveryCodes as string[];
    expect(fresh).toHaveLength(8);
    expect((await post("/api/signin/2fa", { token: (await firstStep()).mfa.token, code: codes[0] })).status).toBe(401);
    expect((await post("/api/signin/2fa", { token: (await firstStep()).mfa.token, code: fresh[0] })).status).toBe(200);
  });

  test("the stored secret is encrypted", async () => {
    const a = await login();
    const { secret } = await enableTotp(a);
    expect(JSON.stringify(await env.DB.prepare("SELECT secret FROM mfa_totp").first())).not.toContain(secret);
  });

  test("emailed sign-in links stop working and cannot be switched on while it is on", async () => {
    const a = await login();
    await run(env.DB, "UPDATE members SET magic_on = 1, contact_email = 'm@example.com', email_verified = 1 WHERE jellyfin_id = 'u1'");
    await enableTotp(a);
    expect(await env.DB.prepare("SELECT magic_on FROM members WHERE jellyfin_id = 'u1'").first("magic_on")).toBe(0);
    const r = await req("PUT", "/api/account/magic", { on: true, password: "pw" }, a);
    expect(r.status).toBe(409);
    await run(env.DB, "UPDATE members SET magic_on = 1 WHERE jellyfin_id = 'u1'");
    await run(env.DB, "INSERT INTO magic_links (token_hash, jellyfin_id, expires_at) VALUES (?, 'u1', '2999-01-01T00:00:00Z')", "9a6e4fda1d6f8b3d4b3a8a0e8e9f5ab9f1c1b7d3c8c4d1d2f5b9c0a1d2e3f4a5");
    expect((await app.request("/magic/anything", { method: "POST" }, env)).status).toBe(400);
  });
});

/* A tiny CBOR writer, so the test can build the attestation object a real authenticator would send. */
const cb = (major: number, n: number) => (n < 24 ? [major << 5 | n] : n < 256 ? [major << 5 | 24, n] : [major << 5 | 25, n >> 8, n & 255]);
const cbBytes = (b: Uint8Array) => [...cb(2, b.length), ...b];
const cbText = (s: string) => [...cb(3, s.length), ...new TextEncoder().encode(s)];
const cbInt = (n: number) => (n >= 0 ? cb(0, n) : cb(1, -1 - n));
const cat = (...p: Array<ArrayLike<number>>) => Uint8Array.from(p.flatMap((x) => Array.from(x)));
const sha = async (b: BufferSource | string) => new Uint8Array(await crypto.subtle.digest("SHA-256", typeof b === "string" ? new TextEncoder().encode(b) : b));
const rpId = new URL(env.PUBLIC_URL).hostname, origin = new URL(env.PUBLIC_URL).origin;
const clientData = (type: string, challenge: string) => new TextEncoder().encode(JSON.stringify({ type, challenge, origin }));
/** DER-encode a raw r||s signature the way authenticators do. */
const toDer = (raw: Uint8Array) => {
  const int = (x: Uint8Array) => { let i = 0; while (i < 31 && x[i] === 0) i++; let v = x.slice(i); if (v[0] & 0x80) v = cat([0], v); return cat([2, v.length], v); };
  const body = cat(int(raw.slice(0, 32)), int(raw.slice(32)));
  return cat([0x30, body.length], body);
};

async function addPasskey(a: Record<string, string>, pair: CryptoKeyPair, credId: Uint8Array) {
  const opts = (await (await post("/api/account/2fa/passkey/options", { password: "pw" }, a)).json()) as any;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  const x = Uint8Array.from(atob(jwk.x!.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)), y = Uint8Array.from(atob(jwk.y!.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const cose = cat([0xa5], cbInt(1), cbInt(2), cbInt(3), cbInt(-7), cbInt(-1), cbInt(1), cbInt(-2), cbBytes(x), cbInt(-3), cbBytes(y));
  const authData = cat(await sha(rpId), [0x45], [0, 0, 0, 0], new Uint8Array(16), [credId.length >> 8, credId.length & 255], credId, cose);
  const attestationObject = cat([0xa3], cbText("fmt"), cbText("none"), cbText("attStmt"), [0xa0], cbText("authData"), cbBytes(authData));
  return post("/api/account/2fa/passkey", { id: b64u(credId), name: "Test key", clientDataJSON: b64u(clientData("webauthn.create", opts.challenge)), attestationObject: b64u(attestationObject) }, a);
}
async function assertion(pair: CryptoKeyPair, credId: Uint8Array, challenge: string, counter: number, over?: { origin?: string }) {
  const authData = cat(await sha(rpId), [0x05], [counter >>> 24, (counter >> 16) & 255, (counter >> 8) & 255, counter & 255]);
  const cd = over?.origin ? new TextEncoder().encode(JSON.stringify({ type: "webauthn.get", challenge, origin: over.origin })) : clientData("webauthn.get", challenge);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, cat(authData, await sha(cd))));
  return { id: b64u(credId), clientDataJSON: b64u(cd), authenticatorData: b64u(authData), signature: b64u(toDer(sig)) };
}

describe("passkeys", () => {
  const credId = crypto.getRandomValues(new Uint8Array(32));
  let pair: CryptoKeyPair;
  beforeEach(async () => { pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair; });

  test("register, then sign in with it", async () => {
    const a = await login();
    const added = await addPasskey(a, pair, credId);
    expect(added.status).toBe(200);
    expect(((await added.json()) as any).recoveryCodes).toHaveLength(8);
    const { mfa } = await firstStep();
    expect(mfa).toMatchObject({ totp: false, passkey: true });
    const opts = (await (await post("/api/signin/passkey/options", { token: mfa.token })).json()) as any;
    expect(opts.allowCredentials[0].id).toBe(b64u(credId));
    expect((await post("/api/signin/passkey", { token: mfa.token, ...(await assertion(pair, credId, opts.challenge, 1, { origin: "https://evil.example" })) })).status).toBe(401);
    const ok = await post("/api/signin/passkey", { token: mfa.token, ...(await assertion(pair, credId, opts.challenge, 1)) });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/jp_session/);
  });

  test("a wrong key, a replayed counter and a stranger's token all fail", async () => {
    const a = await login();
    await addPasskey(a, pair, credId);
    const go = async (p: CryptoKeyPair, counter: number) => {
      const { mfa } = await firstStep();
      const opts = (await (await post("/api/signin/passkey/options", { token: mfa.token })).json()) as any;
      return post("/api/signin/passkey", { token: mfa.token, ...(await assertion(p, credId, opts.challenge, counter)) });
    };
    const other = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
    expect((await go(other, 1)).status).toBe(401);
    expect((await go(pair, 5)).status).toBe(200);
    expect((await go(pair, 5)).status).toBe(401); // counter did not go up
    expect((await go(pair, 6)).status).toBe(200);
    expect((await post("/api/signin/passkey/options", { token: "made-up" })).status).toBe(401);
  });

  test("removing the last passkey turns it off; the list shows them", async () => {
    const a = await login();
    await addPasskey(a, pair, credId);
    const list = (await (await req("GET", "/api/account/2fa", undefined, a)).json()) as any;
    expect(list.passkeys).toMatchObject([{ id: b64u(credId), name: "Test key" }]);
    expect(list.recoveryLeft).toBe(8);
    expect((await req("DELETE", `/api/account/2fa/passkey/${b64u(credId)}`, { password: "nope" }, a)).status).toBe(403);
    expect((await req("DELETE", `/api/account/2fa/passkey/${b64u(credId)}`, { password: "pw" }, a)).status).toBe(200);
    expect((await post("/api/signin", { username: "maya", password: "pw" })).headers.get("set-cookie")).toMatch(/jp_session/);
  });

  test("a registration answering the wrong challenge is refused", async () => {
    const a = await login();
    await post("/api/account/2fa/passkey/options", { password: "pw" }, a);
    const r = await post("/api/account/2fa/passkey", { id: b64u(credId), clientDataJSON: b64u(clientData("webauthn.create", "different")), attestationObject: b64u(new Uint8Array([0xa0])) }, a);
    expect(r.status).toBe(400);
  });
});

describe("admin reset", () => {
  test("clears a member's second step and sessions, and says so in the users list", async () => {
    users.admin = { id: "admin", name: "boss", isAdmin: true, isDisabled: false };
    const a = await login();
    await enableTotp(a);
    const adminApp = createApp({ jellyfin: (() => ({ authenticate: async () => ({ id: "admin", name: "boss", isAdmin: true }), getUser: async (id: string) => users[id] ?? null, listUsers: async () => Object.values(users) })) as never, mailer: (() => ({ send: async () => {} })) as never });
    const r0 = await adminApp.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "boss", password: "x" }) }, env);
    const h = { cookie: r0.headers.get("set-cookie")!.split(";")[0], "x-csrf-token": ((await r0.json()) as any).csrf, "content-type": "application/json" };
    const list = (await (await adminApp.request("/api/admin/users", { headers: h }, env)).json()) as any[];
    expect(list.find((u) => u.id === "u1").twoFactor).toBe(true);
    expect((await adminApp.request("/api/admin/users/u1/reset-2fa", { method: "POST", headers: h, body: JSON.stringify({ password: "x" }) }, env)).status).toBe(200);
    expect((await adminApp.request("/api/admin/users/u1/reset-2fa", { method: "POST", headers: h, body: JSON.stringify({ password: "x" }) }, env)).status).toBe(400);
    expect((await adminApp.request("/api/admin/users/admin/reset-2fa", { method: "POST", headers: h, body: JSON.stringify({ password: "x" }) }, env)).status).toBe(403); // admins cannot be reset here
    expect((await app.request("/api/me", { headers: { cookie: a.cookie } }, env)).status).toBe(401);
    expect((await post("/api/signin", { username: "maya", password: "pw" })).headers.get("set-cookie")).toMatch(/jp_session/);
    delete users.admin;
  });
});
