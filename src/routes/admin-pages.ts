import { Hono } from 'hono';
import { html } from 'hono/html';
import { loadSession, type AppEnv } from '../auth';
import { getMember } from '../members';
import { all } from '../db';
import { appShell } from '../views/shell';
import { adminBody, adminPages } from '../views/admin-pages';
export const adminPageRoutes = new Hono<AppEnv>();
for (const [active, title] of adminPages) adminPageRoutes.get('/admin/' + active, async c => {
 const session = await loadSession(c);
 if (!session) return c.redirect('/signin', 302);
 const user = await c.var.jf.getUser(session.jellyfinId).catch(() => null);
 if (!user?.isAdmin || user.isDisabled) return c.html(appShell({ title:'Admins only', active:'forbidden', isAdmin:false, session, body:html`<h1>Admins only</h1><p>This part of Jellypass is for admins. You can still use your member pages.</p><a class="btn" href="/">Back to Home</a>` }),403);
 const member = await getMember(c.env.DB,session.jellyfinId);
 let state; try { state=JSON.parse(member?.onboarding_state ?? '{}') ?? {}; } catch { state={}; }
 if (!state.done) return c.redirect(state.kind==='new'?'/join/continue':'/welcome',302);
 const announcements=await all<{title:string;body:string}>(c.env.DB,'SELECT title, body FROM announcements WHERE active = 1 ORDER BY id DESC LIMIT 20');
 return c.html(appShell({title,active,isAdmin:true,session,announcements,compare:!!member?.compare_on,body:adminBody(active,title)}));
});
