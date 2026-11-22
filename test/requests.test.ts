import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { first, run } from "../src/db";
import { makeSeerr } from "../src/seerr";

let calls: Array<[string, any]>, seerrUsers: Record<string, number>, failRequest: number | null, failPerm = false;
let requestRows: any[], summaries: Record<number, {title:string|null;posterPath:string|null;year:string}|null|Error>;
const users: Record<string, any> = { u1: { id: "u1", name: "maya", isAdmin: false, isDisabled: false } };
const seerr = () => ({
  search: async (q: string, asUser: number) => { calls.push(["search", { q, asUser }]); return [
    { id: 1, mediaType: "movie", title: "Heat", releaseDate: "1995-12-15", posterPath: "/heat.jpg", overview: "o", mediaInfo: { status: 5 } },
    { id: 2, mediaType: "tv", name: "Slow Horses", firstAirDate: "2022-04-01", posterPath: "/sh.jpg", overview: "o" },
    { id: 3, mediaType: "person", name: "Someone" },
  ]; },
  request: async (body: any, asUser: number) => { calls.push(["request", { body, asUser }]); if (failRequest) { const e: any = new Error("x"); e.status = failRequest; throw e; } },
  title: async (type: string, id: number) => { calls.push(["title", {type,id}]); return id === 1 ? "Heat" : null; },
  summary: async (type: string, id: number) => { calls.push(["summary", {type,id}]); const value=summaries[id];if(value instanceof Error)throw value;return value??null; },
  trending: async () => [{ id: 7, mediaType: "movie", title: "Dune", releaseDate: "2021-09-15", posterPath: "/d.jpg" }, { id: 8, mediaType: "tv", name: "Andor", firstAirDate: "2022-09-21" }, { id: 9, mediaType: "person", name: "X" }],
  userRequests: async (id: number) => { calls.push(["userRequests", { id }]); return requestRows; },
  findUserByJellyfinId: async (jid: string) => (jid in seerrUsers ? seerrUsers[jid] : null),
  importUser: async () => 77,
  setPermissions: async (id: number, r: string) => { calls.push(["perm", [id, r]]); if (failPerm) throw new Error("perm"); },
  deleteUser: async (id: number) => void calls.push(["seerrDelete", id]),
});
const penv = { ...env, ENVIRONMENT: "prod" } as typeof env; // the test config is beta, where Seerr writes are restricted to beta- accounts
const app = createApp({
  jellyfin: (() => ({ authenticate: async () => ({ id: "u1", name: "maya", isAdmin: false }), getUser: async (id: string) => users[id] ?? null })) as never,
  seerr: seerr as never,
  fetch: (async (url: string) => { calls.push(["tmdb", url]); return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } }); }) as never,
});
async function login(noPreset = false) {
  const r = await app.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "maya", password: "x" }) }, env);
  if (!noPreset) await run(env.DB, "UPDATE members SET preset_id = 'preset-standard' WHERE jellyfin_id = 'u1'");
  return { cookie: r.headers.get("set-cookie")!.split(";")[0], "x-csrf-token": ((await r.json()) as any).csrf as string };
}
const post2 = (a: any, body: unknown) => app.request("/api/discover/request", { method: "POST", headers: { "content-type": "application/json", ...a }, body: JSON.stringify(body) }, env);
const post = (a: any, body: unknown) => app.request("/api/discover/request", { method: "POST", headers: { "content-type": "application/json", ...a }, body: JSON.stringify(body) }, penv);

beforeEach(async () => {
  calls = []; seerrUsers = { u1: 42 }; failRequest = null; failPerm = false;
  requestRows=[{ id: 9, status: 2, media: { tmdbId: 1, mediaType: "movie", status: 3 }, createdAt: "2026-11-01T00:00:00Z" }];
  summaries={1:{title:"Heat",posterPath:"/heat.jpg",year:"1995"}};
  for (const t of ["members", "sessions", "rate_limits"]) await run(env.DB, `DELETE FROM ${t}`);
});

describe("request summaries",()=>{
 test("adds private poster links and year without a second title lookup",async()=>{
  const a=await login();const res=await app.request('/api/discover/requests',{headers:{cookie:a.cookie}},penv);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual([{id:9,status:'approved',mediaType:'movie',tmdbId:1,available:false,createdAt:'2026-11-01T00:00:00Z',jellyfinId:null,title:'Heat',posterUrl:'/api/discover/poster?path=%2Fheat.jpg',year:'1995',rating:'',quality:'HD'}]);
  expect(calls.filter(c=>c[0]==='summary')).toEqual([['summary',{type:'movie',id:1}]]);
  expect(calls.filter(c=>c[0]==='title')).toEqual([]);
 });
 test("keeps rows when summaries fail and rejects unsafe poster paths",async()=>{
  const paths=['/ok_1-X.png','/../x.jpg','https://evil.test/x.jpg','//evil.jpg','/x.svg','/a/b.jpg','/'+ 'a'.repeat(61)+'.jpg',null];
  requestRows=Array.from({length:paths.length+2},(_,i)=>({id:i+1,status:1,media:{tmdbId:i+1,mediaType:'tv'},createdAt:'2026-11-01'}));
  summaries={};paths.forEach((path,i)=>summaries[i+1]={title:'Show '+i,posterPath:path,year:'2022'});
  summaries[paths.length+1]=new Error('Unavailable');summaries[paths.length+2]=null;
  const a=await login();const res=await app.request('/api/discover/requests',{headers:{cookie:a.cookie}},penv);expect(res.status).toBe(200);
  const rows=await res.json() as any[];expect(rows).toHaveLength(requestRows.length);
  expect(rows[0].posterUrl).toBe('/api/discover/poster?path=%2Fok_1-X.png');
  for(const row of rows.slice(1))expect(row.posterUrl).toBeNull();
  for(const row of rows.slice(-2))expect(row).toMatchObject({title:null,year:'',posterUrl:null});
 });
 test.each([5,20,50])("looks up only returned rows for limit=%s, including Home",async(limit)=>{
  requestRows=Array.from({length:25},(_,i)=>({id:i+1,status:1,media:{tmdbId:i+1,mediaType:'movie'}}));
  const a=await login();const res=await app.request('/api/discover/requests?limit='+limit,{headers:{cookie:a.cookie}},penv);
  expect(await res.json()).toHaveLength(Math.min(limit,20));expect(calls.filter(c=>c[0]==='summary')).toHaveLength(Math.min(limit,20));
 });
 test("Seerr summaries use one detail call and extract film and TV dates",async()=>{
  const urls:string[]=[];
  const client=makeSeerr(env,(async(url)=>{urls.push(String(url));return Response.json(String(url).endsWith('/movie/1')?{title:'Heat',posterPath:'/heat.jpg',release_date:'1995-12-15'}:{name:'Slow Horses',posterPath:'/sh.jpg',first_air_date:'2022-04-01'});}) as typeof fetch);
  expect(await client.summary('movie',1)).toEqual({title:'Heat',posterPath:'/heat.jpg',year:'1995',rating:''});
  expect(await client.summary('tv',2)).toEqual({title:'Slow Horses',posterPath:'/sh.jpg',year:'2022',rating:''});
  expect(urls).toHaveLength(2);expect(urls[0]).toMatch(/\/movie\/1$/);expect(urls[1]).toMatch(/\/tv\/2$/);
 });
 test("Seerr summaries tolerate missing fields and failed lookups without fetching invalid ids",async()=>{
  let fetched=0;
  const client=makeSeerr(env,(async()=>{fetched++;return Response.json({});}) as typeof fetch);
  expect(await client.summary('person',1)).toBeNull();expect(await client.summary('movie',NaN)).toBeNull();expect(await client.summary('tv',0)).toBeNull();expect(fetched).toBe(0);
  expect(await client.summary('movie',1)).toEqual({title:null,posterPath:null,year:'',rating:''});expect(fetched).toBe(1);
  const down=makeSeerr(env,(async()=>{throw new Error('offline');}) as typeof fetch);
  expect(await down.summary('movie',1)).toBeNull();
  const bad=makeSeerr(env,(async()=>new Response('bad',{status:502})) as typeof fetch);
  expect(await bad.summary('movie',1)).toBeNull();
 });
});

describe("search", () => {
  test("returns films and TV with private poster links, split by type, people dropped", async () => {
    const a = await login();
    const res = await app.request("/api/discover/search?q=heat", { headers: { cookie: a.cookie } }, penv);
    const body = (await res.json()) as any;
    expect(body.films).toEqual([expect.objectContaining({ id: 1, title: "Heat", year: "1995", status: "available", posterUrl: "/api/discover/poster?path=%2Fheat.jpg" })]);
    expect(body.tv).toEqual([expect.objectContaining({ id: 2, title: "Slow Horses", year: "2022", status: "none" })]);
    expect(JSON.stringify(body)).not.toContain("themoviedb");
  });
  test("the Seerr user comes from the session, and is looked up once then stored", async () => {
    const a = await login();
    await app.request("/api/discover/search?q=heat", { headers: { cookie: a.cookie } }, penv);
    expect(calls.find((c) => c[0] === "search")).toEqual(["search", { q: "heat", asUser: 42 }]);
    expect(await first(env.DB, "SELECT seerr_user_id AS s FROM members WHERE jellyfin_id = 'u1'")).toEqual({ s: 42 });
  });
  test("a member Seerr has never seen is imported", async () => {
    seerrUsers = {};
    const a = await login();
    await app.request("/api/discover/search?q=heat", { headers: { cookie: a.cookie } }, penv);
    expect(calls.find((c) => c[0] === "search")).toEqual(["search", { q: "heat", asUser: 77 }]);
  });
  test("short queries are rejected", async () => {
    const a = await login();
    expect((await app.request("/api/discover/search?q=a", { headers: { cookie: a.cookie } }, penv)).status).toBe(400);
  });
});

describe("provisioning a member Seerr has not seen from their access level", () => {
  test("an imported member gets the rights of their preset before anything else, and the id is then stored", async () => {
    seerrUsers = {};
    const a = await login(true);
    await run(env.DB, "UPDATE members SET preset_id = 'preset-family' WHERE jellyfin_id = 'u1'");
    await app.request("/api/discover/search?q=heat", { headers: { cookie: a.cookie } }, penv);
    expect(calls.map((c) => c[0]).slice(0, 2)).toEqual(["perm", "search"]);
    expect(calls[0]).toEqual(["perm", [77, "auto"]]);
    expect(await first(env.DB, "SELECT seerr_user_id AS s FROM members WHERE jellyfin_id = 'u1'")).toEqual({ s: 77 });
  });
  test("a member with no preset gets no request rights", async () => {
    seerrUsers = {};
    const a = await login(true);
    await app.request("/api/discover/search?q=heat", { headers: { cookie: a.cookie } }, penv);
    expect(calls[0]).toEqual(["perm", [77, "none"]]);
  });
  test("an account Seerr already has is NEVER modified (it may be an admin or hold rights set in Seerr); its id is just remembered", async () => {
    const a = await login(true);
    await app.request("/api/discover/search?q=heat", { headers: { cookie: a.cookie } }, penv);
    expect(calls.find((c) => c[0] === "perm")).toBeUndefined();
    expect(calls.find((c) => c[0] === "seerrDelete")).toBeUndefined();
    expect(await first(env.DB, "SELECT seerr_user_id AS s FROM members WHERE jellyfin_id = 'u1'")).toEqual({ s: 42 });
  });
  test("in beta a non-beta account that Seerr already knows can search and request, with no Seerr writes", async () => {
    const a = await login(true);
    await run(env.DB, "UPDATE members SET preset_id = 'preset-standard' WHERE jellyfin_id = 'u1'");
    expect((await app.request("/api/discover/search?q=heat", { headers: { cookie: a.cookie } }, env)).status).toBe(200); // env is beta
    expect((await post2(a, { mediaType: "movie", mediaId: 1 })).status).toBe(201);
    expect(calls.filter((c) => ["perm", "seerrDelete"].includes(c[0]))).toEqual([]);
  });
  test("in beta a non-beta account never causes a Seerr write (Seerr is shared with production)", async () => {
    seerrUsers = {};
    const a = await login(true);
    const res = await app.request("/api/discover/search?q=heat", { headers: { cookie: a.cookie } }, env); // env is beta
    expect(res.status).toBe(403);
    expect(calls.filter((c) => ["perm", "search", "seerrDelete"].includes(c[0]))).toEqual([]);
  });
  test("if the rights cannot be set, a user we just imported is removed and nothing is stored", async () => {
    seerrUsers = {}; failPerm = true;
    const a = await login(true);
    const res = await app.request("/api/discover/search?q=heat", { headers: { cookie: a.cookie } }, penv);
    expect(res.status).toBe(502);
    expect(calls).toContainEqual(["seerrDelete", 77]);
    expect(await first(env.DB, "SELECT seerr_user_id AS s FROM members WHERE jellyfin_id = 'u1'")).toEqual({ s: null });
  });
  test("a member with no access level cannot request until an admin assigns one", async () => {
    const a = await login(true);
    expect((await post(a, { mediaType: "movie", mediaId: 1 })).status).toBe(403);
    expect(calls.find((c) => c[0] === "request")).toBeUndefined();
  });
});

describe("requesting", () => {
  test("a TV request passes seasons and the session user, ignoring any user in the body", async () => {
    const a = await login();
    expect((await post(a, { mediaType: "tv", mediaId: 2, seasons: [1, 2], userId: 1 })).status).toBe(201);
    expect(calls.find((c) => c[0] === "request")![1]).toEqual({ body: { mediaType: "tv", mediaId: 2, seasons: [1, 2] }, asUser: 42 });
  });
  test("a film request carries no seasons; bad input is refused", async () => {
    const a = await login();
    await post(a, { mediaType: "movie", mediaId: 1 });
    expect(calls.find((c) => c[0] === "request")![1].body).toEqual({ mediaType: "movie", mediaId: 1 });
    for (const bad of [{ mediaType: "person", mediaId: 1 }, { mediaType: "movie", mediaId: "x" }, { mediaType: "tv", mediaId: 2, seasons: "everything" }, { mediaType: "tv", mediaId: 2, seasons: [-1] }]) expect((await post(a, bad)).status, JSON.stringify(bad)).toBe(400);
  });
  test("members whose access level cannot request are refused before Seerr is asked", async () => {
    const a = await login();
    await run(env.DB, "UPDATE members SET preset_id = 'preset-guest' WHERE jellyfin_id = 'u1'");
    expect((await post(a, { mediaType: "movie", mediaId: 1 })).status).toBe(403);
    expect(calls.find((c) => c[0] === "request")).toBeUndefined();
  });
  test("Seerr's already-requested and quota answers become plain messages", async () => {
    const a = await login();
    failRequest = 409; expect(await (await post(a, { mediaType: "movie", mediaId: 1 })).json()).toMatchObject({ error: expect.stringMatching(/already/i) });
    failRequest = 403; expect((await post(a, { mediaType: "movie", mediaId: 1 })).status).toBe(403);
    failRequest = 500; expect((await post(a, { mediaType: "movie", mediaId: 1 })).status).toBe(502);
  });
  test("my requests lists status for the signed-in member only", async () => {
    const a = await login();
    const rows = (await (await app.request("/api/discover/requests", { headers: { cookie: a.cookie } }, penv)).json()) as any[];
    expect(rows[0]).toMatchObject({ id: 9, status: "approved", mediaType: "movie", title: "Heat" });
    expect(calls.find((c) => c[0] === "userRequests")![1]).toEqual({ id: 42 });
  });
});

describe("trending and request limits", () => {
  test("trending returns films and TV in the same shape as search", async () => {
    const a = await login();
    const body = (await (await app.request("/api/discover/trending", { headers: { cookie: a.cookie } }, penv)).json()) as any;
    expect(body.films).toEqual([expect.objectContaining({ id: 7, title: "Dune", year: "2021", posterUrl: "/api/discover/poster?path=%2Fd.jpg" })]);
    expect(body.tv.map((t: any) => t.title)).toEqual(["Andor"]);
  });
  test("the requests list honours a limit", async () => {
    const a = await login();
    const rows = (await (await app.request("/api/discover/requests?limit=1", { headers: { cookie: a.cookie } }, penv)).json()) as any[];
    expect(rows).toHaveLength(1);
  });
});

describe("posters", () => {
  test("only plain TMDB poster paths are fetched, by the Worker, not the member's browser", async () => {
    const a = await login();
    const ok = await app.request("/api/discover/poster?path=%2Fheat.jpg", { headers: { cookie: a.cookie } }, penv);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/jpeg");
    expect(calls.find((c) => c[0] === "tmdb")![1]).toBe("https://image.tmdb.org/t/p/w342/heat.jpg");
    for (const bad of ["..%2F..%2Fx.jpg", "%2Fa%2Fb.jpg", "http%3A%2F%2Fevil.test%2Fx.jpg", "%2Fx.svg", ""]) expect((await app.request(`/api/discover/poster?path=${bad}`, { headers: { cookie: a.cookie } }, penv)).status, bad).toBe(400);
  });
  test("needs a session", async () => {
    expect((await app.request("/api/discover/poster?path=%2Fheat.jpg", {}, penv)).status).toBe(401);
  });
});

describe("poster route with the real default fetch (Workers reject fetch called as a method)", () => {
  test("it never fails with a server error, whatever the network does", async () => {
    const real = createApp({
      jellyfin: (() => ({ authenticate: async () => ({ id: "u1", name: "maya", isAdmin: false }), getUser: async () => ({ id: "u1", name: "maya", isAdmin: false, isDisabled: false }) })) as never,
    });
    const r = await real.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "maya", password: "x" }) }, env);
    const res = await real.request("/api/discover/poster?path=%2Fjellypass-test-missing.jpg", { headers: { cookie: r.headers.get("set-cookie")!.split(";")[0] } }, penv);
    expect([200, 404, 502]).toContain(res.status); // 500 would mean the fetch call itself blew up
  });
});

let adminNow = true, adminLookupFails = false;
describe("admins can request without an access level", () => {
  beforeEach(() => { adminNow = true; adminLookupFails = false; });
  const adminApp = createApp({
    jellyfin: (() => ({ authenticate: async () => ({ id: "u1", name: "maya", isAdmin: true }), getUser: async () => { if (adminLookupFails) throw new Error("down"); return { id: "u1", name: "maya", isAdmin: adminNow, isDisabled: false }; } })) as never,
    seerr: seerr as never,
  });
  async function adminLogin() {
    const r = await adminApp.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "maya", password: "x" }) }, env);
    return { cookie: r.headers.get("set-cookie")!.split(";")[0], "x-csrf-token": ((await r.json()) as any).csrf as string };
  }
  test("an admin with no preset can request (Seerr still enforces their own rights), a member with none still cannot", async () => {
    const a = await adminLogin();
    const res = await adminApp.request("/api/discover/request", { method: "POST", headers: { "content-type": "application/json", ...a }, body: JSON.stringify({ mediaType: "movie", mediaId: 1 }) }, penv);
    expect(res.status).toBe(201);
    expect(calls.find((c) => c[0] === "request")).toBeDefined();
    const m = await login(true); // ordinary member, no preset
    expect((await post(m, { mediaType: "movie", mediaId: 1 })).status).toBe(403);
  });
  test("the exemption is checked live: an admin demoted since sign-in, or an unreachable Jellyfin, gets no exemption", async () => {
    const a = await adminLogin();
    const req = () => adminApp.request("/api/discover/request", { method: "POST", headers: { "content-type": "application/json", ...a }, body: JSON.stringify({ mediaType: "movie", mediaId: 1 }) }, penv);
    adminNow = false;
    expect((await req()).status).toBe(403);
    adminNow = true; adminLookupFails = true;
    expect((await req()).status).toBe(403);
  });
});

test('summary reads the BBFC certificate for films and shows, ignoring other countries and unknown values',async()=>{
 const body:Record<string,unknown>={movie:{title:'Heat',releases:{results:[{iso_3166_1:'US',release_dates:[{certification:'R'}]},{iso_3166_1:'GB',release_dates:[{certification:''},{certification:'18'}]}]}},tv:{name:'Slow Horses',contentRatings:{results:[{iso_3166_1:'GB',rating:'15'}]}}};
 const client=makeSeerr(env,(async(u:string)=>new Response(JSON.stringify(String(u).includes('/movie/')?body.movie:body.tv)))as never);
 expect((await client.summary('movie',1))?.rating).toBe('18');expect((await client.summary('tv',2))?.rating).toBe('15');
});
