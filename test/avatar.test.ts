import { env } from 'cloudflare:workers';
import { beforeEach, expect, test, vi } from 'vitest';
import { createApp } from '../src/index';
import { createSession } from '../src/auth';
import { run } from '../src/db';
const own = 'a'.repeat(32), other = 'b'.repeat(32);
let admin = false, disabled = false, offline = false;
const avatar = vi.fn(async (_id: string): Promise<{body: ArrayBuffer; contentType: string} | null> => ({body: new Uint8Array([1,2,3]).buffer, contentType:'image/png'}));
const app = createApp({jellyfin: (() => ({avatar, getUser: async () => {if(offline)throw new Error('offline');return {id:own,name:'Maya',isAdmin:admin,isDisabled:disabled};}})) as never});
async function get(path: string, authenticated = true) {
 const session = authenticated ? await createSession(env,{id:own,name:'Maya',isAdmin:true}) : null;
 return app.request('/api/avatar/'+path,{headers:session?{cookie:'jp_session='+session.cookieValue}:{}},env);
}
beforeEach(async()=>{await run(env.DB,'DELETE FROM sessions');admin=false;disabled=false;offline=false;avatar.mockClear();avatar.mockResolvedValue({body:new Uint8Array([1,2,3]).buffer,contentType:'image/png'});});
test('requires a session',async()=>{expect((await get('me',false)).status).toBe(401);expect(avatar).not.toHaveBeenCalled();});
test.each(['me',own])('serves own picture for %s',async path=>{const r=await get(path);expect(r.status).toBe(200);expect([...new Uint8Array(await r.arrayBuffer())]).toEqual([1,2,3]);expect(r.headers.get('content-type')).toBe('image/png');expect(r.headers.get('cache-control')).toBe('private, max-age=3600');expect(r.headers.get('x-content-type-options')).toBe('nosniff');expect(avatar).toHaveBeenCalledWith(own);});
test('missing picture returns JSON 404',async()=>{avatar.mockResolvedValue(null);const r=await get('me');expect(r.status).toBe(404);expect(await r.json()).toEqual({error:'no profile picture'});});
test.each(['bad','abc.png','g'.repeat(32)])('rejects invalid id %s',async id=>{expect((await get(id)).status).toBe(400);expect(avatar).not.toHaveBeenCalled();});
test('member cannot read another picture even with cached admin session',async()=>{expect((await get(other)).status).toBe(403);expect(avatar).not.toHaveBeenCalled();});
test('fresh admin can read another picture',async()=>{admin=true;expect((await get(other)).status).toBe(200);expect(avatar).toHaveBeenCalledWith(other);});
test('disabled admin fails closed',async()=>{admin=true;disabled=true;expect((await get(other)).status).toBe(403);expect(avatar).not.toHaveBeenCalled();});
test('unavailable admin check fails closed',async()=>{offline=true;expect((await get(other)).status).toBe(503);expect(avatar).not.toHaveBeenCalled();});

test('an SVG picture is never passed through (it could run script from the app origin)',async()=>{avatar.mockResolvedValue({body:new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').buffer as ArrayBuffer,contentType:'image/svg+xml'});const r=await get('me');expect(r.status).toBe(415);expect(await r.json()).toEqual({error:'unsupported image type'});});
test('an HTML upstream type gets 415',async()=>{avatar.mockResolvedValue({body:new Uint8Array([60,104]).buffer,contentType:'text/html'});expect((await get('me')).status).toBe(415);});
test('a PNG with a charset parameter is served with a normalised type and hardening headers',async()=>{avatar.mockResolvedValue({body:new Uint8Array([1,2,3]).buffer,contentType:'IMAGE/PNG; charset=binary'});const r=await get('me');expect(r.status).toBe(200);expect(r.headers.get('content-type')).toBe('image/png');expect(r.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox");expect(r.headers.get('content-disposition')).toBe('inline; filename="avatar"');expect(r.headers.get('x-content-type-options')).toBe('nosniff');});
