import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, test } from 'vitest';
import { createApp } from '../src/index';
import { run } from '../src/db';
import { adminJs } from '../src/views/js/admin';
let isAdmin=true, isDisabled=false, unavailable=false;
const username='<img src=x onerror=alert(1)>';
const app=createApp({jellyfin:(()=>({authenticate:async()=>({id:'admin-pages',name:username,isAdmin:true}),getUser:async()=>{if(unavailable)throw new Error('offline');return {id:'admin-pages',name:username,isAdmin,isDisabled};}})) as never});
const paths=[['/admin/users','Users','Search users'],['/admin/invites','Invites','Preview email'],['/admin/streams','Live streams','Updates every 15 seconds'],['/admin/announcements','Announcements','New announcement'],['/admin/audit','Audit log','Every admin action is recorded here.'],['/admin/settings','Settings','Import from jfa-go']];
async function login(done=true){const r=await app.request('/api/signin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'olivia',password:'password'})},env);expect(r.status).toBe(200);if(done)await run(env.DB,'UPDATE members SET onboarding_state = ? WHERE jellyfin_id = ?','{"done":true}','admin-pages');else await run(env.DB,'UPDATE members SET onboarding_state = ? WHERE jellyfin_id = ?','{"kind":"existing","step":"welcome"}','admin-pages'); /* admins skip onboarding at sign-in, so put this one back to test the gate */return r.headers.get('set-cookie')!.split(';')[0];}
const get=(path:string,cookie?:string)=>app.request(path,{headers:cookie?{cookie}:{}},env);
beforeEach(async()=>{isAdmin=true;isDisabled=false;unavailable=false;for(const table of ['members','sessions','rate_limits','announcements'])await run(env.DB,`DELETE FROM ${table}`);});
describe('admin pages',()=>{
 test.each(paths)('%s requires sign-in',async(path)=>{const r=await get(path);expect(r.status).toBe(302);expect(r.headers.get('location')).toBe('/signin');});
 test.each(paths)('%s renders the admin shell safely',async(path,title,copy)=>{const cookie=await login();const r=await get(path,cookie),body=await r.text();expect(r.status).toBe(200);expect(body).toContain(`<title>${title} · Jellypass</title>`);expect(body).toContain(copy);expect(body).toContain('Skip to content');expect(body).toContain('/assets/admin.js');expect(body).toContain('&lt;img src=x onerror=alert(1)&gt;');expect(body).not.toContain(username);expect(r.headers.get('cache-control')).toBe('no-store');expect(r.headers.get('x-content-type-options')).toBe('nosniff');expect(r.headers.get('content-security-policy')).toBe(path==='/admin/invites'?(await get('/signin')).headers.get('content-security-policy')!.replace('frame-src https://challenges.cloudflare.com',"frame-src 'self'"):path==='/admin/streams'?(await get('/signin')).headers.get('content-security-policy')!.replace("img-src 'self' data:","img-src 'self' data: blob: https://jf.test").replace('frame-src','worker-src blob:; child-src blob:; frame-src'):(await get('/signin')).headers.get('content-security-policy'));for(const m of body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){expect(m[1]).toContain('src=');expect(m[2]).toBe('');}expect(body).not.toMatch(/\son(?:click|load|error|submit)=["']/);expect(body).not.toMatch(/https?:\/\//);});
 test.each(paths)('%s rejects members without admin markup',async(path)=>{const cookie=await login();isAdmin=false;await run(env.DB,'UPDATE sessions SET is_admin = 0 WHERE jellyfin_id = ?','admin-pages');const r=await get(path,cookie),body=await r.text();expect(r.status).toBe(403);expect(body).toContain('Admins only');expect(body).toContain('Back to Home');expect(body).not.toContain('/assets/admin.js');expect(body).not.toContain('admin-page');expect(body).not.toContain('/admin/users');});
 test.each(paths)('%s checks demotion freshly',async(path)=>{const cookie=await login();isAdmin=false;expect((await get(path,cookie)).status).toBe(403);});
 test.each(paths)('%s honours onboarding',async(path)=>{const cookie=await login(false);expect((await get(path,cookie)).headers.get('location')).toBe('/welcome');await run(env.DB,'UPDATE members SET onboarding_state = ? WHERE jellyfin_id = ?','{"kind":"new"}','admin-pages');expect((await get(path,cookie)).headers.get('location')).toBe('/join/continue');});
 test('disabled admins fail the fresh check',async()=>{const cookie=await login();isDisabled=true;expect((await get('/admin/users',cookie)).status).toBe(403);});
 test('unavailable Jellyfin fails closed',async()=>{const cookie=await login();unavailable=true;expect((await get('/admin/settings',cookie)).status).toBe(403);});
 test('escapes server-rendered announcement title and body',async()=>{const cookie=await login();await run(env.DB,'INSERT INTO announcements (title,body,kind,created_by) VALUES (?,?,?,?)','<b>Update</b>','<script>alert(1)</script>','info','admin');const body=await(await get('/admin/audit',cookie)).text();expect(body).toContain('&lt;b&gt;Update&lt;/b&gt;');expect(body).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');expect(body).not.toContain('<script>alert(1)</script>');});
 test.each(['admin.js','shell.js','common.js','app.css'])('serves %s locally',async name=>{const r=await get('/assets/'+name);expect(r.status).toBe(200);expect(r.headers.get('content-type')).toContain(name.endsWith('.css')?'text/css':'text/javascript');expect(r.headers.get('x-content-type-options')).toBe('nosniff');expect((await r.text()).length).toBeGreaterThan(100);});
 test('admin script uses local modules and DOM text for API content',()=>{expect(adminJs).not.toMatch(/https?:\/\//);expect(adminJs).not.toContain('innerHTML');expect(adminJs).toContain("from '/assets/shell.js'");expect(adminJs).toContain("from '/assets/common.js'");});
});

describe("settings page has a Connections section", () => {
  test("it renders for admins with the key-management copy and no key values", async () => {
    const a = createApp({ jellyfin: (() => ({ authenticate: async () => ({ id: "a1", name: "olivia", isAdmin: true }), getUser: async () => ({ id: "a1", name: "olivia", isAdmin: true, isDisabled: false }) })) as never });
    const r = await a.request("/api/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "olivia", password: "x" }) }, env);
    const cookie = r.headers.get("set-cookie")!.split(";")[0];
    await run(env.DB, "UPDATE members SET onboarding_state = '{\"done\":true}' WHERE jellyfin_id = 'a1'");
    const res = await a.request("/admin/settings", { headers: { cookie } }, env);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain("Connections");
    expect(html).toContain('id="keys-list"');
    expect(html).not.toContain(env.SESSION_SECRET);
  });
});

test.each(paths)('%s has compact page structure and decorative admin navigation',async(path)=>{
 const body=await(await get(path,await login())).text();
 const key=path.split('/').at(-1);
 expect(body).toContain(`class="admin-page stack admin-${key}"`);
 expect(body).toContain('<span class="sp"></span>');
 const nav=body.match(/<nav aria-label="Main">([\s\S]*?)<\/nav>/)![1];
 expect([...nav.matchAll(/<svg class="i" aria-hidden="true" focusable="false">/g)]).toHaveLength(18);
 for(const icon of ['users','mail','play','mega','log','cog'])expect(nav).toContain(`href="#${icon}"`);
 for(const badge of ['users','invites','devices'])expect(nav).toContain(`data-nav-count="${badge}"`);
});
test('users keeps search and filters together with an inline account detail panel',async()=>{
 const body=await(await get('/admin/users',await login())).text();
 expect(body).toContain('class="tools user-tools"');expect(body).toContain('class="split users-layout"');expect(body).toContain('id="user-panel" aria-label="User details"');expect(body).not.toContain('id="user-dialog"');
});

test('admin account chip, users and streams use the shared avatar',async()=>{
 const body=await(await get('/admin/users',await login())).text();
 expect(body).toContain('data-self-avatar');expect(body).toContain('data-account-name');
 expect(adminJs).toContain('avatar(u.id,u.name)');
 expect(adminJs).toContain('avatar(avatarUsers.find(u=>u.name===s.username)?.id,s.username)');
 expect(adminJs).toContain("read('/api/admin/users').catch(()=>[])");
});

describe('live streams card shows start, end, address and location', () => {
  test('map label fonts are served from the Worker, and only the bundled font', async () => {
    const ok = await get('/assets/glyphs/Noto%20Sans%20Regular/0-255.pbf');
    expect(ok.status).toBe(200);
    expect((await ok.arrayBuffer()).byteLength).toBeGreaterThan(10000);
    expect((await get('/assets/glyphs/Other/0-255.pbf')).status).toBe(404);
    expect((await get('/assets/glyphs/Noto%20Sans%20Regular/9999-10255.pbf')).status).toBe(404);
  });
  test('the streams page has a map fed by each stream\'s coordinates', async () => {
    const body = await (await get('/admin/streams', await login())).text();
    for (const copy of ['id="map"', '/assets/vendor/maplibre.js', '/assets/vendor/pmtiles.js']) expect(body).toContain(copy);
    expect(adminJs).toContain('setPins(pins)');
  });
  test('the streams script renders Started, Ends about / Time left, Address and Location unknown', () => {
    for (const copy of ["'Started'", "'Ends about'", "'Time left'", "'Address'", "Location unknown"]) expect(adminJs).toContain(copy);
  });
  test('the streams script reads the ISP beside the address and city', () => {
    expect(adminJs).toContain('s.isp');
    expect(adminJs).toContain("[s.ip,s.city,s.isp].filter(Boolean).join(' · ')");
  });
});

test('live announcements have padded content beside the new announcement form',async()=>{
 const body=await(await get('/admin/announcements',await login())).text();
 expect(body).toContain('class="split eq"');
 expect(body).toContain('<div id="announcements-list" class="pad">');
});
