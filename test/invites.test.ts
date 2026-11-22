import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { all, first, run } from "../src/db";
import type { Env } from "../src/env";

let jfUsers: Array<{ id: string; name: string; isAdmin: boolean; isDisabled: boolean }>;
let created: string[], deleted: string[], policies: Array<[string, any]>, seerrImports: string[], seerrEmails: Array<[number, string]>, seerrPerms: Array<[number, string]>, seerrDeleted: number[], failSeerrPerms: boolean, failSeerrEmail: boolean, failDelete: boolean, sent: Array<{ to: string; text: string }>;
let nextId: string, failPolicy: boolean, failSeerr: boolean, failMailTo: string | null;

const jf = () => ({
  authenticate: async (n: string) => { const u = jfUsers.find((x) => x.name === n); return u ? { id: u.id, name: u.name, isAdmin: u.isAdmin } : null; },
  getUser: async (id: string) => jfUsers.find((u) => u.id === id) ?? null,
  listUsers: async () => jfUsers,
  createUser: async (name: string) => { created.push(name); const u = { id: nextId, name, isAdmin: false, isDisabled: false }; jfUsers.push(u); return u; },
  deleteUser: async (id: string) => { if (failDelete) throw new Error("delete boom"); deleted.push(id); },
  setPolicy: async (id: string, p: any) => { if (failPolicy) throw new Error("policy boom"); policies.push([id, p]); },
});
const seerr = () => ({
  importUser: async (id: string) => { if (failSeerr) throw new Error("seerr down"); seerrImports.push(id); return 42; },
  setEmail: async (id: number, email: string) => { if (failSeerrEmail) throw new Error("email boom"); seerrEmails.push([id, email]); },
  setPermissions: async (id: number, r: string) => { if (failSeerrPerms) throw new Error("perm boom"); seerrPerms.push([id, r]); },
  deleteUser: async (id: number) => void seerrDeleted.push(id),
});
const mailer = () => ({ send: async (to: string, _s: string, _h: string, text: string) => { if (to === failMailTo) throw new Error("bounce"); sent.push({ to, text }); } });
const app = createApp({ jellyfin: jf as never, seerr: seerr as never, mailer: mailer as never });

const req = (path: string, init: RequestInit = {}, e: Env = env) => app.request(path, init, e);
const json = (body: unknown, headers: Record<string, string> = {}) => ({ method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

async function adminLogin() {
  const r = await req("/api/signin", json({ username: "olivia", password: "x" }));
  return { cookie: r.headers.get("set-cookie")!.split(";")[0], csrf: ((await r.json()) as any).csrf as string };
}
const admin = (a: { cookie: string; csrf: string }) => ({ cookie: a.cookie, "x-csrf-token": a.csrf });
async function makeInvite(body: Record<string, unknown> = {}) {
  const a = await adminLogin();
  const res = await req("/api/admin/invites", json({ presetId: "preset-standard", maxUses: 1, expiresInDays: 7, ...body }, admin(a)));
  return { res, a, data: (await res.json()) as any };
}
const tokenOf = (link: string) => link.split("/join/")[1];
const prodEnv = { ...env, ENVIRONMENT: "prod" } as Env; // the test config is beta, which only allows beta- names
const redeem = (token: string, over: Record<string, unknown> = {}, e: Env = prodEnv) => req("/api/invites/redeem", json({ token, username: "newbie", password: "a-good-password", ...over }), e);

beforeEach(async () => {
  jfUsers = [{ id: "u2", name: "olivia", isAdmin: true, isDisabled: false }, { id: "u1", name: "Maya", isAdmin: false, isDisabled: false }];
  created = []; deleted = []; policies = []; seerrImports = []; seerrEmails = []; sent = []; nextId = "new1"; failPolicy = false; failSeerr = false; failMailTo = null; seerrPerms = []; seerrDeleted = []; failSeerrPerms = false; failSeerrEmail = false; failDelete = false;
  for (const t of ["invites", "members", "sessions", "rate_limits", "audit"]) await run(env.DB, `DELETE FROM ${t}`);
});

describe("creating invites", () => {
  test("only a hash is stored, and the clear link is returned once", async () => {
    const { res, data } = await makeInvite();
    expect(res.status).toBe(201);
    const token = tokenOf(data.invites[0].link);
    const row = await first<{ token_hash: string }>(env.DB, "SELECT token_hash FROM invites");
    expect(row!.token_hash).toHaveLength(64);
    expect(row!.token_hash).not.toContain(token);
    const audit = JSON.stringify(await all(env.DB, "SELECT * FROM audit"));
    expect(audit).not.toContain(token);
  });
  test("emailing several recipients reports each failure separately", async () => {
    failMailTo = "bad@example.com";
    const { data } = await makeInvite({ emails: ["good@example.com", "bad@example.com"] });
    expect(data.invites.map((i: any) => [i.email, i.ok])).toEqual([["good@example.com", true], ["bad@example.com", false]]);
    expect(sent.map((s) => s.to)).toEqual(["good@example.com"]);
    expect(sent[0].text).toContain("/join/");
  });
  test("a member cannot create invites", async () => {
    const r = await req("/api/signin", json({ username: "Maya", password: "x" }));
    const c = r.headers.get("set-cookie")!.split(";")[0], csrf = ((await r.json()) as any).csrf;
    expect((await req("/api/admin/invites", json({ presetId: "preset-standard", maxUses: 1, expiresInDays: 7 }, { cookie: c, "x-csrf-token": csrf }))).status).toBe(403);
  });
  test("resend is rate limited and rotates the link so the old one dies", async () => {
    const { a, data } = await makeInvite({ emails: ["good@example.com"] });
    const first = tokenOf(data.invites[0].link), id = data.invites[0].id;
    await run(env.DB, "UPDATE invites SET last_sent_at = ?", new Date(Date.now() - 120_000).toISOString());
    const r1 = await req(`/api/admin/invites/${id}/resend`, json({}, admin(a)));
    expect(r1.status).toBe(200);
    expect((await redeem(first)).status).toBe(410);
    expect((await req(`/api/admin/invites/${id}/resend`, json({}, admin(a)))).status).toBe(429);
  });
  test("a failed resend leaves the existing link working", async () => {
    const { a, data } = await makeInvite({ emails: ["good@example.com"] });
    const first = tokenOf(data.invites[0].link), id = data.invites[0].id;
    await run(env.DB, "UPDATE invites SET last_sent_at = ?", new Date(Date.now() - 120_000).toISOString());
    failMailTo = "good@example.com";
    expect((await req(`/api/admin/invites/${id}/resend`, json({}, admin(a)))).status).toBe(502);
    expect((await redeem(first)).status).toBe(201);
  });
  test("the public lookup shows what an invite grants, and 404s for junk", async () => {
    const { data } = await makeInvite();
    const ok = await req(`/api/invites/${tokenOf(data.invites[0].link)}`);
    expect(await ok.json()).toMatchObject({ presetName: "Standard", grants: expect.any(Array) });
    expect((await req("/api/invites/not-a-token")).status).toBe(404);
  });
});

describe("redeeming", () => {
  test("creates the user, applies the preset, imports to Seerr, records the member and audits", async () => {
    const { data } = await makeInvite();
    const res = await redeem(tokenOf(data.invites[0].link), { contactEmail: "n@example.com" });
    expect(res.status).toBe(201);
    expect(created).toEqual(["newbie"]);
    expect(policies[0]).toEqual(["new1", expect.objectContaining({ EnableAllFolders: true, RemoteClientBitrateLimit: 20000000 })]);
    expect(seerrImports).toEqual(["new1"]);
    expect(seerrEmails).toEqual([]); // unverified, so not pushed to Seerr
    expect(seerrPerms).toEqual([[42, "request"]]);
    const m = await first<any>(env.DB, "SELECT * FROM members WHERE jellyfin_id = 'new1'");
    expect(m).toMatchObject({ username: "newbie", contact_email: "n@example.com", email_verified: 0, preset_id: "preset-standard" });
    expect(JSON.parse(m.onboarding_state)).toEqual({ kind: "new", step: "device" });
    expect(Date.parse(m.expires_at) - Date.now()).toBeGreaterThan(364 * 86400_000);
    expect((await first<any>(env.DB, "SELECT uses FROM invites"))!.uses).toBe(1);
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'invite.redeem'")).not.toBeNull();
  });
  test("a contact email matching the invited address is marked verified", async () => {
    const { data } = await makeInvite({ emails: ["same@example.com"] });
    await redeem(tokenOf(data.invites[0].link), { contactEmail: "SAME@example.com" });
    expect((await first<any>(env.DB, "SELECT email_verified FROM members WHERE jellyfin_id = 'new1'"))!.email_verified).toBe(1);
    expect(seerrEmails).toEqual([[42, "SAME@example.com"]]);
  });
  test("a preset with no membership length gives no expiry", async () => {
    const { data } = await makeInvite({ presetId: "preset-family" });
    await redeem(tokenOf(data.invites[0].link));
    expect((await first<any>(env.DB, "SELECT expires_at FROM members WHERE jellyfin_id = 'new1'"))!.expires_at).toBeNull();
  });
  test.each([["expired"], ["used up"], ["unknown"]])("%s invite is refused with 410", async (kind) => {
    const { data } = await makeInvite();
    const token = tokenOf(data.invites[0].link);
    if (kind === "expired") await run(env.DB, "UPDATE invites SET expires_at = '2020-01-01T00:00:00Z'");
    if (kind === "used up") { expect((await redeem(token)).status).toBe(201); }
    const res = await redeem(kind === "unknown" ? "f".repeat(48) : token, { username: "second" });
    expect(res.status).toBe(410);
    expect(created.filter((n) => n === "second")).toHaveLength(0);
  });
  test("a username that exists in Jellyfin, in any letter case, is refused and the invite is not consumed", async () => {
    const { data } = await makeInvite();
    const res = await redeem(tokenOf(data.invites[0].link), { username: "MAYA" });
    expect(res.status).toBe(409);
    expect(created).toHaveLength(0);
    expect((await first<any>(env.DB, "SELECT uses FROM invites"))!.uses).toBe(0);
  });
  test("unusual but valid names work and bad ones are refused", async () => {
    for (const [name, status] of [["Zoë", 201], ["O'Neil Jr", 201], ["bad/name", 400], ["", 400], ["x".repeat(65), 400]] as const) {
      nextId = `id-${name.length}-${status}-${Math.random()}`;
      const { data } = await makeInvite();
      expect((await redeem(tokenOf(data.invites[0].link), { username: name })).status, name).toBe(status);
    }
  });
  test("a short password is refused without consuming the invite", async () => {
    const { data } = await makeInvite();
    expect((await redeem(tokenOf(data.invites[0].link), { password: "short" })).status).toBe(400);
    expect((await first<any>(env.DB, "SELECT uses FROM invites"))!.uses).toBe(0);
  });
  test("if saving the member fails, the Jellyfin user is deleted and the invite is released", async () => {
    await run(env.DB, "INSERT INTO members (jellyfin_id, username) VALUES ('new1','clash')");
    const { data } = await makeInvite();
    const res = await redeem(tokenOf(data.invites[0].link));
    expect(res.status).toBe(500);
    expect(deleted).toEqual(["new1"]);
    expect((await first<any>(env.DB, "SELECT uses FROM invites"))!.uses).toBe(0);
  });
  test("if applying the preset fails, nothing is left behind", async () => {
    failPolicy = true;
    const { data } = await makeInvite();
    expect((await redeem(tokenOf(data.invites[0].link))).status).toBe(502);
    expect(deleted).toEqual(["new1"]);
    expect(await first(env.DB, "SELECT * FROM members WHERE jellyfin_id = 'new1'")).toBeNull();
    expect((await first<any>(env.DB, "SELECT uses FROM invites"))!.uses).toBe(0);
  });
  test("a Seerr failure does not undo the account but is audited", async () => {
    failSeerr = true;
    const { data } = await makeInvite();
    expect((await redeem(tokenOf(data.invites[0].link))).status).toBe(201);
    expect(deleted).toHaveLength(0);
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'seerr.import_failed'")).not.toBeNull();
  });
  test("a family invite gives auto-approve rights in Seerr", async () => {
    const { data } = await makeInvite({ presetId: "preset-family" });
    await redeem(tokenOf(data.invites[0].link));
    expect(seerrPerms).toEqual([[42, "auto"]]);
  });
  test("if Seerr rights cannot be set, the imported Seerr user is removed and it is audited", async () => {
    failSeerrPerms = true;
    const { data } = await makeInvite();
    expect((await redeem(tokenOf(data.invites[0].link))).status).toBe(201);
    expect(seerrDeleted).toEqual([42]);
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'seerr.permissions_failed'")).not.toBeNull();
  });
  test("if Seerr only refuses the email, the member keeps their Seerr account and rights, and it is audited", async () => {
    failSeerrEmail = true;
    const { data } = await makeInvite({ emails: ["same@example.com"] });
    expect((await redeem(tokenOf(data.invites[0].link), { contactEmail: "same@example.com" })).status).toBe(201);
    expect(seerrDeleted).toEqual([]);
    expect(await first(env.DB, "SELECT seerr_user_id AS s FROM members WHERE jellyfin_id = 'new1'")).toEqual({ s: 42 });
    expect(await first(env.DB, "SELECT 1 AS x FROM audit WHERE action = 'seerr.email_failed'")).not.toBeNull();
  });
  test("the Seerr id is not stored when the rights step fails", async () => {
    failSeerrPerms = true;
    const { data } = await makeInvite();
    await redeem(tokenOf(data.invites[0].link));
    expect(await first(env.DB, "SELECT seerr_user_id AS s FROM members WHERE jellyfin_id = 'new1'")).toEqual({ s: null });
  });
  test("a fully successful redeem stores the Seerr id", async () => {
    const { data } = await makeInvite();
    await redeem(tokenOf(data.invites[0].link));
    expect(await first(env.DB, "SELECT seerr_user_id AS s FROM members WHERE jellyfin_id = 'new1'")).toEqual({ s: 42 });
  });
  test("a username that looks like an email address is refused", async () => {
    const { data } = await makeInvite();
    expect((await redeem(tokenOf(data.invites[0].link), { username: "victim@example.com" })).status).toBe(400);
    expect(created).toHaveLength(0);
  });
  test("if the rollback delete fails, the invite stays used and the orphan is audited and disabled", async () => {
    failPolicy = true; failDelete = true;
    const { data } = await makeInvite();
    expect((await redeem(tokenOf(data.invites[0].link))).status).toBe(502);
    expect((await first<any>(env.DB, "SELECT uses FROM invites"))!.uses).toBe(1);
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'redeem.orphan'")).not.toBeNull();
  });
  test("two simultaneous redemptions of a single-use invite create one account", async () => {
    const { data } = await makeInvite();
    const t = tokenOf(data.invites[0].link);
    const rs = await Promise.all([redeem(t, { username: "racer1" }), redeem(t, { username: "racer2" })]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 410]);
  });
  test("beta only accepts beta- usernames", async () => {
    const { data } = await makeInvite();
    expect((await redeem(tokenOf(data.invites[0].link), {}, env)).status).toBe(400);
    expect((await redeem(tokenOf(data.invites[0].link), { username: "beta-newbie" }, env)).status).toBe(201);
  });
});

describe("invite email preview", () => {
  test("renders the real invite email for an admin, with a placeholder link, and refuses members and unknown access levels", async () => {
    const a = await adminLogin();
    const ok = await req("/api/admin/invites/preview?preset=preset-standard&days=7", { headers: admin(a) });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-security-policy")).toContain("default-src 'none'");
    const html = await ok.text();
    expect(html).toContain("Accept invite"); expect(html).toContain("/join/example-invite-link"); expect(html).toContain("Standard");
    expect((await req("/api/admin/invites/preview?preset=nope", { headers: admin(a) })).status).toBe(404);
    expect((await req("/api/admin/invites/preview?preset=preset-standard")).status).toBe(401);
  });
});
