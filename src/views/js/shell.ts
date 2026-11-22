export const shellJs = String.raw`
import { $, api, setCsrf, act } from '/assets/common.js';
// DOM-only avatar shared by member and admin surfaces.
export function avatar(id, name) {
 const node=document.createElement('span');node.className='avatar';node.setAttribute('aria-hidden','true');
 const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
 node.textContent=parts.length>1?(parts[0][0]+parts.at(-1)[0]).toUpperCase():String(name||'?').slice(0,2).toUpperCase();
 let hash=0;for(const c of String(name||''))hash=(Math.imul(hash,31)+c.charCodeAt(0))|0;
 node.style.backgroundColor='hsl('+((hash>>>0)%360)+' 35% 32%)';
 if(/^[0-9a-f]{32}$/i.test(String(id))){
  const img=document.createElement('img');img.alt='';img.width=32;img.height=32;
  img.addEventListener('error',()=>img.remove(),{once:true});
  img.src='/api/avatar/'+encodeURIComponent(id);node.append(img);
 }
 return node;
}
export const ready = api('/api/me', null, 'GET').then(me => { setCsrf(me.csrf); document.documentElement.dataset.email = me.emailOn === false ? 'off' : 'on';
 document.querySelectorAll('[data-self-avatar]').forEach(slot=>slot.replaceChildren(avatar(me.user.id,me.user.name)));
 const name=$('[data-account-name]');if(name)name.textContent=me.user.name;
 const picture=$('#change-picture');if(picture)picture.href=picture.dataset.server.replace(/\/$/,'')+'/web/#/userprofile?userId='+encodeURIComponent(me.user.id);
 return me; });
ready.catch(error => { $('#error').textContent = error.message; });
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function read(path) { await ready; return api(path, null, 'GET'); }
const side = $('#sidebar'), open = $('#nav-open');
{ const app = side.parentElement, tog = $('#side-toggle');
  const set = collapsed => { app.classList.toggle('collapsed', collapsed); tog.setAttribute('aria-expanded', String(!collapsed)); const l = collapsed ? 'Expand sidebar' : 'Collapse sidebar'; tog.setAttribute('aria-label', l); tog.title = l; try { localStorage.setItem('side-collapsed', collapsed ? '1' : '0'); } catch {} };
  try { if (localStorage.getItem('side-collapsed') === '1') set(true); } catch {}
  tog.addEventListener('click', () => set(!app.classList.contains('collapsed'))); }
function closeNav() { side.classList.remove('open'); open.setAttribute('aria-expanded','false'); $('#content').inert = false; open.focus(); }
open.addEventListener('click', () => { side.classList.add('open'); open.setAttribute('aria-expanded','true'); $('#content').inert = true; $('#nav-close').focus(); });
$('#nav-close').addEventListener('click', closeNav);
side.addEventListener('keydown', e => {
 if (!side.classList.contains('open')) return;
 if (e.key === 'Escape') closeNav();
 if (e.key === 'Tab') { const nodes = [...side.querySelectorAll('a,button')].filter(n=>n.getClientRects().length); const first=nodes[0],last=nodes.at(-1); if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();} else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();} }
});
// Phones: tap outside the drawer or swipe it left to close; Close stays for keyboards.
document.addEventListener('click', e => { if (side.classList.contains('open') && !side.contains(e.target) && !open.contains(e.target)) closeNav(); });
{ let x0 = null; side.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  side.addEventListener('touchend', e => { if (x0 !== null && e.changedTouches[0].clientX - x0 < -60) closeNav(); x0 = null; }, { passive: true }); }
matchMedia('(min-width:901px)').addEventListener('change', e => { if(e.matches) {side.classList.remove('open');$('#content').inert=false;open.setAttribute('aria-expanded','false');} });
document.querySelectorAll('[data-signout]').forEach(b=>b.addEventListener('click',()=>act(async()=>{await ready;await api('/api/signout');location.assign('/signin');})));
read('/api/announcements').then(rows=>{ $('#announcements').innerHTML=rows.map(a=>'<div class="banner"><div><b>'+esc(a.title)+'</b><p>'+esc(a.body)+'</p></div></div>').join(''); }).catch(e=>{$('#error').textContent=e.message;});
// Counts are supplementary; an unavailable endpoint leaves its badge empty.
const counts = {
 devices: ['/api/signins', rows => new Set(rows.map(r=>r.device||'Unknown device')).size],
 users: ['/api/admin/users', rows => rows.length],
 invites: ['/api/admin/invites', rows => rows.filter(r=>Number(r.uses)<Number(r.max_uses)&&Date.parse(r.expires_at)>Date.now()).length]
};
document.querySelectorAll('[data-nav-count]').forEach(badge=>{
 const [url,count]=counts[badge.dataset.navCount];
 read(url).then(rows=>{badge.textContent=String(count(rows));}).catch(()=>{});
});

// On-screen keyboard open? The tab bar hides only then. The visual viewport shrinks by the keyboard's height while the layout viewport does not.
if (window.visualViewport) { const vv = window.visualViewport, set = () => document.documentElement.toggleAttribute('data-kbd', window.innerHeight - vv.height > 150); vv.addEventListener('resize', set); set(); }
// Notification bell: what's new, new sign-in places and Wrapped season. Each can be dismissed (remembered in this browser) or acted on.
{
 const stored=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch{return null;}};
 const WHATS_NEW={id:'2026-11-16',title:'What’s new in Jellypass',items:['Rate what you watch and mark part-watched titles as watched, on the History page','Push notices to this device, in Settings','Download your data or delete your account, under Account and security','Optional alerts in Settings: sign-ins from new places, a weekly summary and request-ready emails','A bottom tab bar on phones, and a new Compare page if you opt in under Settings']};
 const mk=(tag,t,cls)=>{const n=document.createElement(tag);if(t!=null)n.textContent=t;if(cls)n.className=cls;return n;};
 const a=(href,label)=>{const n=mk('a',label);n.href=href;return n;};
 // Desktop: a bell at the right end of the page's top row (after Open Jellyfin on Home), as well as the one in the menu.
 const top=document.querySelector('#content .top, .main .top');
 if(top){const b=document.createElement('button');b.type='button';b.className='bell top-bell';b.dataset.bell='';b.setAttribute('aria-expanded','false');b.setAttribute('aria-controls','bell-panel');b.setAttribute('aria-label','Notifications');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','i');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 004 0');svg.append(path);
  const c=document.createElement('span');c.className='bell-count';c.hidden=true;b.append(svg,c);top.append(b);}
 const panel=$('#bell-panel'),list=$('#bell-list'),buttons=[...document.querySelectorAll('[data-bell]')];
 let items=[];
 const render=()=>{
  const live=items.filter(i=>stored(i.key)!=='1');
  buttons.forEach(b=>{const c=b.querySelector('.bell-count');c.hidden=!live.length;c.textContent=String(live.length);b.setAttribute('aria-label',live.length?'Notifications, '+live.length+' new':'Notifications');});
  list.replaceChildren(...(live.length?live.map(i=>{const row=mk('div','','bell-item'),body=mk('div','','bell-body'),x=mk('button','Dismiss','btn bell-x');x.type='button';x.onclick=()=>{stored(i.key,'1');render();};body.append(...i.nodes);row.append(body,x);return row;}):[mk('p','You are all caught up.','muted bell-empty')]));
 };
 const setOpen=on=>{panel.hidden=!on;buttons.forEach(b=>b.setAttribute('aria-expanded',String(on)));};
 buttons.forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();setOpen(panel.hidden);if(!panel.hidden)panel.querySelector('button,a')?.focus({preventScroll:true});}));
 document.addEventListener('click',e=>{if(!panel.hidden&&!panel.contains(e.target))setOpen(false);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){setOpen(false);buttons.find(b=>b.offsetParent)?.focus();}});
 panel.addEventListener('click',e=>{if(e.target.closest('a'))setOpen(false);});
 (async()=>{
  const out=[],d=new Date(),m=d.getMonth();
  try{for(const r of await read('/api/notices'))out.push({key:'jp-notice-'+r.id,nodes:[mk('b',r.title),mk('span',' '+r.body+' ','muted'),...(r.link?[a(r.link,'Open')]:[])]});}catch{}
  try{for(const r of await read('/api/home/alerts'))out.push({key:'jp-alert-'+r.id,nodes:[mk('b','New sign-in'+(r.city?' from '+r.city:' from somewhere new')),mk('span',' on '+(r.device||'a device')+', '+new Date(r.seenAt).toLocaleString([],{dateStyle:'medium',timeStyle:'short'})+'. ','muted'),a('/devices','Review devices'),mk('span',' · ','muted'),a('/account','Secure my account')]});}catch{}
  if(m===11||m===0){const y=m===11?d.getFullYear():d.getFullYear()-1;out.push({key:'jp-wrapped-'+y,nodes:[mk('b','Your '+y+' Wrapped is ready'),mk('span',' A look back at your year in watching. ','muted'),a('/wrapped','See my Wrapped')]});}
  const ul=mk('ul','','bell-list-items');WHATS_NEW.items.forEach(t=>ul.append(mk('li',t)));out.push({key:'jp-new-'+WHATS_NEW.id,nodes:[mk('b',WHATS_NEW.title),ul]});
  items=out;render();
 })();
}
`;
