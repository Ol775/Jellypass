import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, test } from 'vitest';
import { createApp } from '../src/index';
import { run } from '../src/db';
import { memberJs } from '../src/views/js/member';
// @ts-expect-error The Cloudflare Vitest pool supplies this shim; this project uses Worker types.
import { runInThisContext } from 'node:vm';
const app=createApp({jellyfin:(()=>({authenticate:async()=>({id:'member-pages',name:'maya',isAdmin:false}),getUser:async()=>({id:'member-pages',name:'maya',isAdmin:false,isDisabled:false})})) as never});
const paths=[['/','Home','Pick up where you left off'],['/discover','Discover and request','My requests'],['/history','Watch history','Films'],['/devices','Devices and sign-ins','Recent sign-ins'],['/account','Account and security','Contact email'],['/status','Status','Service health and monitoring history'],['/help','Help','Replay the tour']];
async function login(done=true){const res=await app.request('/api/signin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'maya',password:'password'})},env);expect(res.status).toBe(200);if(done)await run(env.DB,'UPDATE members SET onboarding_state = ? WHERE jellyfin_id = ?','{"done":true}','member-pages');return res.headers.get('set-cookie')!.split(';')[0];}
const get=(path:string,cookie?:string)=>app.request(path,{headers:cookie?{cookie}:{}},env);
test('account has an overview, security checklist and sign-out confirmation without losing settings',async()=>{
 const body=await(await get('/account',await login())).text();
 for(const id of ['account-overview','account-checklist','account-signout','account-loading','account-details','account-signout-dialog','account-signout-error'])expect(body).toContain('id="'+id+'"');
 for(const copy of ['Your account','Security checklist','Contact email','Not verified','Password','Warn me before access expires','Request emails','Sign out other browsers','Sign out of all my devices','Every Jellyfin app and TV will need to sign in again','This browser stays signed in','Your password is not changed'])expect(body).toContain(copy);
 expect(body).toContain('aria-labelledby="account-signout-title"');
 expect(body).toContain('aria-describedby="account-signout-description"');
 expect(body).toMatch(/id="account-signout-error"[^>]*role="alert"/);
 expect(body).toContain('href="/devices"');
 for(const copy of ['Your browsers','Sign-in alerts','Email me when someone signs in from somewhere new','id="account-browsers"','id="account-password-changed"','id="alerts-dialog"','aria-labelledby="alerts-title"','id="alerts-password"','autocomplete="current-password"'])expect(body).toContain(copy);
 expect(body).toMatch(/id="alerts-error"[^>]*role="alert"/);
});
test('account script loads its overview and confirms device sign-out using safe DOM updates',()=>{
 const account=memberJs.slice(memberJs.indexOf("if(page==='account')"),memberJs.indexOf("if(page==='help')"));
 expect(account).toContain("api('/api/account',undefined,'GET')");
 for(const endpoint of ['sign-out-others','sign-out-devices'])expect(account).toContain("'/api/account/"+endpoint+"'");
 expect(account).toMatch(/\$\('#signout-devices'\)\.onclick=[^;]*dialog\.showModal\(\)/);
 expect(account).toContain("$('#account-signout-confirm').onclick=");
 expect(account).toContain("if(signingOut)return");
 expect(account).toContain("Intl.DateTimeFormat('en-GB'");
 expect(account).toContain('Overview unavailable right now');
 expect(account).toContain("'/api/account/sessions/'+encodeURIComponent(session.id),{},'DELETE'");
 expect(account).toContain("api('/api/account/alerts',{on:true},'PUT')");
 expect(account).toContain("api('/api/account/alerts',{on:false,password:$('#alerts-password').value},'PUT')");
 expect(account).toContain('alertsDialog.showModal()');
 expect(account).toContain('This browser');
 expect(account).toContain('Never changed here');
 expect(account).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
});
test('account actions preserve confirmation, failure and refreshed browser states',async()=>{
 const source=memberJs.slice(memberJs.indexOf("if(page==='account') {")+"if(page==='account') {".length,memberJs.indexOf('\n loadAccount();',memberJs.indexOf("if(page==='account')")));
 const make=runInThisContext(`(function(api){
  const nodes=new Map(), all=[];
  function node(){const n={textContent:'',hidden:false,disabled:false,checked:false,value:'',open:false,children:[],dataset:{},attrs:{},classes:new Set(),
   append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},
   setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},addEventListener(){},focus(){},
   showModal(){this.open=true},close(){this.open=false}};
   n.classList={toggle(k,on){if(on)n.classes.add(k);else n.classes.delete(k)}};all.push(n);return n;}
  const $=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)};
  const document={createElement:node,querySelectorAll:()=>all.filter(n=>n.dataset.sessionSignout)};
  const ready=Promise.resolve(),say=()=>{};
  const act=async fn=>{const controls=all.filter(n=>!n.disabled);controls.forEach(n=>n.disabled=true);try{await fn()}finally{controls.forEach(n=>n.disabled=false)}};
  ${source}
  return {$,loadAccount,signOut};
 })`);
 let data={username:'<maya>',isAdmin:false,accessLevel:null,expiresAt:null,memberSince:'2026-11-03T12:00:00Z',emailVerified:false,otherSessions:1,alertsOn:true,passwordChangedAt:null,lastSignin:null,sessions:[{id:'current',label:'Safari',city:null,createdAt:new Date().toISOString(),current:true},{id:'other/id',label:'<Chrome>',city:'London',createdAt:new Date().toISOString(),current:false}]};
 let failOverview=false,failPassword=true,release:(()=>void)|undefined;
 const calls:Array<[string,unknown,string|undefined]>=[];
 const ui=make(async(path:string,body:unknown,method?:string)=>{
  calls.push([path,body,method]);
  if(path==='/api/account'){if(failOverview)throw new Error('Offline');return data;}
  if(path==='/api/account/alerts'&&failPassword)throw Object.assign(new Error('your current password is not right'),{status:403});
  if(path.includes('sign-out-'))await new Promise<void>(resolve=>{release=resolve;});
  if(method==='DELETE'||path.includes('sign-out-'))data={...data,otherSessions:0,sessions:data.sessions.slice(0,1)};
  return {ok:true};
 });
 await ui.loadAccount();
 expect(ui.$('#account-username').textContent).toBe('<maya>');
 expect(ui.$('#account-expiry').textContent).toBe('No end date');
 expect(ui.$('#account-password-changed').textContent).toContain('Never changed here');
 expect(ui.$('#account-browsers').children[0].children[1].textContent).toBe('This browser');
 expect(ui.$('#account-browsers').children[1].children[0].children[0].textContent).toBe('<Chrome>');
 ui.$('#signout-devices').onclick();expect(ui.$('#account-signout-dialog').open).toBe(true);expect(calls).toHaveLength(1);
 const first=ui.$('#account-signout-confirm').onclick();await Promise.resolve();await Promise.resolve();
 await ui.$('#account-signout-confirm').onclick();expect(calls.filter(([p])=>p.endsWith('sign-out-devices'))).toHaveLength(1);
 release!();await first;expect(ui.$('#signout-others').disabled).toBe(true);
 expect(ui.$('#account-browser-note').textContent).toBe('No other browsers are signed in.');
 await ui.$('#account-alerts').onchange();expect(ui.$('#alerts-dialog').open).toBe(true);
 ui.$('#alerts-password').value='wrong';await ui.$('#alerts-form').onsubmit({preventDefault(){}});
 expect(ui.$('#alerts-error').textContent).toContain('not right');expect(ui.$('#account-alerts').checked).toBe(true);expect(ui.$('#alerts-dialog').open).toBe(true);
 failPassword=false;ui.$('#alerts-password').value='correct';await ui.$('#alerts-form').onsubmit({preventDefault(){}});
 expect(ui.$('#account-alerts').checked).toBe(false);expect(ui.$('#alerts-password').value).toBe('');
 await ui.$('#account-alerts').onchange();expect(calls.at(-1)).toEqual(['/api/account/alerts',{on:true},'PUT']);
 await ui.signOut('/api/account/sessions/other%2Fid',{},'DELETE');
 expect(calls).toContainEqual(['/api/account/sessions/other%2Fid',{},'DELETE']);
 failOverview=true;await ui.loadAccount();
 expect(ui.$('#account-unavailable').hidden).toBe(false);expect(ui.$('#account-loading').hidden).toBe(true);expect(ui.$('#signout-devices').disabled).toBe(false);
});
beforeEach(async()=>{for(const table of ['members','sessions','rate_limits','announcements'])await run(env.DB,`DELETE FROM ${table}`);});
describe('member pages',()=>{
 test.each(paths)('%s requires a session',async(path)=>{const r=await get(path);expect(r.status).toBe(302);expect(r.headers.get('location')).toBe('/signin');});
 test.each(paths)('%s renders the member shell',async(path,title,copy)=>{const r=await get(path,await login());const body=await r.text();expect(r.status).toBe(200);expect(body).toContain(`<title>${title} · Jellypass</title>`);expect(body).toContain(copy);expect(body).toContain('Skip to content');expect(body).not.toContain('/admin/users');expect(r.headers.get('content-security-policy')).toContain("script-src 'self'");expect(body).not.toMatch(/mapbox/i);for(const m of body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){expect(m[1]).toContain('src=');expect(m[2]).toBe('');}expect(body).not.toMatch(/\son(?:click|load|error|submit)=/);for(const url of body.match(/https:\/\/[^"<>\s]+/g)||[])expect(url.startsWith(new URL(env.JELLYFIN_URL).origin)||url.startsWith('https://jellyfin.org/')||['https://www.maxmind.com','https://www.geonames.org','https://creativecommons.org/licenses/by/4.0/'].includes(url)||['https://apps.apple.com/','https://play.google.com/store/','https://www.amazon.com/gp/aw/','https://channelstore.roku.com/','https://apps.microsoft.com/detail/'].some(p=>url.startsWith(p))||url===env.SEERR_URL||url===env.SEERR_URL+'/profile/settings').toBe(true);});
 test.each(paths)('%s honours onboarding redirects',async(path)=>{const cookie=await login(false);expect((await get(path,cookie)).headers.get('location')).toBe('/welcome');await run(env.DB,'UPDATE members SET onboarding_state = ? WHERE jellyfin_id = ?','{"kind":"new"}','member-pages');expect((await get(path,cookie)).headers.get('location')).toBe('/join/continue');});
 test('admin navigation appears only for an admin session',async()=>{const cookie=await login();await run(env.DB,'UPDATE sessions SET is_admin = 1 WHERE jellyfin_id = ?','member-pages');const body=await(await get('/',cookie)).text();for(const key of ['users','invites','streams','announcements','audit','settings'])expect(body).toContain('/admin/'+key);});
 test('map CSP permits local blob workers but no remote connections',async()=>{const r=await get('/devices',await login());const csp=r.headers.get('content-security-policy');for(const rule of ["worker-src blob:","child-src blob:","img-src 'self' data: blob:","connect-src 'self'"])expect(csp).toContain(rule);expect(csp).not.toContain('unsafe-eval');});
 test('history images permit the configured Jellyfin origin',async()=>{expect((await get('/history',await login())).headers.get('content-security-policy')).toContain(new URL(env.JELLYFIN_URL).origin);});
 test('replaying the tour sends completed members to the guided tour on the real site',async()=>{const cookie=await login();expect((await get('/welcome',cookie)).status).toBe(302);const r=await get('/welcome?replay=1',cookie);expect(r.status).toBe(302);expect(r.headers.get('location')).toBe('/?tour=1');const js=await(await get('/assets/tour.js')).text();expect(js).toContain('sessionStorage');expect(js).toContain('#search');});
 test('announcement titles are escaped in the Home response',async()=>{const cookie=await login();await run(env.DB,"INSERT INTO announcements (title,body,kind,created_by) VALUES (?,?,?,?)",'<b>Maintenance</b>','A short pause','banner','admin');const body=await(await get('/',cookie)).text();expect(body).toContain('&lt;b&gt;Maintenance&lt;/b&gt;');expect(body).not.toContain('<b>Maintenance</b>');});
 test.each(['shell.js','member.js','devices-map.js','app.css','vendor/maplibre.js','vendor/pmtiles.js','vendor/maplibre.css'])('serves %s locally',async name=>{const r=await get('/assets/'+name);expect(r.status).toBe(200);expect(r.headers.get('content-type')).toContain(name.endsWith('.css')?'text/css':'text/javascript');expect(r.headers.get('cache-control')).toContain(name.startsWith('vendor/')?'31536000':'no-cache');expect((await r.text()).length).toBeGreaterThan(100);});
});

test('history has estimates, privacy copy and a labelled clear confirmation',async()=>{const body=await(await get('/history',await login())).text();for(const copy of ['id="history-stats"','Estimated from what Jellyfin records','Only you and admins can see your history.','id="history-clear-dialog"','aria-labelledby="history-clear-title"'])expect(body).toContain(copy);expect(body).not.toContain('Watched on');});
test('discover has the search icon and an Open Seerr button, and no notification-settings link',async()=>{const body=await(await get('/discover',await login())).text();expect(body).toContain('aria-label="Search titles"');expect(body).toContain('<circle cx="11" cy="11" r="7"');expect(body).toMatch(/<a class="btn pri"[^>]*href="https:\/\/seerr\.test"[^>]*>Open Seerr<\/a>/);expect(body).not.toContain('notification settings');expect(body).not.toContain('seerr.test/profile/settings"');});

test('every member navigation label has the mockup decorative icon and devices badge',async()=>{
 const body=await(await get('/account',await login())).text();
 const nav=body.match(/<nav aria-label="Main">([\s\S]*?)<\/nav>/)![1];
 const icons=['home','film','chart','dev','lock','pulse','help'];
 expect([...nav.matchAll(/<svg class="i" aria-hidden="true" focusable="false">/g)]).toHaveLength(11);
 for(const icon of icons){expect(nav).toContain(`href="#${icon}"`);expect(body).toContain(`<symbol id="${icon}"`);}
 expect(nav).toContain('href="/account" aria-current="page"');
 expect(nav).toContain('data-nav-count="devices"');expect(nav).not.toContain('data-nav-count="users"');
 expect(body).toContain('aria-controls="sidebar"');
});
test('status has an overall banner, services region and recent incidents',async()=>{
 const body=await(await get('/status',await login())).text();
 const content=body.slice(body.indexOf('<div class="status-page">'),body.indexOf('<noscript>'));
 for(const id of ['service-summary','overall-state','last-checked','services','incidents'])expect(content).toContain(`id="${id}"`);
 expect(content).toContain('No data yet');expect(content).toContain('Recent incidents');
 expect(content).toContain('role="status"');expect(content).toContain('aria-labelledby="incidents-title"');
 expect(content).not.toContain('day unknown');expect(content).not.toContain('Daily status details');
});
test('account keeps inline email verification and both password fields',async()=>{
 const body=await(await get('/account',await login())).text();
 expect([...body.matchAll(/class="card account(?: needs-email)?"/g)]).toHaveLength(6);
 for(const copy of ['Contact email','Not verified','Password','Warn me before access expires','Request emails','Open Seerr','Replay the tour','Download my data','Delete my account'])expect(body).toContain(copy);
 for(const id of ['current','next','email-password','email-address','email-code','reminders','password-strength'])expect(body).toContain(`id="${id}"`);
 expect(body).toContain('name="current" type="password" autocomplete="current-password"');
 expect(body).toContain('aria-controls="change-password" aria-expanded="false"');
 expect(body).toContain('id="change-password" hidden');expect(body).toContain('id="confirm-email" hidden');
 expect(body).toContain('pattern="[0-9]{6}"');
});
test('discover requests use compact rows and reveal five at a time',async()=>{
 const body=await(await get('/discover',await login())).text();
 expect(body).toContain('class="card requests-card"');expect(body).toContain('class="cat discover-grid request-grid" id="requests"');
 expect(body).toContain('id="requests" aria-busy="true"');
 const js=await(await get('/assets/member.js')).text();
 const requests=js.slice(js.indexOf('async function requests()'),js.indexOf("if(page==='discover')"));
 expect(requests).toContain('let shown=5');expect(requests).toContain('rows.slice(0,shown)');expect(requests).toContain('shown+=5');expect(requests).toContain("'Show more'");expect(requests).toContain('replaceChildren');expect(requests).not.toContain('innerHTML');
 for(const copy of ['discover-poster','discover-badge','has-img','r.posterUrl','r.year','r.createdAt','target.focus()',"'btn'"])expect(requests).toContain(copy);
 for(const label of ['In library','Approved','Pending','Declined'])expect(js).toContain("'"+label+"'");
});
test('discover renders accessible search, initial skeletons and a native details dialog',async()=>{
 const body=await(await get('/discover',await login())).text();
 for(const copy of ['tools discover-toolbar','aria-label="Clear search"','id="discover-results"','aria-live="polite"','aria-busy="true"','discover-skeleton','<dialog id="discover-dialog"','aria-labelledby="discover-title"','id="discover-close"'])expect(body).toContain(copy);
 expect(body).toContain('class="btn pri" type="button" data-tab="all" aria-pressed="true"');
});
test('discover uses safe DOM rendering, shared request state and keyboard controls',async()=>{
 const js=await(await get('/assets/member.js')).text();
 const discover=js.slice(js.indexOf("if(page==='discover')"),js.indexOf("if(page==='account')"));
 expect(discover).not.toContain('innerHTML');
 for(const copy of ['showModal()',"addEventListener('close'",'returnFocus','Requesting…',"setAttribute('role','alert')",'pending.has(key)', 'pending.add(key)', 'pending.delete(key)',"status='requested'",'say(',"e.key==='/'","e.key==='Escape'","classList.toggle('pri'",'replaceChildren','Try a different spelling, or check the other tab.'])expect(discover).toContain(copy);
 expect(discover).toContain("$('#discover-overview').textContent=r.overview");
 expect(discover).toContain("seasons:'all'");
});
test('discover layout has a responsive grid and motion is opt-in',async()=>{
 const css=await(await get('/assets/app.css')).text();
 expect(css).toContain('.discover-toolbar{position:sticky');
 expect(css).toContain('repeat(auto-fill,minmax(min(150px,100%),1fr))');
 expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{[^}]*discover-skeleton/);
});
test('home recently added reads items and builds an accessible poster shelf without innerHTML',async()=>{
 const body=await(await get('/',await login())).text();
 for(const copy of ['id="recent-line"','aria-busy="true"','recent-shelf','discover-skeleton','Recently added'])expect(body).toContain(copy);
 const js=await(await get('/assets/member.js')).text();
 const home=js.slice(js.indexOf('async function home()'),js.indexOf("if(page==='history')",js.indexOf('async function home()')));
 for(const copy of ["read('/api/home')",'s.items','slice(0,12)','tile(r,i,shelf.dataset.server,true)','replaceChildren','recentlyAdded','recent-shelf',"setAttribute('aria-label'",'tabIndex=0'])expect(home).toContain(copy);
 expect(home).not.toContain('innerHTML');
 const tile=js.slice(js.indexOf('function tile('),js.indexOf('async function home()'));
 expect(tile).toContain('encodeURIComponent(r.id)');expect(tile).toContain('captionBelow');expect(tile).not.toContain('innerHTML');
 const css=await(await get('/assets/app.css')).text();
 expect(css).toContain('scroll-snap-type:x proximity');expect(css).toContain('overflow-x:auto');
});
test('discover requests reject duplicate submissions, retry failures and retain successful state',async()=>{
 // Exercise the actual shipped request handler without a browser or live Seerr.
 const source=memberJs.slice(memberJs.indexOf(' async function request(r)'),memberJs.indexOf(' function openDetails'));
 const pending=new Set<string>(),errors=new Map<string,string>(),requested=new Set<string>();
 const row={id:42,mediaType:'tv',status:'partial'},data={films:[],tv:[row]};
 let resolve!:()=>void,reject!:(e:Error)=>void,calls=0,renders=0,refreshes=0;
 const payloads:unknown[]=[],announcements:string[]=[],states:boolean[]=[];
 const api=async(_url:string,payload:unknown)=>{calls++;payloads.push(payload);await new Promise<void>((ok,no)=>{resolve=ok;reject=no;});};
 const request=runInThisContext('(function(pending,errors,requested,keyOf,syncActions,ready,api,data,selected,render,dialog,say,region,requests){'+source+';return request;})')(
  pending,errors,requested,(r:typeof row)=>r.mediaType+':'+r.id,()=>states.push(pending.has('tv:42')),Promise.resolve(),api,data,null,()=>renders++,{open:false},(s:string)=>announcements.push(s),()=>refreshes++,()=>{}
 );
 const first=request(row);await Promise.resolve();await request(row);
 expect(calls).toBe(1);expect(pending.has('tv:42')).toBe(true);
 reject(new Error('Please try again.'));await first;
 expect(errors.get('tv:42')).toContain('Please try again.');expect(pending.size).toBe(0);expect(row.status).toBe('partial');
 const retry=request(row);await Promise.resolve();expect(errors.size).toBe(0);resolve();await retry;
 expect(calls).toBe(2);expect(payloads).toEqual([{mediaType:'tv',mediaId:42,seasons:'all'},{mediaType:'tv',mediaId:42,seasons:'all'}]);
 expect(row.status).toBe('requested');expect(requested.has('tv:42')).toBe(true);expect(pending.size).toBe(0);
 expect(renders).toBe(1);expect(refreshes).toBe(1);expect(announcements).toHaveLength(1);expect(states).toEqual([true,false,true,false]);
 await request(row);expect(calls).toBe(2);
});
test('devices pairs the map and sign-ins with a truthful recent-device summary',async()=>{
 const body=await(await get('/devices',await login())).text();
 expect(body).toContain('class="split devices-layout"');
 for(const id of ['map','signins','device-count','device-list'])expect(body).toContain(`id="${id}"`);
 expect(body).toContain('Recent devices');expect(body).not.toContain('Signed in now');expect(body).toContain('/help#device-guide');
});
test('help keeps searchable articles beside contact form and a four-choice device guide',async()=>{
 const body=await(await get('/help',await login())).text();
 expect(body).toContain('class="tools help-tools"');expect(body).toContain('class="split help-layout"');expect(body).toContain('class="card articles"');
 expect([...body.matchAll(/data-guide="/g)]).toHaveLength(4);
 for(const id of ['guide-instructions','copy-server','help-message'])expect(body).toContain(`id="${id}"`);
});

test('account chip and Home greeting have reusable avatar slots',async()=>{
 const body=await(await get('/',await login())).text();
 expect(body).toContain('data-account-name');
 expect([...body.matchAll(/data-self-avatar/g)]).toHaveLength(2);
 const js=await(await get('/assets/shell.js')).text();
 expect(js).toContain("api('/api/me'");expect(js).toContain('avatar(me.user.id,me.user.name)');
 expect(js).toContain("img.src='/api/avatar/'+encodeURIComponent(id)");
 expect(js).toContain("img.addEventListener('error',()=>img.remove(),{once:true})");
});
test('account shows Jellyfin profile picture settings with a safe external link',async()=>{
 const body=await(await get('/account',await login())).text();
 for(const text of ['Profile picture','Your picture comes from Jellyfin.','Change picture in Jellyfin'])expect(body).toContain(text);
 expect(body).toContain('href="'+env.JELLYFIN_URL.replace(/\/$/,'')+'/web/#/userprofile" target="_blank" rel="noopener noreferrer"');
 const js=await(await get('/assets/shell.js')).text();
 expect(js).toContain("+'/web/#/userprofile?userId='+encodeURIComponent(me.user.id)");
});

test('the map has a dark palette that follows the system theme',async()=>{
 const js=await(await get('/assets/devices-map.js')).text();
 for(const copy of ['prefers-color-scheme: dark',"'#121312'","'#10292b'",'setPaintProperty'])expect(js).toContain(copy);
});

test('sidebar has a collapse toggle with a remembered state in the shell script',async()=>{const body=await(await get('/discover',await login())).text();expect(body).toContain('id="side-toggle"');expect(body).toContain('aria-expanded="true"');expect(body).toContain('title="Home"');});

test('member Settings page offers theme choices and shortcuts; theme script loads before paint',async()=>{
 const res=await get('/settings',await login());const body=await res.text();
 expect(res.status).toBe(200);expect(body).toContain('<title>My settings · Jellypass</title>');
 for(const v of ['system','light','dark','oled'])expect(body).toContain(`name="theme" value="${v}"`);
 for(const copy of ['Appearance','Display','Notifications','Privacy and security','href="/devices"','href="/account"','id="prefs-reset"','id="pref-alerts"','id="pref-reminders"','id="pref-motion"','role="switch"','profile/settings'])expect(body).toContain(copy);
 expect(body).toContain('<script src="/assets/theme.js"></script>');
 const js=await get('/assets/theme.js');expect(js.status).toBe(200);expect(await js.text()).toContain("localStorage.getItem('theme')");
 expect(await(await get('/settings')).status).toBe(302);
});

test('sign-in page loads the shared poster wall script and wall.js is served',async()=>{
 const page=await(await get('/signin')).text();expect(page).toContain('/assets/wall.js');expect(page).toContain('id="poster-wall"');
 const js=await get('/assets/wall.js');expect(js.status).toBe(200);expect(await js.text()).toContain('/api/signin-posters');
});

test('Watch history has period tabs, a pager and no endless Show more',async()=>{
 const body=await(await get('/history',await login())).text();
 for(const k of ['week','month','90d','year','all'])expect(body).toContain(`data-range="${k}"`);
 expect(body).toContain('id="history-pager"');expect(body).toContain('role="tablist"');
 expect(memberJs).toContain('/api/history/list?page=');expect(memberJs).toContain('window.history.replaceState');expect(memberJs).not.toMatch(/[^.]history\.replaceState/);expect(memberJs).not.toContain('history-more');
});

test('no icon sprite symbol shares an id with a page element (a duplicate #search broke Discover)',async()=>{
 for(const path of ['/discover','/history','/account','/settings','/help','/status']){
  const body=await(await get(path,await login())).text();
  const symbols=[...body.matchAll(/<symbol id="([^"]+)"/g)].map(m=>m[1]);
  const ids=[...body.replace(/<symbol[\s\S]*?<\/symbol>/g,'').matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
  expect(symbols.filter(s=>ids.includes(s)),path).toEqual([]);
 }
});

test('Help has a hero with calls to action, four setup steps with the server address, device cards and official docs links',async()=>{
 const body=await(await get('/help',await login())).text();
 for(const id of ['help-hero-h','steps-h','help-server-url','help-copy-url','clients','client-grid','docs-h'])expect(body).toContain(`id="${id}"`);
 expect([...body.matchAll(/class="help-step-num"/g)]).toHaveLength(4);
 expect([...body.matchAll(/data-device="/g)]).toHaveLength(5);
 for(const u of ['https://jellyfin.org/downloads/clients/','https://jellyfin.org/docs/general/server/quick-connect/','https://jellyfin.org/docs/general/administration/troubleshooting/'])expect(body).toContain(u);
 expect(body).toContain('href="/discover"');expect(body).toContain('href="#clients"');
 expect(body).toMatch(/<a class="help-doc card" href="https:\/\/jellyfin\.org\/[^"]*" target="_blank" rel="noopener noreferrer">/);
 expect(body).not.toMatch(/<img[^>]+src="https?:\/\/(?!jf\.test)/); // no third-party images: illustrations are inline SVG
});

test('Help walks through sign-in with a Quick Connect box, and Wrapped is in the menu with a story player',async()=>{
 const help=await(await get('/help',await login())).text();
 for(const id of ['help-quickconnect','help-qc-code','help-qc-result'])expect(help).toContain(`id="${id}"`);
 expect(help).toContain('pattern="[0-9]{6}"');expect(memberJs).toContain("/api/onboarding/quickconnect");
 const wrapped=await get('/wrapped',await login());const body=await wrapped.text();
 expect(wrapped.status).toBe(200);expect(body).toContain('id="wrapped"');expect(body).toContain('id="wrapped-year"');
 expect(body).toContain('href="/wrapped"');
 expect(wrapped.headers.get('content-security-policy')).toContain('img-src');
 expect(memberJs).toContain('/api/wrapped');
});

test('first sign-in setup leads into the guided tour, every shell page loads the tour script, and Wrapped can be shared',async()=>{
 const first=await(await get('/welcome',await login(false))).text();
 expect(first).toContain('Continue to the tour');expect(first).not.toContain('data-art=');
 const js=await(await get('/assets/welcome.js')).text();expect(js).toContain("/?tour=1");
 const home=await(await get('/',await login())).text();expect(home).toContain('/assets/tour.js');
 const help=await(await get('/help',await login())).text();expect(help).toContain('href="/?tour=1"');
 const tour=await(await get('/assets/tour.js')).text();
 for(const target of ['#shelf','#search','.history-periods','#signins','#help-quickconnect','.theme-choices'])expect(tour).toContain(target);
 expect(memberJs).toContain('navigator.share');expect(memberJs).toContain("toBlob(r,'image/png')");expect(memberJs).toContain('w-sharecard');
});
test('phones get a bottom tab bar whose More button opens the drawer',async()=>{const body=await(await get('/discover',await login())).text();expect(body).toContain('aria-label="Quick links"');expect(body.match(/id="nav-open"/g)?.length).toBe(1);expect(body).toContain('viewport-fit=cover');expect(body).toMatch(/class="tab" href="\/discover" aria-current="page"/);});
test('Help sections collapse, articles carry steps and calls to action, and quick-help buttons exist',async()=>{
 const body=await(await get('/help',await login())).text();
 expect([...body.matchAll(/<details class="help-sec[^"]*"[^>]*data-sec="/g)]).toHaveLength(5);
 expect(body).toContain('id="clients"');expect(body).toContain('id="help-expand"');
 expect([...body.matchAll(/class="help-quick-btn"/g)].length).toBeGreaterThanOrEqual(5);
 expect(body).toContain('class="btn help-article-cta" href="/status"');expect(body).toContain('class="help-howto"');
 expect(body).toMatch(/data-subject="Can(&#39;|&#x27;|&apos;|')t sign in"/);
});
test('the tour adapts to phones (tab bar, More, bottom card) and tablets/desktop (menu), and points at Help quick answers',async()=>{
 const tour=await(await get('/assets/tour.js')).text();
 for(const part of ['.tabbar','max-width:700px','Tap More to find it','#sidebar','.help-quick','reveal(','buildSteps = (admin, phone)'])expect(tour).toContain(part);
 const body=await(await get('/help',await login())).text();expect(body).toContain('class="help-quick"');
});
test('Help offers store QR codes for desktop and a guide for each kind of TV, with official links only',async()=>{
 const body=await(await get('/help',await login())).text();
 expect([...body.matchAll(/class="help-qr-code"/g)]).toHaveLength(2);
 expect(body).toContain('https://apps.apple.com/gb/app/jellytv/id6752357290');expect(body).toContain('https://play.google.com/store/apps/details?id=org.jellyfin.mobile');
 for(const id of ['tv-samsung','tv-lg','tv-androidtv','tv-firetv','tv-appletv','tv-roku','tv-xbox','tv-other'])expect(body).toContain(`id="${id}"`);
 expect(body).not.toMatch(/api\.qrserver|chart\.googleapis|qrcode\.com/);
});
test('with no Seerr address configured the Open Seerr buttons are not shown',async()=>{
 const cookie=await login();
 const body=await(await app.request('/discover',{headers:{cookie}},{...env,SEERR_URL:''})).text();
 expect(body).not.toContain('Open Seerr');
 expect(await(await app.request('/discover',{headers:{cookie}},env)).text()).toContain('Open Seerr');
});

test('members are sent to the public Jellyfin and Seerr addresses when they are set, not the connection addresses',async()=>{
 const cookie=await login();
 const e={...env,JELLYFIN_URL:'http://192.168.1.10:8096',JELLYFIN_PUBLIC_URL:'https://watch.example.com',SEERR_URL:'http://192.168.1.10:5055',SEERR_PUBLIC_URL:'https://requests.example.com'};
 const csp=(await app.request('/',{headers:{cookie}},e)).headers.get('content-security-policy')||'';
 expect(csp).toContain('https://watch.example.com');expect(csp).not.toContain('192.168.1.10');
 const help=await(await app.request('/help',{headers:{cookie}},e)).text();
 expect(help).toContain('watch.example.com');expect(help).not.toContain('192.168.1.10');
 const discover=await(await app.request('/discover',{headers:{cookie}},e)).text();
 expect(discover).toContain('href="https://requests.example.com"');expect(discover).not.toContain('192.168.1.10');
 // with no public address set, the connection address is used as before
 const plain=await(await app.request('/discover',{headers:{cookie}},{...e,SEERR_PUBLIC_URL:''})).text();
 expect(plain).toContain('href="http://192.168.1.10:5055"');
});
