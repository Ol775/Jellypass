import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { all, first, run } from "../src/db";
import { hashToken } from "../src/invites";
import { migrate } from "../src/migrate";

const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();
const jfUsers = [
  { id: "a1", name: "olivia", isAdmin: true, isDisabled: false },
  { id: "u1", name: "Maya", isAdmin: false, isDisabled: false },
  { id: "u2", name: "ben", isAdmin: false, isDisabled: false },
];
const jf = { listUsers: async () => jfUsers } as never;
const data = () => ({
  users: [
    { username: "maya", email: "maya@example.com", expiry: day(40) },
    { username: "ben", email: null, expiry: null },
    { username: "ghost", email: "g@example.com", expiry: day(5) },
    { username: "olivia", email: "o@example.com", expiry: day(5) },
  ],
  invites: [
    { code: "CODE-ONE-AAAAAAAAAAAA", remainingUses: 2, noLimit: false, validTill: day(10), email: "new@example.com", profile: "family" },
    { code: "CODE-TWO-BBBBBBBBBBBB", remainingUses: 0, noLimit: true, validTill: day(10), email: null, profile: "Unknown profile" },
    { code: "CODE-OLD-CCCCCCCCCCCC", remainingUses: 1, noLimit: false, validTill: day(-1), email: null, profile: "Standard" },
    { code: "CODE-USED-DDDDDDDDDDDD", remainingUses: 0, noLimit: false, validTill: day(10), email: null, profile: "Standard" },
  ],
});
const state = async () => JSON.stringify([await all(env.DB, "SELECT jellyfin_id, username, contact_email, email_verified, expires_at FROM members ORDER BY jellyfin_id"), await all(env.DB, "SELECT token_hash, preset_id, max_uses, uses, email, expires_at FROM invites ORDER BY token_hash")]);

beforeEach(async () => { for (const t of ["members", "invites", "audit", "sessions", "rate_limits"]) await run(env.DB, `DELETE FROM ${t}`); });

describe("migrate", () => {
  test("a dry run reports what would happen and writes nothing", async () => {
    const r = await migrate({ db: env.DB, jf }, data(), { dryRun: true });
    expect(r.dryRun).toBe(true);
    expect(r.users).toMatchObject({ matched: 2, unmatched: ["ghost"], skippedAdmins: ["olivia"] });
    expect(r.invites).toMatchObject({ imported: 2 });
    expect(await state()).toBe(JSON.stringify([[], []]));
    expect(await first(env.DB, "SELECT * FROM audit")).toBeNull();
  });
  test("a real run imports members with expiry and unverified emails; unmatched users are reported, not created", async () => {
    await migrate({ db: env.DB, jf }, data(), { dryRun: false });
    const m = await first<any>(env.DB, "SELECT * FROM members WHERE jellyfin_id = 'u1'");
    expect(m).toMatchObject({ username: "Maya", contact_email: "maya@example.com", email_verified: 0 });
    expect(Date.parse(m.expires_at)).toBeCloseTo(Date.parse(data().users[0].expiry!), -3);
    expect(await first(env.DB, "SELECT * FROM members WHERE username = 'ghost'")).toBeNull();
    expect(await first(env.DB, "SELECT * FROM members WHERE jellyfin_id = 'a1'")).toBeNull(); // admins are not imported
    expect(await first(env.DB, "SELECT * FROM audit WHERE action = 'migrate.jfa_go'")).not.toBeNull();
  });
  test("trustEmails marks the imported addresses as confirmed", async () => {
    await migrate({ db: env.DB, jf }, data(), { dryRun: false, trustEmails: true });
    expect((await first<any>(env.DB, "SELECT email_verified FROM members WHERE jellyfin_id = 'u1'"))!.email_verified).toBe(1);
  });
  test("running twice leaves exactly the same state", async () => {
    await migrate({ db: env.DB, jf }, data(), { dryRun: false });
    const once = await state();
    const second = await migrate({ db: env.DB, jf }, data(), { dryRun: false });
    expect(await state()).toBe(once);
    expect(second.invites.imported).toBe(0);
  });
  test("a re-run does not undo changes made in Jellypass since", async () => {
    await migrate({ db: env.DB, jf }, data(), { dryRun: false });
    const mine = day(400);
    await run(env.DB, "UPDATE members SET expires_at = ?, contact_email = 'mine@example.com', email_verified = 1 WHERE jellyfin_id = 'u1'", mine);
    await migrate({ db: env.DB, jf }, data(), { dryRun: false });
    expect(await first(env.DB, "SELECT contact_email, expires_at FROM members WHERE jellyfin_id = 'u1'")).toEqual({ contact_email: "mine@example.com", expires_at: mine });
  });
  test("outstanding invites keep their code as the link token, their uses, expiry and matched preset; dead ones are skipped", async () => {
    const r = await migrate({ db: env.DB, jf }, data(), { dryRun: false });
    const one = await first<any>(env.DB, "SELECT * FROM invites WHERE token_hash = ?", await hashToken("CODE-ONE-AAAAAAAAAAAA"));
    expect(one).toMatchObject({ preset_id: "preset-family", max_uses: 2, uses: 0, email: "new@example.com", created_by: "migration" });
    const two = await first<any>(env.DB, "SELECT * FROM invites WHERE token_hash = ?", await hashToken("CODE-TWO-BBBBBBBBBBBB"));
    expect(two).toMatchObject({ preset_id: "preset-standard", max_uses: 100 }); // unknown profile falls back to Standard; unlimited is capped
    expect(r.invites.skipped.map((s) => s.reason).sort()).toEqual(["expired", "no uses left"]);
    expect(JSON.stringify(r)).not.toContain("CODE-OLD-CCCCCCCCCCCC"); // codes are never echoed in full
  });
  test("an old link still works through the normal invite lookup", async () => {
    await migrate({ db: env.DB, jf }, data(), { dryRun: false });
    const app = createApp();
    expect(((await (await app.request("/api/invites/CODE-ONE-AAAAAAAAAAAA", {}, env)).json()) as any).presetName).toBe("Family");
  });
});

describe("migration endpoint", () => {
  const users: Record<string, any> = { a1: jfUsers[0], u1: jfUsers[1] };
  const app = createApp({ jellyfin: (() => ({ authenticate: async (n: string) => ({ id: n === "olivia" ? "a1" : "u1", name: n, isAdmin: n === "olivia" }), getUser: async (id: string) => users[id] ?? null, listUsers: async () => jfUsers })) as never });
  async function login(n: string) {
    const r = await app.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: n, password: "x" }) }, env);
    return { cookie: r.headers.get("set-cookie")!.split(";")[0], "x-csrf-token": ((await r.json()) as any).csrf as string, "content-type": "application/json" };
  }
  const post = (a: any, body: unknown) => app.request("/api/admin/migrate/jfa-go", { method: "POST", headers: a, body: JSON.stringify(body) }, env);
  test("admin only, and dry run is the default", async () => {
    expect((await post(await login("maya"), { export: data() })).status).toBe(403);
    const res = await post(await login("olivia"), { export: data() });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).dryRun).toBe(true);
    expect(await first(env.DB, "SELECT * FROM invites")).toBeNull(); // dry run: nothing imported
  });
  test("a malformed export is refused", async () => {
    const a = await login("olivia");
    expect((await post(a, { export: { users: "no" } })).status).toBe(400);
    expect((await post(a, { export: { users: [{ username: 5 }], invites: [] } })).status).toBe(400);
    expect((await post(a, {})).status).toBe(400);
  });
});
