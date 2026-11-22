import { all } from '../db';
import { Hono } from 'hono';
import { loadSession, type AppEnv } from '../auth';
import { getMember } from '../members';
import { appShell, compareLink, memberLinks } from '../views/shell';
import { memberBody } from '../views/member-pages';
export const memberPageRoutes = new Hono<AppEnv>();
for (const [active,path,title] of [...memberLinks,compareLink]) memberPageRoutes.get(path,async c=>{
 c.header('Cache-Control','no-store');
 const session=await loadSession(c);
 if(!session)return c.redirect('/signin',302);
 const member=await getMember(c.env.DB,session.jellyfinId);
 let state;try{state=JSON.parse(member?.onboarding_state??'{}')??{};}catch{state={};}
 if(!state.done)return c.redirect(state.kind==='new'?'/join/continue':'/welcome',302);
 // Compare is opt-in: the page and its menu entry exist only for members who switched it on in Settings.
 if(active==='compare'&&!member?.compare_on)return c.redirect('/settings',302);
 const announcements=await all<{title:string;body:string}>(c.env.DB,'SELECT title, body FROM announcements WHERE active = 1 ORDER BY id DESC LIMIT 20');
 return c.html(appShell({title,active,announcements,compare:!!member?.compare_on,isAdmin:session.isAdmin,session,body:memberBody(active,session.username,c.env.JELLYFIN_URL,c.env.SEERR_URL)}));
});
