export const memberJs = String.raw`
import { $, api, act, submit } from '/assets/common.js';
import { ready, read, esc, avatar } from '/assets/shell.js';
const page=$('[data-page]').dataset.page;
const say = text => { $('#status').textContent=text; };
const date = value => value ? new Date(value).toLocaleString('en-GB') : 'Date unknown';
async function region(id,fn) { try {await fn();} catch(e) { $(id).textContent=e.message;$('#error').textContent=e.message; } }
function poster(row) { return row.posterUrl ? '<img class="thumb" src="'+esc(row.posterUrl)+'" alt="" loading="lazy">' : '<span class="thumb placeholder" aria-hidden="true"></span>'; }
function progress(value) { if(value==null) return ''; const pct=Math.max(0,Math.min(100,Number(value)||0)); return '<span class="prog" role="img" aria-label="'+esc(pct)+' percent watched"><i style="width:'+esc(pct)+'%"></i></span> <span class="num">'+esc(pct)+'%</span>'; }
const PAGE=25;
let historyVersion=0;
const dayStart = d => { const n=new Date(d); n.setHours(0,0,0,0); return +n; };
function dayLabel(iso) {
 if(!iso) return 'Date unknown'; const t=dayStart(Date.now()), d=dayStart(Date.parse(iso)), day=86400000;
 const yesterday=new Date(t);yesterday.setDate(yesterday.getDate()-1);
 if(d===t) return 'Today'; if(d===+yesterday) return 'Yesterday';
 return new Date(iso).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:d<t-300*day?'numeric':undefined});
}
const timeOf = iso => iso ? new Date(iso).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : '';
function runtime(min) { if(min==null) return ''; return min>=60 ? Math.floor(min/60)+'h'+(min%60?' '+(min%60)+'m':'') : min+'m'; }
const RANGE_LABEL={week:'Last 7 days',month:'Last 30 days','90d':'Last 90 days',year:'Last 12 months',all:'Last 12 months'};
const RANGE_PREV={week:'previous 7 days',month:'previous 30 days','90d':'previous 90 days',year:'previous 12 months',all:'previous 12 months'};
const hState={kind:'',range:'month',page:1,pages:1};
const hSaveRange=()=>{try{localStorage.setItem('history-range',hState.range);}catch{}window.history.replaceState(null,'','#'+hState.range+(hState.page>1?'&p='+hState.page:''));};
async function history() {
 const version=++historyVersion;
 const server=$('#history-list').dataset.server.replace(/\/$/,'');
 const partial=r=>r.resumePct!=null&&r.resumePct<100;
 const resume=r=>!partial(r)?'':'<a class="btn" href="'+esc(server+'/web/#/details?id='+encodeURIComponent(r.id))+'">Resume</a>';
 const detail=r=>r.kind==='tv'?'TV · '+r.subtitle.replace(/^S(\d+|\?)E(\d+|\?)(?: · .*)?$/, 'Season $1 · Episode $2'):'Film'+(r.runtimeMinutes?' · '+runtime(r.runtimeMinutes):'');
 const row=r=>'<div class="history-row"><div class="history-poster poster p1" data-badge-id="'+esc(r.id)+'" style="--p:'+esc(partial(r)?r.resumePct:100)+'%">'+poster(r)+'</div><div class="grow"><b>'+esc(r.title)+'</b><p class="faint">'+esc(detail(r))+'</p><p class="faint">'+esc(r.lastPlayed?dayLabel(r.lastPlayed)+', '+timeOf(r.lastPlayed):'Date unknown')+'</p></div><div class="history-progress">'+(partial(r)?progress(r.resumePct):'<span class="muted"><span class="dot finished-dot"></span>Finished</span>')+'</div><div class="history-actions"><span class="stars" role="group" aria-label="Your rating for '+esc(r.title)+'">'+[1,2,3,4,5].map(n=>'<button type="button" class="star'+(r.rating>=n?' on':'')+'" data-rate="'+esc(r.id)+'" data-stars="'+n+'" aria-pressed="'+(r.rating===n)+'" aria-label="'+n+(n===1?' star':' stars')+'">★</button>').join('')+'</span>'+resume(r)+(partial(r)?'<button class="btn" data-watched="'+esc(r.id)+'" aria-label="Mark '+esc(r.title)+' as watched">Mark watched</button>':'')+'<button class="btn ghost" data-remove="'+esc(r.id)+'" aria-label="Remove '+esc(r.title)+' from history">Remove</button></div></div>';
 const q='/api/history/list?page='+hState.page+'&size=20'+(hState.kind?'&kind='+hState.kind:'')+(hState.range!=='all'?'&range='+hState.range:'');
 $('#history-list').setAttribute('aria-busy','true');
 const data=await read(q);
 if(version!==historyVersion)return;
 if(data.page!==hState.page){hState.page=data.page;hSaveRange();}
 hState.pages=data.pages;
 const groups=[]; for(const r of data.items){ const g=dayLabel(r.lastPlayed); const last=groups[groups.length-1]; if(last&&last[0]===g) last[1].push(r); else groups.push([g,[r]]); }
 const periodText=hState.range==='all'?'':' in the '+RANGE_LABEL[hState.range].toLowerCase();
 $('#history-list').innerHTML=groups.map(([g,items])=>'<section class="history-group"><h2>'+esc(g)+'</h2><div class="card">'+items.map(row).join('')+'</div></section>').join('')||'<p class="card pad">Nothing watched'+esc(periodText)+'. What you watch in Jellyfin appears here automatically.</p>';
 $('#history-list').setAttribute('aria-busy','false');badges($('#history-list'));
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>act(async()=>{await api('/api/history/'+encodeURIComponent(b.dataset.remove)+'/remove');say('Removed from your history.');await Promise.all([history(),region('#history-stats',historyStats)]);}));
 document.querySelectorAll('[data-rate]').forEach(b=>b.onclick=()=>act(async()=>{const was=b.getAttribute('aria-pressed')==='true';await api('/api/history/'+encodeURIComponent(b.dataset.rate)+'/rating',{stars:was?0:Number(b.dataset.stars)},'PUT');await history();}));
 document.querySelectorAll('[data-watched]').forEach(b=>b.onclick=()=>act(async()=>{await api('/api/history/'+encodeURIComponent(b.dataset.watched)+'/watched',{played:true});say('Marked as watched.');await Promise.all([history(),region('#history-stats',historyStats)]);}));
 renderPager(data);
}
function renderPager(d) {
 const nav=$('#history-pager');nav.replaceChildren();
 if(d.total===0){nav.hidden=true;return;}
 nav.hidden=false;
 const from=(d.page-1)*d.size+1,to=Math.min(d.total,d.page*d.size);
 const go=n=>act(async()=>{hState.page=n;hSaveRange();await history();const top=$('#history-top');if(top){top.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});top.focus({preventScroll:true});}});
 nav.append(text('p','Showing '+from+'–'+to+' of '+d.total,'faint history-count'));
 if(d.pages<=1)return;
 const bar=text('div','','history-pages');
 const btn=(label,n,opts={})=>{const b=text('button',label,'btn'+(opts.cur?' pri':''));b.type='button';if(opts.aria)b.setAttribute('aria-label',opts.aria);if(opts.cur)b.setAttribute('aria-current','page');if(opts.dis)b.disabled=true;else if(!opts.cur)b.onclick=()=>go(n);return b;};
 bar.append(btn('Previous',d.page-1,{dis:d.page<=1,aria:'Previous page'}));
 const nums=text('span','','history-numbers');
 const set=new Set([1,d.pages,d.page-1,d.page,d.page+1]);let last=0;
 [...set].filter(n=>n>=1&&n<=d.pages).sort((a,b)=>a-b).forEach(n=>{if(last&&n-last>1)nums.append(text('span','…','history-gap'));nums.append(btn(String(n),n,{cur:n===d.page,aria:'Page '+n}));last=n;});
 bar.append(nums,text('span','Page '+d.page+' of '+d.pages,'history-mobile-count faint'),btn('Next',d.page+1,{dis:d.page>=d.pages,aria:'Next page'}));
 nav.append(bar);
}
async function historyStats() {
 const range=hState.range==='all'?'year':hState.range;
 const s=await read('/api/history/summary?range='+range), target=$('#history-stats');
 const card=(title)=>{const n=text('section','','card pad');n.append(text('h3',title));return n;};
 const main=card(RANGE_LABEL[hState.range]);main.append(text('div',s.totalHours.toFixed(1)+' h','history-total num'));
 const diff=Math.round((s.totalHours-s.previousHours)*10)/10;
 main.append(text('p',diff===0?'The same as the '+RANGE_PREV[hState.range]:Math.abs(diff).toFixed(1)+' h '+(diff<0?'less':'more')+' than the '+RANGE_PREV[hState.range],'muted'));
 const ns='http://www.w3.org/2000/svg',W=300,H=100,n=s.buckets.length,slot=W/n,bw=Math.max(2,slot*0.72);
 const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 '+W+' '+(H+14));svg.setAttribute('role','img');svg.classList.add('history-bars');
 const unit=range==='year'?'month':range==='90d'?'week':'day';
 svg.setAttribute('aria-label','Estimated hours watched per '+unit+': '+s.totalHours.toFixed(1)+' hours in total over '+n+' '+unit+'s');
 const max=Math.max(1,...s.buckets.map(x=>x.hours));
 const fmt=b=>range==='year'?new Date(b.start).toLocaleDateString('en-GB',{month:'short',year:'numeric'}):(range==='90d'?'Week of ':'')+new Date(b.start).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
 s.buckets.forEach((b,i)=>{
  const h=Math.max(b.hours>0?2:0,b.hours/max*H),r=document.createElementNS(ns,'rect');
  r.setAttribute('x',(i*slot+(slot-bw)/2).toFixed(2));r.setAttribute('y',(H-h).toFixed(2));r.setAttribute('width',bw.toFixed(2));r.setAttribute('height',h.toFixed(2));r.setAttribute('rx','2');r.setAttribute('class','history-bar'+(b.hours>0?'':' is-empty'));r.style.setProperty('--i',i);
  const t=document.createElementNS(ns,'title');t.textContent=fmt(b)+': '+b.hours.toFixed(1)+' h';r.append(t);svg.append(r);
 });
 const every=range==='week'?1:range==='month'?7:range==='90d'?3:2;
 s.buckets.forEach((b,i)=>{if((n-1-i)%every!==0)return;const x=document.createElementNS(ns,'text');x.setAttribute('x',(i*slot+slot/2).toFixed(2));x.setAttribute('y',H+11);x.setAttribute('text-anchor',i===0?'start':i===n-1?'end':'middle');x.setAttribute('class','history-axis');x.textContent=range==='year'?new Date(b.start).toLocaleDateString('en-GB',{month:'short'}):range==='week'?new Date(b.start).toLocaleDateString('en-GB',{weekday:'short'}):new Date(b.start).toLocaleDateString('en-GB',{day:'numeric',month:'short'});if(i===0&&x.getAttribute('text-anchor')==='start'&&n>1)x.setAttribute('x','0');svg.append(x);});
 main.append(s.totalHours>0?svg:text('p','Nothing watched in this period.','muted'));
 main.append(text('p',s.titles+' titles · about '+s.perDayHours.toFixed(1)+' h a day','faint'));
 const split=card('Films and TV');
 [['TV shows',s.tvHours],['Films',s.filmsHours]].forEach(([label,hours])=>{const row=text('div','','history-stat-row');row.append(text('span',label),text('span',hours.toFixed(1)+' h','num muted'));const bar=text('div','','prog'),fill=document.createElement('i');fill.style.width=(s.totalHours?Math.min(100,hours/s.totalHours*100):0)+'%';bar.append(fill);split.append(row,bar);});
 split.append(text('p',s.films+' films · '+s.episodes+' episodes','faint'));
 const most=card('Most watched'),list=text('ul','','list');s.mostWatched.forEach(r=>list.append(li(text('span',r.title,'grow'),text('span',r.hours.toFixed(1)+' h','num faint'))));most.append(s.mostWatched.length?list:text('p','Nothing watched in this period.','muted'));
 target.replaceChildren(main,split,most);
}
const statusDate = day => new Date(day+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
async function services() {
 const data=await read('/api/status');
 const bad=data.services.some(s=>s.ok===false),good=data.services.some(s=>s.ok===true);
 const allBad=data.services.length>0&&data.services.every(s=>s.ok===false);
 $('#overall-state').textContent=bad?'Some systems have problems':good?'All systems operational':'No data yet';
 $('#service-summary').dataset.state=bad?'problem':good?'operational':'unknown';
 $('#service-summary').dataset.severity=allBad?'major':'partial';
 const checked=data.services.map(s=>Date.parse(s.checkedAt)).filter(Number.isFinite),last=$('#last-checked');
 if(checked.length){
  const latest=Math.max(...checked),minutes=Math.max(0,Math.floor((Date.now()-latest)/60000)),hours=Math.floor(minutes/60),days=Math.floor(hours/24);
  last.textContent='Checked '+(minutes<1?'just now':minutes<60?minutes+(minutes===1?' minute ago':' minutes ago'):hours<24?hours+(hours===1?' hour ago':' hours ago'):days+(days===1?' day ago':' days ago'));
  last.title=new Date(latest).toLocaleString('en-GB',{dateStyle:'full',timeStyle:'long'});
 }else{last.textContent='Not checked yet';last.removeAttribute('title');}
 const descriptions={jellyfin:'Streaming and sign-in',seerr:'Finding and requesting titles',portal:'Your membership and account',email:'Sign-in codes and notifications'};
 const today=new Date().toISOString().slice(0,10),end=Date.parse(today+'T00:00:00Z');
 $('#services').replaceChildren(...data.services.map(s=>{
  const row=text('article','','status-service'),head=text('div','','status-service-head');
  const name=text('div','','status-service-name');name.append(text('h3',s.label),text('p',descriptions[s.service]||'Service monitoring','muted'));
  const health=text('div','','status-service-health'),chip=text('span',s.ok===true?'Operational':s.ok===false?'Problem':'No data','status-chip');
  chip.dataset.state=s.ok===true?'operational':s.ok===false?'problem':'unknown';health.append(chip);
  if(s.ok!=null&&Number.isFinite(s.latencyMs))health.append(text('span',s.latencyMs+' ms','muted num'));
  const uptime=text('span',Number.isFinite(s.uptime)?s.uptime.toFixed(1)+'% uptime':'No uptime data','status-uptime');
  uptime.title='Passed checks over the last 90 days; days without checks are excluded';health.append(uptime);
  head.append(name,health);row.append(head);
  const byDay=new Map(s.days.map(d=>[d.day,d]));
  const days=Array.from({length:90},(_,i)=>{const day=new Date(end-(89-i)*86400000).toISOString().slice(0,10);return byDay.get(day)||{day,checks:0,failed:0};});
  const recorded=days.filter(d=>d.checks>0),problems=recorded.filter(d=>d.failed>0);
  const strip=text('div','','status-strip');strip.setAttribute('role','img');
  strip.setAttribute('aria-label',s.label+': 90-day monitoring history. '+recorded.length+' days with checks, '+problems.length+' days with failures, '+(90-recorded.length)+' days with no data.');
  const summary=text('ul','','sr-only');
  days.forEach(d=>{
   const state=d.quiet?'healthy':d.checks===0?'unknown':d.failed===0?'healthy':d.failed<d.checks?'warning':'problem';
   const label=statusDate(d.day).replace(/ \d{4}$/,'')+': '+(d.quiet?'No emails sent, no problems':d.checks===0?'No checks recorded':d.failed===0?d.checks+' checks, all passed':d.failed+' of '+d.checks+' checks failed');
   const bar=text('span','','status-bar');bar.dataset.state=state;bar.title=label;bar.setAttribute('aria-label',label);strip.append(bar);
   if(d.checks>0)summary.append(text('li',label));
  });
  const caption=text('div','','status-strip-caption muted');caption.append(text('span','90 days ago'),text('span','Today'));
  row.append(strip,caption,summary);return row;
 }));
 if(!data.services.length)$('#services').append(text('p','No service data yet.','status-empty muted'));
 $('#services').setAttribute('aria-busy','false');
 $('#status-since').textContent=data.since?'Monitoring since '+statusDate(data.since):'Monitoring will appear after the first check.';
 $('#incidents').replaceChildren(...data.incidents.map(i=>{
  const row=text('article','','status-incident'),when=text('time',date(i.created_at),'muted num');when.dateTime=i.created_at;
  row.append(when,text('h3',i.title),text('p',i.body));return row;
 }));
 if(!data.incidents.length){
  const empty=text('div','','status-empty'),icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
  icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');icon.setAttribute('stroke-width','1.5');
  const circle=document.createElementNS(icon.namespaceURI,'circle');circle.setAttribute('cx','12');circle.setAttribute('cy','12');circle.setAttribute('r','9');
  const check=document.createElementNS(icon.namespaceURI,'path');check.setAttribute('d','m8 12 3 3 5-6');icon.append(circle,check);
  empty.append(icon,text('p','No incidents reported'));$('#incidents').append(empty);
 }
 $('#incidents').setAttribute('aria-busy','false');
}
const ago = value => { const m=Math.round((Date.now()-Date.parse(value))/60000); if(!Number.isFinite(m)||m<0) return ''; if(m<2) return 'Now'; if(m<60) return m+' min ago'; const h=Math.round(m/60); if(h<24) return h+' h ago'; const d=Math.round(h/24); return d+(d===1?' day ago':' days ago'); };
const dotColour = status => status==='Ready'?'var(--ok)':status==='Declined'?'var(--warn)':'var(--idle)';
// BBFC age rating and best available quality, shared by Home, Requests and Discover.
function chips(r) { if(!r.rating&&!r.quality) return null; const w=document.createElement('span'); w.className='chips';
 if(r.rating){const b=text('span',r.rating,'bbfc');b.dataset.r=r.rating;b.title='BBFC '+r.rating;b.setAttribute('aria-label','BBFC rating '+r.rating);w.append(b);}
 if(r.quality){const q=text('span',r.quality,'qual');q.setAttribute('aria-label','Quality '+r.quality);w.append(q);}
 return w; }
// Age rating and quality on every poster the page shows: elements marked data-badge-id get chips from /api/badges (one request per shelf).
async function badges(root){ const els=[...(root||document).querySelectorAll('[data-badge-id]:not([data-badged])')]; if(!els.length) return;
 els.forEach(e=>e.dataset.badged='1'); const ids=[...new Set(els.map(e=>e.dataset.badgeId))].slice(0,30);
 try{ const map=await read('/api/badges?ids='+ids.join(',')); els.forEach(e=>{const c=chips(map[e.dataset.badgeId]||{}); if(c){c.classList.add('tile-chips');e.append(c);}}); }catch{} }
function li(...nodes) { const n=document.createElement('li'); n.append(...nodes); return n; }
function text(tag,value,cls) { const n=document.createElement(tag); n.textContent=value; if(cls) n.className=cls; return n; }
function link(href,label) { const a=document.createElement('a'); a.href=href; a.textContent=label; return a; }
function tile(r,i,server,captionBelow=false) {
 const a=document.createElement('a'),posterClass='poster p'+((i%6)+1);
 a.className=captionBelow?'recent-tile':posterClass;a.href=server.replace(/\/$/,'')+'/web/#/details?id='+encodeURIComponent(r.id);
 const art=captionBelow?text('span','',posterClass):a;
 art.dataset.badgeId=r.id;
 if(r.resumePct!=null) art.style.setProperty('--p',Math.max(0,Math.min(100,Number(r.resumePct)||0))+'%');
 if(r.posterUrl){ const img=document.createElement('img'); img.src=r.posterUrl; img.alt=''; img.loading='lazy'; art.classList.add('has-img'); art.append(img);
  if(captionBelow)img.addEventListener('error',()=>{img.remove();art.classList.remove('has-img');art.append(text('span',r.title));},{once:true});
 }
 const label=document.createElement('span'); label.append(document.createTextNode(r.title)); if(r.subtitle){ label.append(document.createElement('br'),text('small',r.subtitle)); }
 if(captionBelow){art.setAttribute('aria-hidden','true');if(!r.posterUrl)art.append(text('span',r.title));label.className='recent-caption';a.append(art,label);}
 else a.append(label);
 return a;
}
async function home() {
 const shelf=$('#shelf');
 read('/api/status').then(data=>{const values=data.services;const bad=values.some(s=>s.ok===false),good=values.some(s=>s.ok===true);const line=$('#status-line');line.dataset.state=bad?'bad':good?'ok':'idle';line.querySelector('span:nth-child(2)').textContent=bad?'Service disruption':good?'All systems operational':'No data yet';}).catch(()=>{});
 region('#shelf',async()=>{
  const rows=await read('/api/history'); const resume=rows.filter(r=>r.resumePct!=null);
  const picks=(resume.length?resume:rows).slice(0,4);
  if(!picks.length){ shelf.replaceChildren(text('p','Nothing watched yet. Your first watch starts in Jellyfin; once you start, this is where you pick up again.','muted'),link('/discover','Find something to ask for')); return; }
  const wrap=document.createElement('div'); wrap.className='shelf'; picks.forEach((r,i)=>wrap.append(tile(r,i,shelf.dataset.server))); shelf.replaceChildren(wrap);badges(shelf);
 });
 region('#home-requests',async()=>{
  const rows=(await read('/api/discover/requests?limit=5')); const ul=$('#home-requests');
  if(!rows.length){ ul.replaceChildren(li(text('span','No requests yet. ','muted'),link('/discover','Ask for something'))); return; }
  const server=($('#shelf')?.dataset.server||'').replace(/\/$/,'');
  ul.replaceChildren(...rows.map(r=>{
   const label=r.available?'Ready':r.status==='declined'?'Declined':r.status==='approved'?'Approved':'Pending';
   const title=r.title||((r.mediaType==='tv'?'TV show':'Film')+' '+r.tmdbId);
   const art=r.posterUrl?Object.assign(document.createElement('img'),{src:r.posterUrl,alt:'',loading:'lazy',width:40,height:60}):text('span','','req-poster');
   art.classList.add('req-poster');
   const dot=document.createElement('span'); dot.className='dot'; dot.style.background=dotColour(label);
   const state=text('span',label,'req-state'); state.prepend(dot);
   const sub=[r.mediaType==='tv'?'TV show':'Film',r.year].filter(Boolean).join(' · ');
   const main=document.createElement('span'); main.className='req-main'; const subLine=text('small',sub,'muted'),c=chips(r);if(c)subLine.append(' ',c);main.append(text('b',title),subLine);
   // Ready titles open their Jellyfin page by id (a title search if the id is unknown); the rest have nothing to open yet.
   const row=r.available&&server?Object.assign(document.createElement('a'),{href:server+(r.jellyfinId?'/web/#/details?id='+r.jellyfinId:'/web/#/search?query='+encodeURIComponent(r.title||''))}):document.createElement('div');
   row.className='req-row'; if(row.href) row.title='Open in Jellyfin'; row.append(art,main,state); return li(row);
  }));
 });
 // Surprise me: a random unwatched film and a random unwatched show from the member's own library, each with its own "Another one".
 async function pick(kind,btn){ const box=$(kind==='tv'?'#surprise-tv':'#surprise-film'),word=kind==='tv'?'show':'film'; if(btn)btn.disabled=true;
  try{ const f=await read('/api/home/surprise?kind='+kind); if(!f){box.replaceChildren(text('p',kind==='tv'?'You have started every show we have.':'You have seen every film we have.','muted'));return;}
   const art=f.posterUrl?Object.assign(document.createElement('img'),{src:f.posterUrl,alt:'',width:56,height:84,className:'surprise-poster'}):text('span','','surprise-poster');
   const wrap=text('span','','surprise-art');wrap.dataset.badgeId=f.id;wrap.append(art); // age rating and quality come from /api/badges (the BBFC certificate, not Jellyfin's raw GB-15)
   const meta=[f.year,...f.genres.slice(0,2)].filter(Boolean).join(' · ');
   const acts=text('div','','surprise-actions'); const more=text('button','Another '+word,'btn');more.type='button';more.onclick=()=>pick(kind,more);
   const server=($('#shelf')?.dataset.server||''); if(server){const w=link(server+'/web/#/details?id='+encodeURIComponent(f.id),'Open');w.className='btn pri';acts.append(w);} acts.append(more);
   const info=text('div','','surprise-info');info.append(text('small',kind==='tv'?'TV show':'Film','surprise-kind'),text('b',f.title),text('small',meta,'muted'),text('p',f.overview,'surprise-text'),acts);
   box.replaceChildren(wrap,info);badges(box);
  }catch{ box.replaceChildren(text('p','Could not pick one right now.','muted')); }
 }
 pick('film');pick('tv');
 const recent=$('#recent-line');
 try {
  const s=await read('/api/home'),items=Array.isArray(s.items)?s.items.slice(0,12):[];
  if(items.length){
   const heading=text('h2',typeof s.recentlyAdded==='number'?'Recently added this week · '+s.recentlyAdded+(s.recentlyAdded===1?' title':' titles'):'Recently added');heading.id='recent-title';
   const row=text('div','','recent-shelf');row.tabIndex=0;row.setAttribute('role','region');row.setAttribute('aria-label','Recently added titles');
   row.append(...items.map((r,i)=>tile(r,i,shelf.dataset.server,true)));recent.replaceChildren(heading,row);badges(recent);
  } else if(typeof s.recentlyAdded==='number') {
   recent.removeAttribute('aria-labelledby');recent.replaceChildren(text('p','Recently added this week: '+s.recentlyAdded+(s.recentlyAdded===1?' title':' titles')+' across Movies and TV.','faint'));
  } else {recent.replaceChildren();recent.hidden=true;}
 } catch {recent.replaceChildren();recent.hidden=true;}
 finally {recent.setAttribute('aria-busy','false');}
}

if(page==='history') {
 const fromHash=location.hash.slice(1).split('&'),valid=['week','month','90d','year','all'];
 let saved='';try{saved=localStorage.getItem('history-range')||'';}catch{}
 hState.range=valid.includes(fromHash[0])?fromHash[0]:valid.includes(saved)?saved:'month';
 const pageNo=parseInt((fromHash.find(x=>x.startsWith('p='))||'').slice(2),10);hState.page=pageNo>=1?pageNo:1;
 const paint=()=>document.querySelectorAll('[data-range]').forEach(x=>{const on=x.dataset.range===hState.range;x.setAttribute('aria-selected',String(on));x.tabIndex=on?0:-1;x.classList.toggle('pri',on);});
 const reload=()=>Promise.all([region('#history-list',()=>history()),region('#history-stats',historyStats)]);
 const tabs=[...document.querySelectorAll('[data-range]')];
 tabs.forEach((b,i)=>{b.onclick=()=>{hState.range=b.dataset.range;hState.page=1;hSaveRange();paint();reload();};b.onkeydown=e=>{const k={ArrowRight:1,ArrowLeft:-1}[e.key];if(!k)return;e.preventDefault();const t=tabs[(i+k+tabs.length)%tabs.length];t.focus();t.click();};});
 document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-kind]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));hState.kind=b.dataset.kind;hState.page=1;hSaveRange();region('#history-list',()=>history());});
 paint();reload();
 const dialog=$('#history-clear-dialog');$('#history-clear').onclick=()=>dialog.showModal();$('#history-clear-cancel').onclick=()=>dialog.close();
 $('#history-clear-confirm').onclick=()=>act(async()=>{const button=$('#history-clear-confirm');button.disabled=true;try{await ready;await api('/api/history/clear');dialog.close();hState.page=1;await reload();say('History cleared.');}finally{button.disabled=false;}});
}
if(page==='status') region('#services',async()=>{try{await services();}catch(e){$('#overall-state').textContent='Status unavailable';$('#service-summary').dataset.state='unknown';$('#last-checked').textContent='Could not check services. Refresh to try again.';$('#last-checked').removeAttribute('title');$('#status-since').textContent='Monitoring history unavailable.';$('#incidents').textContent='Incident history unavailable.';throw e;}finally{$('#services').setAttribute('aria-busy','false');$('#incidents').setAttribute('aria-busy','false');}});
// Optional Home cards fail quietly: a slow Seerr or Jellyfin must never put an error banner on Home.
const quiet=fn=>fn().catch(()=>{});
function homeExtras(){
 const server=($('#shelf')?.dataset.server||'');
 // Account card: setup checklist for new members and an access countdown.
 quiet(async()=>{
  const [acc,devs]=await Promise.all([read('/api/account'),read('/api/signins').catch(()=>[])]);
  const names=new Set(devs.map(r=>r.device||'').filter(n=>n&&n!=='Jellypass'));
  const steps=[['Verify your contact email',acc.emailVerified,'/account','Verify'],['Sign in on a TV or phone',names.size>0,'/help#clients','Set up a device']].filter(x=>!(x[0]==='Verify your contact email'&&document.documentElement.dataset.email==='off'));
  const left=steps.filter(x=>!x[1]),days=acc.expiresAt?Math.ceil((Date.parse(acc.expiresAt)-Date.now())/86400000):null,ending=days!==null&&days<=60;
  const card=$('#home-account'); if(!left.length&&!ending){card.hidden=true;return;}
  const h=text('h2',left.length?'Finish setting up':'Your access','');h.id='home-account-h';h.style.fontSize='16px';const parts=[h];
  if(left.length){const done=steps.length-left.length,bar=text('div','','home-progress');bar.setAttribute('role','progressbar');bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax',String(steps.length));bar.setAttribute('aria-valuenow',String(done));bar.setAttribute('aria-label',done+' of '+steps.length+' done');const fill=text('span');fill.style.setProperty('--w',Math.round(done/steps.length*100)+'%');bar.append(fill);
   const ul=text('ul','','home-checklist');steps.forEach(([t,ok,href,cta])=>{const row=li(text('span',ok?'✓':'○','home-check'+(ok?' is-done':'')),text('span',t,'grow'));if(!ok){const a=link(href,cta);a.className='btn';row.append(a);}ul.append(row);});parts.push(bar,ul);}
  if(ending){const when=new Date(acc.expiresAt).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});const row=text('p','','home-expiry');row.append(text('span',days<0?'Your access ended on '+when+'. ':days===0?'Your access ends today. ':'Your access ends on '+when+' (in '+days+(days===1?' day':' days')+'). '));const a=link('/help?subject='+encodeURIComponent('Extend my access')+'#help-message','Ask for more time');a.className='btn pri';row.append(a);parts.push(row);}
  card.replaceChildren(...parts);card.hidden=false;
 });
 // Watching now: only for members who opted in to Compare (others get a 403 and the card stays hidden).
 quiet(async()=>{const rows=await read('/api/compare/now');if(!rows.length)return;$('#now-card-list').replaceChildren(...nowRows(rows));$('#now-card').hidden=false;});
 // Up next: the next episode of shows in progress.
 quiet(async()=>{const rows=await read('/api/home/up-next'),box=$('#upnext-line');if(!rows.length)return;
  $('#upnext-shelf').replaceChildren(...rows.map((r,i)=>tile(r,i,server,true)));badges($('#upnext-shelf'));box.hidden=false;});
 // Popular right now, with one-tap Request.
 quiet(async()=>{const d=await read('/api/discover/trending?limit=14'),box=$('#popular-line');
  const mix=[];for(let i=0;i<Math.max(d.films.length,d.tv.length);i++){if(d.films[i])mix.push(d.films[i]);if(d.tv[i])mix.push(d.tv[i]);}
  const rows=mix.slice(0,12);if(!rows.length)return;
  $('#popular-shelf').replaceChildren(...rows.map(r=>{const c=text('div','','popular-card');
   const art=text('span','','poster discover-poster');if(r.posterUrl){const img=document.createElement('img');img.src=r.posterUrl;img.alt='';img.loading='lazy';img.width=130;img.height=195;img.addEventListener('error',()=>img.remove(),{once:true});art.append(img);}else art.append(text('span',r.title));
   const ch=chips(r);if(ch)art.append(ch);
   const btn=text('button',r.status==='available'?'In library':r.status==='none'||r.status==='partial'?'Request':'Requested','btn'+(r.status==='none'?' pri':''));btn.type='button';
   if(r.status==='available'||r.status==='requested')btn.disabled=true;
   else btn.onclick=()=>act(async()=>{btn.disabled=true;try{await ready;await api('/api/discover/request',{mediaType:r.mediaType,mediaId:Number(r.id),...(r.mediaType==='tv'?{seasons:'all'}:{})});btn.textContent='Requested';btn.classList.remove('pri');say('Requested '+r.title+'. We will email you when it is ready.');}catch(e){btn.disabled=false;say(e.message||'Could not send that request.');}});
   c.append(art,text('span',r.title,'popular-title'),text('small',(r.mediaType==='tv'?'TV show':'Film')+(r.year?' · '+r.year:''),'muted'),btn);return c;}));box.hidden=false;});
 // This week at a glance.
 quiet(async()=>{const w=await read('/api/history/summary?range=week'),body=$('#week-body');
  if(!w.totalHours){body.replaceChildren(text('p','Nothing watched this week yet.','muted'),link('/discover','Find something to watch'));return;}
  const diff=Math.round((w.totalHours-w.previousHours)*10)/10,big=text('p','','home-big');big.append(text('b',w.totalHours+' h'),document.createTextNode(' watched'));
  const sub=text('p',(diff>0?'Up '+diff+' h on last week':diff<0?'Down '+Math.abs(diff)+' h on last week':'Same as last week')+' · '+w.titles+(w.titles===1?' title':' titles'),'muted');
  const parts=[big,sub];if(w.mostWatched[0])parts.push(text('p','Most watched: '+w.mostWatched[0].title,'muted'));parts.push(link('/history','See my history'));body.replaceChildren(...parts);});
 // Quick Connect without leaving Home.
 submit('#home-quickconnect',async()=>{const out=$('#home-qc-result');out.textContent='';try{await ready;await api('/api/onboarding/quickconnect',{code:$('#home-qc-code').value.trim()});out.textContent='Done! Your TV is signed in.';$('#home-qc-code').value='';}catch(e){out.textContent=e.message||'That code did not work. Check it and try again.';}});
}
if(page==='home'){home();homeExtras();}
const REQ_LABEL=r=>r.available?'In library':r.status==='declined'?'Declined':r.status==='approved'?'Approved':'Pending';
async function requests(){
 const ul=$('#requests');let rows;
 try { rows=await read('/api/discover/requests'); }
 finally { ul.setAttribute('aria-busy','false');$('#requests-loading').hidden=true; }
 let shown=5;
 function draw(){
  ul.replaceChildren(...rows.slice(0,shown).map(r=>{
   const label=REQ_LABEL(r),kind=r.mediaType==='tv'?'TV show':'Film',title=r.title||(kind+' '+r.tmdbId);
   const tile=text('li','','catcard request-tile'),art=text('div','','poster discover-poster');
   art.append(text('span',title));
   if(r.posterUrl){
    const img=document.createElement('img');img.src=r.posterUrl;img.alt='';img.loading='lazy';art.classList.add('has-img');
    img.addEventListener('error',()=>{img.remove();art.classList.remove('has-img');},{once:true});art.append(img);
   }
   const c=chips(r);if(c)art.append(c);
   const chip=text('span',label,'discover-badge');chip.dataset.state=r.available?'available':r.status==='declined'?'declined':r.status==='approved'?'approved':'pending';art.append(chip);
   const requested=text('time','','faint request-date'),at=r.createdAt?new Date(r.createdAt):null;
   if(at&&!Number.isNaN(at.getTime())){requested.dateTime=at.toISOString();requested.textContent='Requested '+at.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}
   else requested.textContent='Requested date unknown';
   tile.append(art,text('span',title,'discover-card-title'),text('p',kind+(r.year?' · '+r.year:''),'faint'),requested);return tile;
  }));
  if(!rows.length){const empty=li(text('span','No requests yet. Find something you would like to watch.','muted'));empty.className='request-grid-wide';ul.append(empty);}
  if(rows.length>shown){const more=text('button','Show more','btn');more.id='requests-more';more.type='button';more.onclick=()=>{const firstNew=shown;shown+=5;draw();const target=ul.children[firstNew];if(target){target.tabIndex=-1;target.focus();}};const footer=li(more);footer.className='request-grid-wide';ul.append(footer);}
 }
 draw();
}
if(page==='discover') {
 let tab='all', data=null, query='', asked='', timer, version=0, selected=null, returnFocus=null;
 const catalogue=$('#catalogue'), search=$('#search'), clear=$('#discover-clear'), dialog=$('#discover-dialog');
 const pending=new Set(), errors=new Map(), requested=new Set();
 const keyOf=r=>r.mediaType+':'+r.id;
 const labelOf=r=>r.status==='available'?'In library':r.status==='requested'?'Requested':r.status==='partial'?'Partly available':'Not requested';
 const metaOf=r=>(r.mediaType==='tv'?'TV show':'Film')+(r.year?' · '+r.year:'');
 function art(r) {
  const wrap=text('span','','poster discover-poster');
  if(r.posterUrl){const img=document.createElement('img');img.src=r.posterUrl;img.alt='';img.loading='lazy';wrap.append(img);}
  else wrap.append(text('span',r.title));
  const c=chips(r);if(c)wrap.append(c);
  return wrap;
 }
 function badge(r) { const n=text('span',labelOf(r),'discover-badge');n.dataset.state=r.status;return n; }
 function action(r,inDialog=false) {
  const key=keyOf(r), wrap=text('div','','discover-request'), button=text('button','','btn');
  wrap.dataset.key=key;button.type='button';button.onclick=()=>request(r);
  const error=text('p','','err');error.id='request-error-'+key.replace(':','-')+(inDialog?'-dialog':'');error.setAttribute('role','alert');
  button.setAttribute('aria-describedby',error.id);wrap.append(button,error);updateAction(wrap,r);return wrap;
 }
 function updateAction(wrap,r) {
  const key=keyOf(r), button=wrap.querySelector('button'), error=wrap.querySelector('.err');
  button.hidden=!['none','partial'].includes(r.status);
  button.disabled=pending.has(key);
  button.textContent=pending.has(key)?'Requesting…':r.mediaType==='tv'?'Request all seasons':'Request';
  error.textContent=errors.get(key)||'';
 }
 function syncActions(r) {
  document.querySelectorAll('.discover-request').forEach(w=>{if(w.dataset.key===keyOf(r))updateAction(w,r);});
 }
 async function request(r) {
  const key=keyOf(r);if(pending.has(key)||!['none','partial'].includes(r.status))return;
  pending.add(key);errors.delete(key);syncActions(r);
  try {
   await ready;await api('/api/discover/request',{mediaType:r.mediaType,mediaId:Number(r.id),...(r.mediaType==='tv'?{seasons:'all'}:{})});
   requested.add(key);r.status='requested';
   if(data)for(const item of [...data.films,...data.tv])if(keyOf(item)===key)item.status='requested';
   if(selected&&keyOf(selected)===key)selected.status='requested';
   render();
   if(dialog.open&&selected&&keyOf(selected)===key){const focusedAction=$('#discover-action').contains(document.activeElement);$('#discover-state').replaceChildren(badge(selected));syncActions(selected);if(focusedAction)$('#discover-close').focus();}
   say('Request sent. Seerr will email you when it is ready.');
   // A request-list refresh failure must not turn a successful request into a retry.
   region('#requests',requests);
  } catch(e) { errors.set(key,'Could not send your request. '+(e.message||'Please try again.')); }
  finally { pending.delete(key);syncActions(r); }
 }
 function openDetails(r,trigger) {
  selected=r;returnFocus=trigger;
  $('#discover-title').textContent=r.title;$('#discover-meta').textContent=metaOf(r);
  $('#discover-overview').textContent=r.overview||'No overview available yet.';
  $('#discover-art').replaceChildren(art(r));$('#discover-state').replaceChildren(badge(r));
  dialog.showModal();$('#discover-action').replaceChildren(action(r,true));$('#discover-close').focus();
 }
 $('#discover-close').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{
  const key=selected&&keyOf(selected);
  const replacement=[...catalogue.querySelectorAll('.discover-open')].find(b=>b.dataset.key===key);
  (returnFocus?.isConnected?returnFocus:replacement||search).focus();selected=null;returnFocus=null;
 });
 function card(r) {
  const key=keyOf(r), wrap=text('article','','catcard');
  const open=text('button','','discover-open');open.type='button';open.dataset.key=key;open.setAttribute('aria-haspopup','dialog');open.setAttribute('aria-label','Details for '+r.title);
  const poster=art(r);if(r.status!=='none')poster.append(badge(r));
  open.append(poster,text('span',r.title,'discover-card-title'));open.onclick=()=>openDetails(r,open);
  wrap.append(open,text('p',metaOf(r),'faint'),action(r));return wrap;
 }
 function render() {
  if(!data)return;
  const focused=document.activeElement, focusKey=focused?.closest('.catcard')?.querySelector('.discover-open')?.dataset.key;
  const sections=[];let count=0;
  for(const [key,label,items] of [['film','Films',data.films],['tv','TV shows',data.tv]]) {
   if(tab!=='all'&&tab!==key)continue;
   count+=items.length;
   const section=text('section','','discover-section'), head=text('div','','cathead');
   head.append(text('h2',label),text('small',String(items.length),'faint num'));section.append(head);
   if(items.length){const grid=text('div','','cat discover-grid');grid.append(...items.map(card));section.append(grid);}
   else section.append(text('p',query?'No '+label.toLowerCase()+' match “'+query+'”. Try a different spelling, or check the other tab.':'No '+label.toLowerCase()+' to show right now. Try a search, or check the other tab.','muted'));
   sections.push(section);
  }
  catalogue.replaceChildren(...sections);catalogue.setAttribute('aria-busy','false');
  $('#discover-results').textContent=query?count+' '+(count===1?'result':'results')+' for “'+query+'”':'Trending now';
  if(focusKey&&!dialog.open)[...catalogue.querySelectorAll('.discover-open')].find(b=>b.dataset.key===focusKey)?.focus();
 }
 function loading() {
  data=null;catalogue.setAttribute('aria-busy','true');$('#discover-results').textContent='Loading titles…';
  const grid=text('div','','cat discover-grid');grid.setAttribute('aria-hidden','true');
  for(let i=0;i<8;i++){const card=text('div','','discover-skeleton');card.append(text('div','','poster'),text('div','','skeleton-line'),text('div','','skeleton-line short'));grid.append(card);}
  catalogue.replaceChildren(grid);
 }
 async function show(q,current) {
  try {
   const d=await read(q?'/api/discover/search?q='+encodeURIComponent(q):'/api/discover/trending');if(current!==version)return;
   for(const r of [...d.films,...d.tv])if(requested.has(keyOf(r))&&r.status!=='available')r.status='requested';
   data=d;query=q;render();
  } catch(e) {
   if(current!==version)return;
   catalogue.setAttribute('aria-busy','false');
   const error=text('p','Titles are unavailable right now. '+(e.message||'Please try again.'),'err');error.setAttribute('role','alert');
   const retry=text('button','Try again','btn');retry.type='button';retry.onclick=()=>{search.focus();loading();show(q,++version);};
   catalogue.replaceChildren(error,retry);$('#discover-results').textContent='Could not load titles.';
  }
 }
 function searchChanged(now) {
  clearTimeout(timer);const current=++version,q=search.value.trim();asked=q.length>=2?q:'';clear.hidden=!search.value;
  loading();timer=setTimeout(()=>show(q.length>=2?q:'',current),now?0:q.length>=2?300:200);
 }
 function clearSearch(){search.value='';search.focus();searchChanged();}
 clear.onclick=clearSearch;
 // Several events can mean "the text changed" (typing, the keyboard's Search key, autofill, restoring the page): all of them search, and the latest wins.
 for(const type of ['input','search','change','compositionend'])search.addEventListener(type,()=>{if((search.value.trim().length>=2?search.value.trim():'')!==asked)searchChanged();});
 search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchChanged(true);}});
 window.addEventListener('pageshow',()=>{if((search.value.trim().length>=2?search.value.trim():'')!==asked)searchChanged();});
 search.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();clearSearch();}});
 document.addEventListener('keydown',e=>{
  if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!dialog.open&&!e.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')){e.preventDefault();search.focus();}
 });
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{
  tab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(x=>{x.setAttribute('aria-pressed',String(x===b));x.classList.toggle('pri',x===b);});render();
 });
 region('#requests',requests);
 if(search.value.trim().length>=2)searchChanged(true);else show('',++version); // the browser can restore text into the box before the script runs
}
if(page==='wrapped') {
 const stage=$('#wrapped'),sel=$('#wrapped-year'),thisYear=new Date().getFullYear();
 const motionOk=()=>matchMedia('(prefers-reduced-motion: no-preference)').matches&&document.documentElement.dataset.motion!=='reduce';
 const MONTH=m=>new Date(m+'-01T12:00:00').toLocaleDateString('en-GB',{month:'long'});
 const DAYTXT=d=>new Date(d+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
 const one=(n)=>Number(n).toLocaleString('en-GB',{minimumFractionDigits:1,maximumFractionDigits:1});
 let timer=0,idx=0,slides=[],bars=[],paused=false,userPaused=false,wrapData=null,pauseBtn=null;
 const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n;};
 // Subtle synthesized sounds (no audio files): a soft whoosh between slides and a chime on big moments. Off by default; the choice is kept in this browser.
 const sfx=(()=>{let ctx=null,on=false;try{on=localStorage.getItem('wrapped-sound')==='1';}catch{}
  const ensure=()=>{if(!ctx){const A=window.AudioContext||window.webkitAudioContext;if(!A)return null;try{ctx=new A();}catch{return null;}}if(ctx.state==='suspended')ctx.resume().catch(()=>{});return ctx;};
  const env=(g,t,peak,dur)=>{g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+dur*0.25);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);};
  function whoosh(){const c=ensure();if(!c||!on)return;const t=c.currentTime,len=Math.floor(c.sampleRate*0.4),buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
   const src=c.createBufferSource();src.buffer=buf;const f=c.createBiquadFilter();f.type='bandpass';f.Q.value=0.8;f.frequency.setValueAtTime(300,t);f.frequency.exponentialRampToValueAtTime(2200,t+0.35);const g=c.createGain();env(g,t,0.05,0.38);src.connect(f).connect(g).connect(c.destination);src.start(t);src.stop(t+0.4);}
  function chime(){const c=ensure();if(!c||!on)return;const t=c.currentTime;[1046.5,1318.5,1568].forEach((hz,i)=>{[1,2.01].forEach((m,k)=>{const o=c.createOscillator();o.type='sine';o.frequency.value=hz*m;const g=c.createGain();env(g,t+i*0.09,k?0.006:0.03,1.1);o.connect(g).connect(c.destination);o.start(t+i*0.09);o.stop(t+i*0.09+1.15);});});}
  return {get on(){return on;},set(v){on=v;try{localStorage.setItem('wrapped-sound',v?'1':'0');}catch{}if(v)ensure();},whoosh,chime,unlock:()=>{if(on)ensure();}};})();
 const rise=(n,d)=>{n.classList.add('w-in');n.style.setProperty('--d',d||0);return n;};
 function slide(theme,...kids){const s2=el('section','w-slide w-'+theme);s2.hidden=true;let d=0;kids.forEach(k=>{if(k)s2.append(rise(k,d++));});return s2;}
 function poster(url){if(!url)return null;const i=document.createElement('img');i.className='w-poster';i.src=url;i.alt='';i.loading='lazy';i.onerror=()=>i.remove();return i;}
 function list(items,fmt){const ol=el('ol','w-list');items.forEach((it,i)=>{const row=el('li','');row.append(el('span','w-rank',String(i+1)),el('span','w-name',it.title||it.name),el('span','w-val',fmt(it)));ol.append(row);});return ol;}
 function monthBars(w){const wrap=el('div','w-months');const max=Math.max(1,...w.months.map(m=>m.hours));w.months.forEach((m,i)=>{const col=el('div','w-month');const bar=el('i','');bar.style.setProperty('--h',Math.max(m.hours>0?4:0,m.hours/max*100)+'%');bar.style.setProperty('--i',i);col.append(bar,el('span','',new Date(m.month+'-01T12:00:00').toLocaleDateString('en-GB',{month:'narrow'})));if(w.busiestMonth&&m.month===w.busiestMonth.month)col.classList.add('is-top');wrap.append(col);});wrap.setAttribute('role','img');wrap.setAttribute('aria-label','Hours watched each month. Busiest: '+(w.busiestMonth?MONTH(w.busiestMonth.month):'none'));return wrap;}
 function summaryText(w){const L=['My '+w.year+' on Jellyfin'+(w.partial?' (so far)':''),one(w.totalHours)+' hours · '+w.titles+' titles'];if(w.topShows[0])L.push('Top show: '+w.topShows[0].title);if(w.topFilms[0])L.push('Top film: '+w.topFilms[0].title);if(w.topGenres[0])L.push('Top genre: '+w.topGenres[0].name);if(w.persona)L.push('I am a '+w.persona.label.toLowerCase());if(w.facts&&w.facts[0])L.push(w.facts[0].text);L.push('#JellypassWrapped');return L.join('\n');}
 const PERSONA_ICON={night:'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',early:'M12 4v2M12 18v2M4 12H2M22 12h-2M6 6L4.6 4.6M19.4 19.4L18 18M6 18l-1.4 1.4M19.4 4.6L18 6M12 8a4 4 0 100 8 4 4 0 000-8z',day:'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1M12 8a4 4 0 100 8 4 4 0 000-8z',prime:'M4 6h16v10H4zM9 20h6M12 16v4M10 9l4 2-4 2z'};
 function personaArt(key){const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','w-icon');svg.setAttribute('aria-hidden','true');const p2=document.createElementNS(ns,'path');p2.setAttribute('d',PERSONA_ICON[key]||PERSONA_ICON.prime);svg.append(p2);return svg;}
 function collage(urls){const wrap=el('div','w-collage');wrap.setAttribute('aria-hidden','true');const cols=3;for(let c=0;c<cols;c++){const col=el('div','w-col');col.style.setProperty('--c',c);for(let r=0;r<4;r++){const u=urls[(c*4+r)%Math.max(1,urls.length)];if(!u)continue;const i=document.createElement('img');i.src=u;i.alt='';i.loading='lazy';i.onerror=()=>i.remove();col.append(i);}wrap.append(col);}return urls.length?wrap:null;}
 function confetti(n){const box=el('div','w-confetti');box.setAttribute('aria-hidden','true');const colors=['#fde68a','#fca5a5','#a5f3fc','#c4b5fd','#fff'];for(let i=0;i<(n||26);i++){const c=el('i','');c.style.cssText='--x:'+Math.round(Math.random()*100)+'%;--d:'+(Math.random()*3).toFixed(2)+'s;--t:'+(3+Math.random()*3).toFixed(2)+'s;--r:'+Math.round(Math.random()*360)+'deg;background:'+colors[i%colors.length];box.append(c);}return box;}
 function tilt(img){if(!img)return img;const wrap=el('div','w-tilt');wrap.append(img);wrap.append(el('span','w-shine'));wrap.addEventListener('pointermove',e=>{if(!motionOk())return;const r=wrap.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;wrap.style.setProperty('--rx',(-y*16).toFixed(1)+'deg');wrap.style.setProperty('--ry',(x*16).toFixed(1)+'deg');});wrap.addEventListener('pointerleave',()=>{wrap.style.setProperty('--rx','0deg');wrap.style.setProperty('--ry','0deg');});return wrap;}
 function withBackdrop(url,s2){if(url){const i=document.createElement('img');i.className='w-backdrop';i.src=url;i.alt='';i.setAttribute('aria-hidden','true');i.onerror=()=>i.remove();s2.prepend(i);}return s2;}
 function genreBars(items){const max=Math.max(1,...items.map(i=>i.hours)),box=el('div','w-gbars');items.forEach((g,i)=>{const row=el('div','w-gbar');const bar=el('i','');bar.style.setProperty('--w',Math.max(6,g.hours/max*100)+'%');bar.style.setProperty('--i',i);row.append(el('span','w-gname',g.name),bar,el('span','w-val',one(g.hours)+' h'));box.append(row);});return box;}
 function factCards(facts){const ul=el('ul','w-factcards');facts.forEach((f,i)=>{const li2=el('li','');li2.style.setProperty('--i',i);li2.append(el('b','',f.title),el('span','',f.text));ul.append(li2);});return ul;}

 // Share cards are drawn on a canvas, 1080x1920 (story size). Posters are fetched with CORS from Jellyfin; any that cannot load are simply left out,
 // so the image can always be saved or shared.
 const loadImg=url=>new Promise(res=>{if(!url)return res(null);const i=new Image();i.crossOrigin='anonymous';const t=setTimeout(()=>res(null),4000);i.onload=()=>{clearTimeout(t);res(i);};i.onerror=()=>{clearTimeout(t);res(null);};i.src=url;});
 const rr=(g,x,y,w,h,r)=>{g.beginPath();if(g.roundRect)g.roundRect(x,y,w,h,r);else g.rect(x,y,w,h);};
 function drawPoster(g,img,x,y,w,h,r){g.save();rr(g,x,y,w,h,r);g.clip();if(img){const k=Math.max(w/img.width,h/img.height),dw=img.width*k,dh=img.height*k;g.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);}else{g.fillStyle='rgba(255,255,255,.14)';g.fillRect(x,y,w,h);}g.restore();g.save();g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=3;rr(g,x,y,w,h,r);g.stroke();g.restore();}
 function cardBase(w,grad,kicker){
  const W=1080,H=1920,cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');
  const gr=g.createLinearGradient(0,0,W,H);grad.forEach((c,i)=>gr.addColorStop(i/(grad.length-1),c));g.fillStyle=gr;g.fillRect(0,0,W,H);
  g.globalAlpha=.14;g.fillStyle='#fff';for(let i=0;i<46;i++){g.beginPath();g.arc((i*389)%W,(i*617)%H,6+(i%5)*5,0,7);g.fill();}g.globalAlpha=1;
  g.fillStyle='#fff';g.textAlign='left';const font=(wt,px)=>{g.font=wt+' '+px+'px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif';};
  font(700,44);g.globalAlpha=.85;g.fillText((w.name||'My')+(w.name?'’s':'')+' '+w.year+(w.partial?' so far':''),90,170);g.globalAlpha=1;
  font(800,150);g.fillText(kicker,90,320);
  font(700,40);g.globalAlpha=.8;g.fillText('Jellypass',90,H-110);g.globalAlpha=1;
  const fit=(t,max)=>{font(g.__wt||800,g.__px||52);let o=t;while(g.measureText(o).width>max&&o.length>4)o=o.slice(0,-2);return o===t?t:o+'…';};
  return {cv,g,W,H,font,fit};
 }
 async function drawOverview(w){
  const {cv,g,W,H,font}=cardBase(w,['#0f766e','#5b21b6','#be185d'],'Wrapped');
  font(800,330);g.fillText(one(w.totalHours),90,720);font(700,64);g.fillText('hours watched',96,810);
  font(600,46);g.globalAlpha=.92;g.fillText(w.titles+' titles · '+w.films+' films · '+w.episodes+' episodes',96,900);g.globalAlpha=1;
  const imgs=await Promise.all((w.posters||[]).slice(0,5).map(loadImg));
  const got=imgs.filter(Boolean),limit=got.length?H-610:H-350;
  let y=1000;const block=(label,items,max)=>{const list=items.slice(0,max);if(!list.length||y+60+list.length*70+34>limit)return;font(700,36);g.globalAlpha=.8;g.fillText(label.toUpperCase(),96,y);g.globalAlpha=1;y+=58;list.forEach((it,k)=>{font(800,52);let t=it;while(g.measureText(t).width>880&&t.length>4)t=t.slice(0,-2);if(t!==it)t+='…';g.fillText((k+1)+'  '+t,96,y);y+=70;});y+=34;};
  block('Top shows',w.topShows.map(x=>x.title),3);block('Top films',w.topFilms.map(x=>x.title),2);block('Top genres',w.topGenres.map(x=>x.name),3);
  if(got.length){const pw=170,ph=255,gap=18;got.slice(0,5).forEach((im,i)=>drawPoster(g,im,90+i*(pw+gap),H-570,pw,ph,14));}
  if(w.persona){g.fillStyle='rgba(255,255,255,.18)';rr(g,90,H-280,640,120,60);g.fill();g.fillStyle='#fff';font(800,58);g.fillText(w.persona.label,138,H-200);}
  return cv;
 }
 async function drawPicks(w){
  const {cv,g,W,H,font}=cardBase(w,['#047857','#1d4ed8','#7e22ce'],'Top picks');
  const items=[w.topShows[0]&&{kind:'Top show',it:w.topShows[0]},w.topFilms[0]&&{kind:'Top film',it:w.topFilms[0]}].filter(Boolean);
  const imgs=await Promise.all(items.map(x=>loadImg(x.it.posterUrl)));
  const pw=items.length>1?440:560,ph=Math.round(pw*1.5),gap=70,total=items.length*pw+(items.length-1)*gap,x0=Math.round((W-total)/2);
  items.forEach((x,i)=>{const px=x0+i*(pw+gap),py=470;drawPoster(g,imgs[i],px,py,pw,ph,24);g.textAlign='left';font(700,34);g.globalAlpha=.8;g.fillText(x.kind.toUpperCase(),px,py+ph+64);g.globalAlpha=1;
   font(800,48);let t=x.it.title;while(g.measureText(t).width>pw&&t.length>4)t=t.slice(0,-2);if(t!==x.it.title)t+='…';g.fillText(t,px,py+ph+124);font(600,40);g.globalAlpha=.9;g.fillText(one(x.it.hours)+' hours',px,py+ph+178);g.globalAlpha=1;});
  let y=1480;if(w.topGenres.length){font(700,36);g.globalAlpha=.8;g.fillText('TOP GENRES',90,y);g.globalAlpha=1;y+=64;font(800,54);g.fillText(w.topGenres.slice(0,3).map(x=>x.name).join('  ·  '),90,y);}
  return cv;
 }
 async function drawHabits(w){
  const {cv,g,W,H,font}=cardBase(w,['#b45309','#be185d','#4338ca'],'My habits');
  let y=470;
  if(w.busiestWeekday){font(700,38);g.globalAlpha=.85;g.fillText('MY DAY',90,y);g.globalAlpha=1;font(800,150);g.fillText(w.busiestWeekday+'s',90,y+160);y+=240;}
  // weekday bars
  const max=Math.max(1,...w.weekdays.map(d=>d.share)),bw=104,gap=26,base=y+230;
  w.weekdays.forEach((d,i)=>{const h=Math.max(8,Math.round(d.share/max*220)),x=90+i*(bw+gap);g.globalAlpha=d.name===w.busiestWeekday?1:.55;g.fillStyle='#fff';rr(g,x,base-h,bw,h,14);g.fill();g.globalAlpha=.9;font(700,34);g.textAlign='center';g.fillText(d.name[0],x+bw/2,base+52);g.textAlign='left';});
  g.globalAlpha=1;y=base+140;
  const dp=[['Morning',w.dayparts.morning],['Afternoon',w.dayparts.afternoon],['Evening',w.dayparts.evening],['Night',w.dayparts.night]];
  dp.forEach(([n,v],i)=>{const cy=y+i*80;font(700,38);g.fillText(n,90,cy);g.globalAlpha=.3;g.fillStyle='#fff';rr(g,330,cy-32,560,36,18);g.fill();g.globalAlpha=1;rr(g,330,cy-32,Math.max(10,560*v/100),36,18);g.fill();font(700,38);g.textAlign='right';g.fillText(v+'%',990,cy);g.textAlign='left';});
  y+=4*80+70;
  const bits=[];if(w.busiestMonth)bits.push(['Busiest month',MONTH(w.busiestMonth.month)]);if(w.longestStreak>=2)bits.push(['Longest streak',w.longestStreak+' days']);
  bits.forEach(([k,v],i)=>{font(700,34);g.globalAlpha=.8;g.fillText(k.toUpperCase(),90+i*470,y);g.globalAlpha=1;font(800,60);g.fillText(v,90+i*470,y+70);});
  if(w.persona){g.fillStyle='rgba(255,255,255,.18)';rr(g,90,H-300,640,120,60);g.fill();g.fillStyle='#fff';font(800,58);g.fillText(w.persona.label,138,H-220);}
  return cv;
 }
 const CARDS=[['Overview',drawOverview],['Top picks',drawPicks],['Habits',drawHabits]];
 const canvasBlob=cv=>new Promise(r=>cv.toBlob(r,'image/png'));
 function build(w){
  const S=[],hasPosters=(w.posters||[]).length>0;
  const intro=slide('a',el('p','w-kicker',w.partial?'Your year so far':'Your year in watching'),el('h2','w-title',w.year+' Wrapped'),el('p','w-lead','Hi '+(w.name||'there')+'. Ready to see what you watched?'));
  const col=collage(w.posters||[]);if(col)intro.prepend(col);intro.prepend(confetti(22));intro.classList.add(hasPosters?'has-collage':'x');intro.dataset.chime='1';S.push(intro);
  const hoursEl=el('div','w-big');hoursEl.dataset.count=String(w.totalHours);hoursEl.dataset.dec='1';hoursEl.textContent=one(w.totalHours);
  const rings=el('div','w-rings');rings.setAttribute('aria-hidden','true');rings.append(el('i',''),el('i',''),el('i',''));
  const hs=slide('b',el('p','w-kicker','You watched for'),hoursEl,el('p','w-lead','hours. That is '+one(w.totalDays)+' full days of watching across '+w.titles+' different titles.'));hs.prepend(rings);S.push(hs);
  const tvMore=w.tvHours>=w.filmsHours;
  const split=el('div','w-split');const tvBar=el('i','');tvBar.style.setProperty('--w',(w.totalHours?w.tvHours/w.totalHours*100:50)+'%');split.append(tvBar);split.setAttribute('role','img');split.setAttribute('aria-label',one(w.tvHours)+' hours of TV, '+one(w.filmsHours)+' hours of films');
  S.push(slide('c',el('p','w-kicker','Films or TV?'),el('h2','w-title',tvMore?'You are a binge-watcher at heart.':'You are a film buff.'),split,el('p','w-lead',one(w.tvHours)+' h of TV ('+w.episodes+' episodes) and '+one(w.filmsHours)+' h of films ('+w.films+').')));
  if(w.topShows.length)S.push(withBackdrop(w.topShows[0].posterUrl,slide('d',el('p','w-kicker','Your top show'),tilt(poster(w.topShows[0].posterUrl)),el('h2','w-title',w.topShows[0].title),el('p','w-lead',one(w.topShows[0].hours)+' hours with it.'),w.topShows.length>1?list(w.topShows,i=>one(i.hours)+' h'):null)));
  if(w.topFilms.length)S.push(withBackdrop(w.topFilms[0].posterUrl,slide('e',el('p','w-kicker','Your top film'),tilt(poster(w.topFilms[0].posterUrl)),el('h2','w-title',w.topFilms[0].title),w.topFilms.length>1?list(w.topFilms,i=>one(i.hours)+' h'):null)));
  if(w.topGenres.length>=2)S.push(slide('f',el('p','w-kicker','Your top genres'),el('h2','w-title',w.topGenres[0].name),genreBars(w.topGenres)));
  if(w.topDecade)S.push(slide('j',el('p','w-kicker','Your favourite era'),el('div','w-big w-sm',w.topDecade.decade),el('p','w-lead','Most of your films came from the '+w.topDecade.decade+': '+w.topDecade.films+' of them.')));
  if(w.busiestMonth)S.push(slide('b',el('p','w-kicker','Your busiest month'),el('h2','w-title',MONTH(w.busiestMonth.month)),el('p','w-lead',one(w.busiestMonth.hours)+' hours that month.'),monthBars(w)));
  const facts=[];
  if(w.busiestDay)facts.push(['Biggest day',DAYTXT(w.busiestDay.date)+': '+one(w.busiestDay.hours)+' h']);
  if(w.bingeDay)facts.push(['Longest binge',w.bingeDay.episodes+' episodes on '+DAYTXT(w.bingeDay.date)]);
  if(w.longestStreak>=2)facts.push(['Longest streak',w.longestStreak+' days in a row']);
  if(facts.length){const ul=el('ul','w-facts');facts.forEach(f=>{const li2=el('li','');li2.append(el('b','',f[0]),el('span','',f[1]));ul.append(li2);});S.push(slide('g',el('p','w-kicker','Records'),el('h2','w-title','Your big moments'),ul));}
  if(w.busiestWeekday){const bars2=el('div','w-months');const mx=Math.max(1,...w.weekdays.map(d=>d.share));w.weekdays.forEach((d,i)=>{const c=el('div','w-month'+(d.name===w.busiestWeekday?' is-top':''));const b=el('i','');b.style.setProperty('--h',Math.max(d.share>0?4:0,d.share/mx*100)+'%');b.style.setProperty('--i',i);c.append(b,el('span','',d.name.slice(0,3)));bars2.append(c);});bars2.setAttribute('role','img');bars2.setAttribute('aria-label','Share of your watching by day of the week. Busiest: '+w.busiestWeekday);
   const dp=el('ul','w-dayparts');[['Morning',w.dayparts.morning],['Afternoon',w.dayparts.afternoon],['Evening',w.dayparts.evening],['Night',w.dayparts.night]].forEach(([n,v])=>{const li2=el('li','');li2.append(el('b','',v+'%'),el('span','',n));dp.append(li2);});
   S.push(slide('i',el('p','w-kicker','When you watch'),el('h2','w-title',w.busiestWeekday+'s are your day'),bars2,dp));}
  if(w.rewatches&&w.rewatches.total>0)S.push(slide('k',el('p','w-kicker','Seconds, anyone?'),el('h2','w-title','You rewatched '+w.rewatches.total+(w.rewatches.total===1?' time':' times')),list(w.rewatches.top,i=>i.times+'×')));
  if(w.opening&&w.closing){const bk=el('div','w-bookends');[['First up',w.opening],['Latest',w.closing]].forEach(([k,it])=>{const c=el('div','w-bookend');const pimg=poster(it.posterUrl);if(pimg)c.append(pimg);const t=el('div','');t.append(el('b','',k),el('span','',it.title),el('small','',DAYTXT(it.date.slice(0,10))));c.append(t);bk.append(c);});S.push(slide('g',el('p','w-kicker','Bookends'),el('h2','w-title','How your year began, and where it is now'),bk));}
  const cool=w.facts||[];
  for(let i=0;i<cool.length;i+=4){const part=cool.slice(i,i+4);S.push(slide(i?'c':'f',el('p','w-kicker','Did you know?'),el('h2','w-title',i?'And a few more':'Your numbers, compared'),factCards(part)));}
  if(w.persona){const ps=slide('a',el('p','w-kicker','You are a'),personaArt(w.persona.key),el('h2','w-title w-xl',w.persona.label),el('p','w-lead',w.persona.text));ps.prepend(confetti(14));ps.dataset.chime='1';S.push(ps);}
  const stop=e=>e.stopPropagation();
  let cardIx=0,cardSeq=0;const previewBox=el('div','w-previewbox');const tabs=el('div','w-cardtabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Choose a share card');
  const cardBlob=async()=>canvasBlob(await CARDS[cardIx][1](w));
  const fileName=()=>'my-'+w.year+'-wrapped-'+CARDS[cardIx][0].toLowerCase().replace(/\s+/g,'-')+'.png';
  async function showCard(){const n=++cardSeq;previewBox.replaceChildren(el('p','w-lead','Making your card…'));const cv=await CARDS[cardIx][1](w);if(n!==cardSeq)return;cv.className='w-sharecard';cv.setAttribute('role','img');cv.setAttribute('aria-label','Your shareable '+CARDS[cardIx][0]+' card');previewBox.replaceChildren(cv);}
  const tabBtns=CARDS.map(([name],i)=>{const b=el('button','w-cardtab',name);b.type='button';b.setAttribute('aria-pressed',String(i===0));b.onclick=e=>{stop(e);cardIx=i;tabBtns.forEach((x,k)=>x.setAttribute('aria-pressed',String(k===i)));showCard();};return b;});tabs.append(...tabBtns);
  let shown=false;const ensure=()=>{if(!shown){shown=true;showCard();}};
  const share=el('button','btn pri','Share');share.type='button';
  share.onclick=e=>{stop(e);act(async()=>{const blob=await cardBlob(),file=blob?new File([blob],fileName(),{type:'image/png'}):null,text=summaryText(w);
   if(navigator.share){const data=file&&navigator.canShare&&navigator.canShare({files:[file]})?{files:[file],text:text,title:w.year+' Wrapped'}:{text:text,title:w.year+' Wrapped'};try{await navigator.share(data);return;}catch(err){if(err&&err.name==='AbortError')return;}}
   await navigator.clipboard.writeText(text);say('Sharing is not available here, so your summary was copied instead.');});};
  const dl=el('button','btn','Save image');dl.type='button';dl.onclick=e=>{stop(e);act(async()=>{const blob=await cardBlob();if(!blob)throw new Error('Could not make the image.');const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fileName();document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);say('Image saved.');});};
  const copy=el('button','btn','Copy text');copy.type='button';copy.onclick=e=>{stop(e);act(async()=>{await navigator.clipboard.writeText(summaryText(w));say('Summary copied.');});};
  const again=el('button','btn ghost','Watch again');again.type='button';again.onclick=e=>{stop(e);go(0);};
  const acts=el('div','w-actions');acts.append(share,dl,copy,again);
  const fin=slide('h',el('p','w-kicker','Share your '+w.year),tabs,previewBox,acts);fin.addEventListener('w-show',ensure);fin.prepend(confetti(18));fin.dataset.chime='1';S.push(fin);
  return S;
 }
 function counters(root){root.querySelectorAll('[data-count]').forEach(n=>{const to=Number(n.dataset.count),dec=Number(n.dataset.dec||0);const show=v=>v.toLocaleString('en-GB',{minimumFractionDigits:dec,maximumFractionDigits:dec});if(!motionOk()){n.textContent=show(to);return;}const t0=performance.now();const step=t=>{const k=Math.min(1,(t-t0)/1200),e=1-Math.pow(1-k,3);n.textContent=show(to*e);if(k<1&&n.isConnected)requestAnimationFrame(step);};requestAnimationFrame(step);});}
 function go(i){
  const was=idx;idx=Math.max(0,Math.min(slides.length-1,i));stage.dataset.dir=idx<was?'prev':'next';
  slides.forEach((s2,k)=>{const on=k===idx;s2.hidden=!on;s2.classList.toggle('is-active',on);});
  bars.forEach((b,k)=>{b.classList.toggle('is-done',k<idx);b.classList.toggle('is-current',k===idx);b.firstChild.style.animation='none';void b.firstChild.offsetWidth;b.firstChild.style.animation='';});
  counters(slides[idx]);slides[idx].dispatchEvent(new Event('w-show'));if(idx!==was){if(slides[idx].dataset.chime)sfx.chime();else sfx.whoosh();}
  $('#wrapped-count').textContent='Slide '+(idx+1)+' of '+slides.length;
  prev.disabled=idx===0;nxt.disabled=idx===slides.length-1;
  schedule();
 }
 function schedule(){clearTimeout(timer);if(!motionOk()||paused||userPaused||document.hidden||idx>=slides.length-1)return;timer=setTimeout(()=>go(idx+1),7000);}
 let prev,nxt;
 function mount(w){
  wrapData=w;stage.replaceChildren();
  if(!w.hasData){const e=el('div','w-empty');e.append(el('h2','','Nothing to wrap up for '+w.year+' yet'),el('p','muted','Watch something in Jellyfin and your year will build up here.'));stage.classList.add('is-empty');stage.append(e);return;}
  stage.classList.remove('is-empty');
  slides=build(w);
  const prog=el('div','w-progress');bars=slides.map((_,k)=>{const b=el('button','w-bar');b.type='button';b.setAttribute('aria-label','Go to slide '+(k+1));b.onclick=e=>{e.stopPropagation();go(k);};b.append(el('i',''));prog.append(b);return b;});
  prev=el('button','w-tap w-prev');prev.type='button';prev.setAttribute('aria-label','Previous slide');prev.onclick=()=>go(idx-1);
  nxt=el('button','w-tap w-next');nxt.type='button';nxt.setAttribute('aria-label','Next slide');nxt.onclick=()=>go(idx+1);
  const count=el('p','sr-only');count.id='wrapped-count';count.setAttribute('role','status');
  pauseBtn=el('button','w-pause');pauseBtn.type='button';
  const syncPause=()=>{pauseBtn.setAttribute('aria-pressed',String(userPaused));pauseBtn.setAttribute('aria-label',userPaused?'Play the story':'Pause the story');pauseBtn.textContent=userPaused?'▶':'❚❚';stage.classList.toggle('is-paused',userPaused);};
  pauseBtn.onclick=e=>{e.stopPropagation();userPaused=!userPaused;syncPause();if(userPaused)clearTimeout(timer);else go(idx);};
  userPaused=false;syncPause();
  const soundBtn=el('button','w-sound');soundBtn.type='button';soundBtn.textContent='♪';
  const syncSound=()=>{soundBtn.setAttribute('aria-pressed',String(sfx.on));soundBtn.setAttribute('aria-label',sfx.on?'Turn sound off':'Turn sound on');soundBtn.classList.toggle('is-off',!sfx.on);};
  soundBtn.onclick=e=>{e.stopPropagation();sfx.set(!sfx.on);syncSound();if(sfx.on)sfx.chime();};syncSound();
  stage.append(prog,...slides,prev,nxt,soundBtn,pauseBtn,count);
  paused=false;go(0);
 }
 async function load(year){stage.replaceChildren(el('p','wrapped-loading','Putting your year together…'));const w=await read('/api/wrapped'+(year?'?year='+year:''));
  const years=w.years.includes(w.year)?w.years:[w.year,...w.years];sel.replaceChildren(...years.map(y=>{const o=el('option','',String(y));o.value=String(y);o.selected=y===w.year;return o;}));mount(w);}
 // Tapping the left third goes back, anywhere else goes forward. Done on the stage itself so buttons inside a slide are never covered.
 stage.addEventListener('click',e=>{if(!slides.length||e.target.closest('button,a,select,input,canvas,label'))return;const r=stage.getBoundingClientRect();go((e.clientX-r.left)/r.width<0.34?idx-1:idx+1);});
 sel.onchange=()=>region('#wrapped',()=>load(sel.value));
 stage.addEventListener('pointerenter',()=>{paused=true;clearTimeout(timer);});stage.addEventListener('pointerleave',()=>{paused=false;schedule();});
 stage.addEventListener('focusin',()=>{paused=true;clearTimeout(timer);});stage.addEventListener('focusout',()=>{paused=false;schedule();});
 stage.addEventListener('keydown',e=>{if(!slides.length)return;if(e.key==='ArrowRight'){e.preventDefault();go(idx+1);}else if(e.key==='ArrowLeft'){e.preventDefault();go(idx-1);}else if(e.key==='Home'){e.preventDefault();go(0);}else if(e.key==='End'){e.preventDefault();go(slides.length-1);}else if(e.key===' '&&e.target===stage){e.preventDefault();pauseBtn&&pauseBtn.click();}});
 let sx=0,sy=0,swiped=false;
 stage.addEventListener('pointerdown',e=>{sfx.unlock();sx=e.clientX;sy=e.clientY;swiped=false;});
 stage.addEventListener('pointerup',e=>{if(!slides.length)return;const dx=e.clientX-sx,dy=e.clientY-sy;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5){swiped=true;go(dx<0?idx+1:idx-1);}});
 stage.addEventListener('click',e=>{if(swiped){e.stopImmediatePropagation();swiped=false;}},true);
 document.addEventListener('visibilitychange',schedule);
 region('#wrapped',()=>load(''));
}
// Watching now (part of the Compare opt-in): others show name and title only; your own stream adds detail but never an address.
function nowRows(rows){ const at=v=>{const t=new Date(v);if(!Number.isFinite(+t))return '';return (t.toDateString()===new Date().toDateString()?'Today ':t.toLocaleDateString('en-GB',{day:'numeric',month:'short'})+', ')+t.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});};
 const ownRow=r=>{ // the member's own stream: more detail, but never an address, ISP, city or device
  const row=li(avatar(r.id,r.name));row.className='now-row now-own';const t=text('div','','now-text now-body');
  const head=text('span','','');head.append(text('b','You'),document.createTextNode(' '+(r.paused?'are paused on ':'are watching ')),text('b',r.title+(r.subtitle?' · '+r.subtitle:'')));t.append(head);
  if(r.episodeName)t.append(text('span',r.episodeName,'muted now-line'));
  const facts=[r.year,r.rating,r.runtimeMinutes?r.runtimeMinutes+' min':'',...(r.genres||[])].filter(Boolean).join(' · ');if(facts)t.append(text('span',facts,'muted now-line'));
  if(r.progressPct!=null){const bar=text('span','','prog now-prog'),fill=document.createElement('i');fill.style.width=Math.max(0,Math.min(100,Number(r.progressPct)||0))+'%';bar.setAttribute('role','img');bar.setAttribute('aria-label',r.progressPct+' percent played');bar.append(fill);t.append(bar);}
  const times=[r.startedAt?'Started '+at(r.startedAt):'',r.endsAt?(r.paused?'Would end about ':'Ends about ')+at(r.endsAt):''].filter(Boolean).join(' · ');if(times)t.append(text('span',times,'muted now-line'));
  if(r.url){const open=Object.assign(document.createElement('a'),{href:r.url,textContent:'Open in Jellyfin',target:'_blank',rel:'noopener noreferrer'});open.className='btn pri now-open';t.append(open);}
  row.append(t);
  if(r.posterUrl){const img=document.createElement('img');img.src=r.posterUrl;img.alt='';img.className='stream-poster';img.loading='lazy';img.onerror=()=>img.remove();row.append(img);}
  return row;};
 return rows.map(r=>{if(r.you)return ownRow(r);const row=li(avatar('',r.name),(()=>{const t=text('span','','now-text');t.append(text('b',r.name),document.createTextNode(' '+(r.paused?'paused ':'is watching ')),text('b',r.title+(r.subtitle?' · '+r.subtitle:'')));return t;})());if(r.posterUrl){const img=document.createElement('img');img.src=r.posterUrl;img.alt='';img.className='stream-poster';img.loading='lazy';img.onerror=()=>img.remove();row.append(img);}row.className='now-row';return row;}); }
async function loadNow(){ try{ return await read('/api/compare/now'); }catch{ return null; } }
if(page==='compare'){ const list=$('#now-list'); const tick=async()=>{ const rows=await loadNow(); if(rows===null){list.replaceChildren(li(text('span','Could not check right now.','muted')));return;} list.replaceChildren(...(rows.length?nowRows(rows):[li(text('span','Nobody is watching right now.','muted'))])); }; tick(); setInterval(()=>{if(!document.hidden)tick();},30000); }
if(page==='compare') region('#compare-people',async()=>{
 const data=await read('/api/compare'),box=$('#compare-people'),out=$('#compare-result');
 if(!data.enabled){box.replaceChildren(text('p','Comparing is off for you.','muted'),link('/settings','Turn it on in Settings'));return;}
 if(!data.people.length){box.replaceChildren(text('p','Nobody else has comparing on right now.','muted'));return;}
 const chosen=new Set(),MAX=4;let seq=0,timer=0;
 const fmtH=h=>(h>=100?Math.round(h):h)+' h';
 // numeric stats get bars scaled to the biggest; the leader is highlighted
 const NUM=[['Total watch time','totalHours',fmtH],['Last 30 days','last30Hours',fmtH],['TV time','tvHours',fmtH],['Film time','filmHours',fmtH],['Films watched','films',String],['Shows watched','shows',String],['Episodes watched','episodes',String],['Rewatched titles','rewatches',String]];
 const TXT=[['Favourite genres',s=>s.topGenres.join(', ')||'—'],['Most watched',s=>s.topTitle?s.topTitle.title+' ('+fmtH(s.topTitle.hours)+')':'—'],['Busiest day',s=>s.busiestDay||'—'],['Usual time',s=>s.usualTime||'—']];
 const who=p=>p.you?'You':p.name;
 function render(r){
  const parts=[];
  const alike=text('section','','cmp-block');alike.append(text('h2','How alike you are'));
  const ml=text('div','','cmp-matches');
  r.matches.forEach(m=>{const row=text('div','','cmp-match');const bar=text('span','','cmp-bar'),fill=document.createElement('i');fill.style.width=Math.max(2,m.matchPct)+'%';bar.append(fill);const info=text('span','','cmp-match-info');info.append(text('b',m.name),text('span',m.shared+' '+(m.shared===1?'title':'titles')+' in common','muted'));row.append(avatar('',m.name),info,text('b',m.matchPct+'%','compare-pct cmp-pct'),bar);ml.append(row);});
  alike.append(ml);parts.push(alike);
  const stats=text('section','','cmp-block');stats.append(text('h2','The numbers'),text('p','Estimates from each person’s Jellyfin history: it keeps the last play and a play count, not every session.','muted cmp-note'));
  const grid=text('div','','cmp-stats');
  NUM.forEach(([label,key,fmt])=>{const vals=r.people.map(p=>Number(p.stats[key])||0),max=Math.max(...vals,0);const card=text('div','','cmp-stat');card.append(text('h3',label));
   r.people.forEach((p,i)=>{const lead=max>0&&vals[i]===max&&vals.filter(v=>v===max).length===1;const row=text('div','','cmp-row'+(lead?' lead':''));const bar=text('span','','cmp-bar'),fill=document.createElement('i');fill.style.width=(max?Math.max(2,vals[i]/max*100):0)+'%';bar.append(fill);row.append(text('span',who(p),'cmp-who'),text('b',fmt(vals[i]),'cmp-val'),bar);card.append(row);});grid.append(card);});
  TXT.forEach(([label,f])=>{const card=text('div','','cmp-stat');card.append(text('h3',label));r.people.forEach(p=>{const row=text('div','','cmp-row cmp-text');row.append(text('span',who(p),'cmp-who'),text('b',f(p.stats),'cmp-val'));card.append(row);});grid.append(card);});
  stats.append(grid);parts.push(stats);
  const sh=text('section','','cmp-block');sh.append(text('h2','Watched by '+(r.people.length>2?'all of you':'both of you')+' ('+r.shared.length+')'));
  if(!r.shared.length)sh.append(text('p','Nothing all of you have watched yet.','muted'));
  else{const list=text('ul','','compare-grid');
   r.shared.forEach(t=>{const item=text('li','','compare-item');
    if(t.posterUrl){const img=document.createElement('img');img.src=t.posterUrl;img.alt='';img.loading='lazy';img.width=84;img.height=126;img.addEventListener('error',()=>img.remove(),{once:true});item.append(img);}
    const lab=text('span','','compare-title');lab.append(text('b',t.title),text('small',(t.kind==='tv'?'TV show':'Film')+(t.subtitle?' · '+t.subtitle:''),'muted'));if(t.url){const open=Object.assign(document.createElement('a'),{href:t.url,textContent:'Open in Jellyfin',target:'_blank',rel:'noopener noreferrer'});open.className='btn compare-open';lab.append(open);}item.append(lab);list.append(item);});
   sh.append(list);}
  parts.push(sh);return parts;
 }
 async function go(){const n=++seq;
  if(!chosen.size){out.hidden=true;out.replaceChildren();return;}
  out.hidden=false;out.replaceChildren(text('p','Comparing…','muted'));
  try{const r=await read('/api/compare/group?ids='+[...chosen].map(encodeURIComponent).join(','));if(n===seq)out.replaceChildren(...render(r));}
  catch(e){if(n===seq)out.replaceChildren(text('p',e.message||'Could not compare right now.','err'));}
 }
 box.replaceChildren(...data.people.map(p=>{const b=text('button','','compare-person btn');b.type='button';b.setAttribute('aria-pressed','false');b.append(avatar('',p.name),text('span',p.name));
  b.onclick=()=>{if(chosen.has(p.id))chosen.delete(p.id);else if(chosen.size<MAX)chosen.add(p.id);else{$('#compare-hint').textContent='You can compare with up to '+MAX+' people at once.';return;}
   $('#compare-hint').textContent='';b.setAttribute('aria-pressed',String(chosen.has(p.id)));clearTimeout(timer);timer=setTimeout(go,200);};return b;}));
});
if(page==='preferences') {
 { const cmp=$('#pref-compare');
   read('/api/compare').then(d=>{cmp.checked=d.enabled;cmp.disabled=false;}).catch(()=>{});
   cmp.addEventListener('change',()=>{cmp.disabled=true;act(async()=>{try{await ready;await api('/api/compare/optin',{on:cmp.checked},'PUT');location.reload();}catch(e){cmp.checked=!cmp.checked;cmp.disabled=false;$('#pref-error').textContent=e.message;}});}); }
 const root=document.documentElement,radios=[...document.querySelectorAll('input[name=theme]')];
 const saved=()=>{try{const t=localStorage.getItem('theme');return t==='light'||t==='dark'||t==='oled'?t:'system';}catch{return 'system';}};
 const DESC={system:'Follows your device’s light or dark setting.',light:'Bright background, best in daylight.',dark:'Easier on the eyes in the evening.',oled:'Pure black. Saves battery on OLED screens and looks best in the dark.'};
 function apply(v){root.classList.add('theme-fade');clearTimeout(apply.t);apply.t=setTimeout(()=>root.classList.remove('theme-fade'),450);$('#theme-desc').textContent=DESC[v];try{if(v==='system')localStorage.removeItem('theme');else localStorage.setItem('theme',v);}catch{}if(v==='system')delete root.dataset.theme;else root.dataset.theme=v;radios.forEach(r=>{r.checked=r.value===v;});}
 $('#theme-desc').textContent=DESC[saved()];radios.forEach(r=>{r.checked=r.value===saved();r.addEventListener('change',()=>apply(r.value));});
 const motion=$('#pref-motion');
 motion.checked=root.dataset.motion==='reduce';
 motion.addEventListener('change',()=>{try{if(motion.checked)localStorage.setItem('motion','reduce');else localStorage.removeItem('motion');}catch{}if(motion.checked)root.dataset.motion='reduce';else delete root.dataset.motion;});
 const alerts=$('#pref-alerts'),reminders=$('#pref-reminders'),confirmBox=$('#pref-alerts-confirm'),perr=$('#pref-error');
 const fail=e=>{perr.textContent=e.status===403?'That password was not right.':e instanceof TypeError?'We could not connect. Check your connection and try again.':e.message;};
 let alertsOn=true;
 act(async()=>{try{const [acc,ob]=await Promise.all([read('/api/account'),read('/api/onboarding')]);alertsOn=acc.alertsOn;alerts.checked=alertsOn;alerts.disabled=false;for(const id of ['banner','weekly','ready']){const sw=$('#pref-'+id);sw.checked=acc[{banner:'alertsBanner',weekly:'weeklyOn',ready:'readyOn'}[id]];sw.disabled=false;}reminders.checked=ob.remindersOn;reminders.disabled=false;}catch(e){fail(e);}});
 alerts.addEventListener('change',()=>{perr.textContent='';if(!alerts.checked){alerts.checked=true;confirmBox.hidden=false;$('#pref-alerts-password').focus();return;}
  alerts.disabled=true;act(async()=>{try{await ready;await api('/api/account/alerts',{on:true},'PUT');alertsOn=true;$('#status').textContent='Sign-in alerts turned on.';}catch(e){alerts.checked=false;fail(e);}finally{alerts.disabled=false;}});});
 for(const id of ['banner','weekly','ready']){const sw=$('#pref-'+id);sw.addEventListener('change',()=>{perr.textContent='';sw.disabled=true;act(async()=>{try{await ready;await api('/api/account/notify',{key:id,on:sw.checked},'PUT');$('#status').textContent='Saved.';}catch(e){sw.checked=!sw.checked;fail(e);}finally{sw.disabled=false;}});});}
 // Push notices: this browser's own subscription. Hidden only when the server has push switched off; where the browser cannot do it, the switch stays off and says why.
 {
  const sw=$('#pref-push'),help=$('#pref-push-help'),keyBytes=k=>Uint8Array.from(atob(k.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
  (async()=>{try{const st=await read('/api/push/status');if(!st.available)return;$('#pref-push-row').hidden=false;
   if(!supported){help.textContent+=' This browser cannot show them'+(/iPhone|iPad/.test(navigator.userAgent)?': on iPhone or iPad, open the site from its Home Screen icon (Share, then Add to Home Screen).':'. Try Chrome, Edge, Firefox or Safari 16 or newer.');return;}
   const sub=await (await navigator.serviceWorker.register('/sw.js')).pushManager.getSubscription();sw.checked=!!sub&&Notification.permission==='granted';sw.disabled=false;$('#pref-push-test-row').hidden=!sw.checked;}catch(e){help.textContent+=' (Could not start: '+e.message+')';}})(); // not via act(): act skips calls made while the account load is still running
  sw.addEventListener('change',()=>{perr.textContent='';
   const asked=sw.checked?Notification.requestPermission():null; // must run straight from the click: Safari refuses it after any await
   sw.disabled=true;act(async()=>{try{
   if(sw.checked){if(await asked!=='granted')throw new Error('Notifications are blocked for this site. Allow them in your browser or system settings, then try again.');
    const reg=await navigator.serviceWorker.register('/sw.js'),sub=(await reg.pushManager.getSubscription())||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes((await read('/api/push/key')).key)});
    await api('/api/push/subscribe',sub.toJSON());$('#status').textContent='Push notices are on for this device.';}
   else{const sub=await (await navigator.serviceWorker.register('/sw.js')).pushManager.getSubscription();if(sub){await api('/api/push/unsubscribe',{endpoint:sub.endpoint});await sub.unsubscribe();}$('#status').textContent='Push notices are off for this device.';}
   $('#pref-push-test-row').hidden=!sw.checked;}catch(e){sw.checked=!sw.checked;fail(e);}finally{sw.disabled=false;}});});
  $('#pref-push-test').addEventListener('click',()=>{perr.textContent='';act(async()=>{try{await api('/api/push/test');$('#status').textContent='Test notice sent.';}catch(e){fail(e);}});});
 }
 $('#pref-alerts-cancel').addEventListener('click',()=>{confirmBox.hidden=true;$('#pref-alerts-password').value='';alerts.checked=true;});
 confirmBox.addEventListener('submit',e=>{e.preventDefault();perr.textContent='';act(async()=>{try{await ready;await api('/api/account/alerts',{on:false,password:$('#pref-alerts-password').value},'PUT');alertsOn=false;alerts.checked=false;confirmBox.hidden=true;$('#pref-alerts-password').value='';$('#status').textContent='Sign-in alerts turned off.';}catch(e){alerts.checked=true;fail(e);$('#pref-alerts-password').focus();}});});
 reminders.addEventListener('change',()=>{perr.textContent='';const want=reminders.checked;reminders.disabled=true;act(async()=>{try{await ready;await api('/api/me/reminders',{on:want},'PUT');$('#status').textContent='Reminder preference saved.';}catch(e){reminders.checked=!want;fail(e);}finally{reminders.disabled=false;}});});
 $('#prefs-reset').addEventListener('click',()=>{apply('system');motion.checked=false;motion.dispatchEvent(new Event('change'));$('#status').textContent='Display settings reset.';});
}
if(page==='account') {
 let account=null, signingOut=false, alertsSaving=false, overviewVersion=0;
 const dialog=$('#account-signout-dialog'), alertsDialog=$('#alerts-dialog');
 const britishDate=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'});
 const formatDate=value=>britishDate.format(new Date(value));
 function relativeTime(value) {
  const minutes=Math.max(0,Math.floor((Date.now()-Date.parse(value))/60000));
  if(minutes<1)return 'just now';
  const [n,unit]=minutes<60?[minutes,'minute']:minutes<1440?[Math.floor(minutes/60),'hour']:[Math.floor(minutes/1440),'day'];
  return n+' '+unit+(n===1?'':'s')+' ago';
 }
 function syncAccountControls() {
  $('#signout-others').disabled=signingOut||!account||account.otherSessions===0;
  $('#signout-devices').disabled=signingOut;
  $('#account-alerts').disabled=alertsSaving||!account;
  document.querySelectorAll('[data-session-signout]').forEach(b=>b.disabled=signingOut);
 }
 function emailStatus(verified) {
  $('#email-state').textContent=verified?'Verified':'Not verified';
  $('#account-email-nudge').hidden=verified;
  $('#account-email-dot').classList.toggle('verified',verified);
  $('#account-alerts-note').textContent=verified?'Alerts use your verified contact email.':'Sign-in alerts need a verified contact email.';
 }
 async function loadAccount() {
  const version=++overviewVersion;
  $('#account-overview').setAttribute('aria-busy','true');
  try {
   await ready;const d=await api('/api/account',undefined,'GET');if(version!==overviewVersion)return;
   account=d;
   $('#account-username').textContent=d.username;
   $('#account-role').hidden=!d.isAdmin;
   $('#account-libraries').replaceChildren(...(d.libraries==null?['Could not load right now']:d.libraries.length?d.libraries:['None yet']).map(n=>{const li=document.createElement('li');li.className='tag';li.textContent=n;return li;}));
   $('#account-level').textContent=d.accessLevel||(d.isAdmin?'Full access':'Not set');
   $('#account-since').textContent=d.memberSince?formatDate(d.memberSince):'Unknown';
   const expiry=$('#account-expiry'), remaining=d.expiresAt?Date.parse(d.expiresAt)-Date.now():null;
   const days=remaining===null?null:Math.ceil(remaining/86400000);
   expiry.textContent=remaining===null?'No end date':remaining<=0?'Ended '+formatDate(d.expiresAt):'Ends '+formatDate(d.expiresAt)+' · '+days+(days===1?' day left':' days left');
   $('#delete-account-row').hidden=!!d.isAdmin;
   expiry.classList.toggle('account-warning',!d.isAdmin&&remaining!==null&&days<=14);
   $('#account-password-changed').textContent=d.passwordChangedAt?' · last changed '+formatDate(d.passwordChangedAt):' · Never changed here';
   emailStatus(d.emailVerified);$('#account-alerts').checked=d.alertsOn;
   $('#account-last-signin').textContent=d.lastSignin?[d.lastSignin.device||'Unknown device',d.lastSignin.city,relativeTime(d.lastSignin.seenAt)].filter(Boolean).join(' · '):'No sign-ins recorded yet';
   $('#account-other-sessions').textContent=String(d.otherSessions);
   $('#signout-others').textContent='Sign out other browsers ('+d.otherSessions+')';
   $('#account-browser-note').textContent=d.otherSessions?'This browser stays signed in.':'No other browsers are signed in.';
   $('#account-browsers').replaceChildren(...d.sessions.map(session=>{
    const row=document.createElement('li'), detail=document.createElement('div'), label=document.createElement('b'), meta=document.createElement('p');
    row.className='row';detail.className='grow';label.textContent=session.label||'Unknown browser';meta.className='muted';
    meta.textContent=(session.city?session.city+' · ':'')+'Signed in '+relativeTime(session.createdAt);
    detail.append(label,meta);row.append(detail);
    if(session.current){const tag=document.createElement('span');tag.className='tag';tag.textContent='This browser';row.append(tag);}
    else {const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='Sign out';button.dataset.sessionSignout=session.id;button.setAttribute('aria-label','Sign out '+(session.label||'browser')+(session.city?' in '+session.city:''));button.onclick=()=>signOut('/api/account/sessions/'+encodeURIComponent(session.id),{},'DELETE');row.append(button);}
    return row;
   }));
   $('#account-details').hidden=false;$('#account-unavailable').hidden=true;
  } catch(e) {
   if(version!==overviewVersion)return;
   account=null;$('#account-details').hidden=true;$('#account-unavailable').hidden=false;
   $('#account-unavailable').textContent='Overview unavailable right now';
   $('#account-last-signin').textContent='Unavailable right now';$('#account-other-sessions').textContent='Unavailable right now';
   $('#account-password-changed').textContent=' · Date unavailable';$('#account-browser-note').textContent='Browser count unavailable right now.';
   $('#signout-others').textContent='Sign out other browsers';
   $('#account-alerts-note').textContent='Alert preference unavailable right now.';
   const message=document.createElement('li');message.className='muted';message.textContent='Browsers unavailable right now';$('#account-browsers').replaceChildren(message);
  } finally {
   if(version===overviewVersion){$('#account-loading').hidden=true;$('#account-overview').setAttribute('aria-busy','false');$('#account-browsers').setAttribute('aria-busy','false');syncAccountControls();}
  }
 }
 const actionError=e=>e instanceof TypeError?'We could not connect. Check your connection and try again.':e.message;
 async function signOut(path,body={},method='POST') {
  if(signingOut)return;
  signingOut=true;let changed=false;
  try {await act(async()=>{
   $('#account-signout-error').textContent='';$('#account-dialog-error').textContent='';
   try {await ready;await api(path,body,method);changed=true;dialog.close();say(method==='DELETE'?'Browser signed out.':path.endsWith('sign-out-devices')?'Your devices and other browsers have been signed out.':'Other browsers signed out.');}
   catch(e){$('#account-signout-error').textContent=actionError(e);$('#account-dialog-error').textContent=actionError(e);}
  });syncAccountControls();if(changed)await loadAccount();}
  finally {signingOut=false;syncAccountControls();}
 }
 $('#signout-others').onclick=()=>{if(account&&account.otherSessions>0)signOut('/api/account/sign-out-others',{});};
 $('#signout-devices').onclick=()=>dialog.showModal();
 $('#account-signout-cancel').onclick=()=>dialog.close();
 $('#account-signout-confirm').onclick=()=>signOut('/api/account/sign-out-devices',{});
 dialog.addEventListener('cancel',event=>{if(signingOut)event.preventDefault();});
 dialog.addEventListener('close',()=>$('#signout-devices').focus());
 // Sign in with an emailed link: on needs the password, off is immediate. State is loaded on its own (not via act, which skips calls made while the account loads).
 { const sw=$('#account-magic'),box=$('#account-magic-confirm'),err=$('#account-magic-error'),note=$('#account-magic-note');
  (async()=>{try{const acc=await read('/api/account');sw.checked=!!acc.magicOn;if(acc.isAdmin)note.textContent='Not available for admin accounts.';else if(!acc.emailVerified)note.textContent='Verify a contact email first, then you can turn this on.';else{note.textContent=acc.magicOn?'On. You can ask for a link from the sign-in page.':'Off.';sw.disabled=false;}}catch(e){note.textContent=actionError(e);}})();
  sw.addEventListener('change',()=>{err.textContent='';if(sw.checked){sw.checked=false;box.hidden=false;$('#account-magic-password').focus();return;}
   sw.disabled=true;act(async()=>{try{await api('/api/account/magic',{on:false},'PUT');note.textContent='Off.';say('Sign-in links are off.');}catch(e){sw.checked=true;err.textContent=actionError(e);}finally{sw.disabled=false;}});});
 
 // Two-step sign-in: authenticator app and passkeys.
 { const note=$('#twofa-note'),err=$('#twofa-error');
  const u8=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const b64u=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  let made=null;
  const showCodes=codes=>{if(!codes)return;$('#twofa-codes-list').textContent=codes.join('\n');$('#twofa-codes').hidden=false;};
  const qr=uri=>{const draw=()=>{const q=window.qrcode(0,'M');q.addData(uri);q.make();$('#twofa-qr').src=q.createDataURL(5,8);$('#twofa-qr').hidden=false;};
   if(window.qrcode)return draw();const s=document.createElement('script');s.src='/assets/vendor/qrcode.js';s.onload=draw;document.head.append(s);};
  async function load(){
   let st;try{st=await read('/api/account/2fa');}catch(e){note.textContent=actionError(e);return;}
   const on=st.totp||st.passkeys.length>0,n=st.recoveryLeft;
   note.textContent=on?'On. After your password you will be asked for '+(st.totp&&st.passkeys.length?'a code or a passkey':st.totp?'a code from your app':'a passkey')+'. '+n+' recovery code'+(n===1?'':'s')+' left.':'Off. Add a second step so a leaked password is not enough to sign in.';
   $('#twofa-totp-start').hidden=st.totp;$('#twofa-totp-off').hidden=!st.totp;$('#twofa-recovery').hidden=!on;
   $('#twofa-passkeys').replaceChildren(...st.passkeys.map(p=>{const li=document.createElement('li'),b=document.createElement('button');li.className='row';li.append(p.name+' · added '+date(p.createdAt)+' ');
    b.className='link';b.type='button';b.textContent='Remove';b.setAttribute('aria-label','Remove passkey '+p.name);b.onclick=()=>confirmed('Remove the passkey '+p.name+'?',pw=>api('/api/account/2fa/passkey/'+encodeURIComponent(p.id),{password:pw},'DELETE').then(()=>say('Passkey removed.')));li.append(b);return li;}));
  }
  // Taking a method away, or replacing recovery codes, asks for the password in a popup first.
  const dlg=$('#twofa-confirm');let after=null;
  function confirmed(title,fn){after=fn;$('#twofa-confirm-title').textContent=title;$('#twofa-confirm-password').value='';dlg.showModal();$('#twofa-confirm-password').focus();}
  $('#twofa-confirm-cancel').onclick=()=>dlg.close();
  $('#twofa-confirm-form').addEventListener('submit',e=>{e.preventDefault();const pw=$('#twofa-confirm-password').value,fn=after;$('#twofa-confirm-password').value='';dlg.close();change(()=>fn(pw));});
  const codesText=()=>'Jellypass recovery codes\nEach one works once. Keep them somewhere safe.\n\n'+$('#twofa-codes-list').textContent+'\n';
  $('#twofa-codes-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('#twofa-codes-list').textContent);say('Recovery codes copied.');}catch{err.textContent='Could not copy. Select the codes and copy them by hand.';}};
  $('#twofa-codes-download').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([codesText()],{type:'text/plain'}));a.download='jellypass-recovery-codes.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);say('Recovery codes downloaded.');};
  function change(fn){return act(async()=>{err.textContent='';
   try{await fn();}catch(e){err.textContent=actionError(e);}
   finally{await load();}});}
  $('#twofa-totp-start').onclick=()=>change(async()=>{const r=await api('/api/account/2fa/totp/start',{});$('#twofa-secret').textContent=r.secret.replace(/(.{4})/g,'$1 ').trim();$('#twofa-uri').href=r.uri;qr(r.uri);$('#twofa-totp-confirm').hidden=false;$('#twofa-code').focus();});
  $('#twofa-totp-confirm').addEventListener('submit',e=>{e.preventDefault();act(async()=>{err.textContent='';try{const r=await api('/api/account/2fa/totp/enable',{code:$('#twofa-code').value});$('#twofa-totp-confirm').hidden=true;$('#twofa-code').value='';showCodes(r.recoveryCodes);say('Authenticator app turned on.');await load();}catch(e){err.textContent=actionError(e);}});});
  $('#twofa-totp-off').onclick=()=>confirmed('Remove your authenticator app?',pw=>api('/api/account/2fa/totp',{password:pw},'DELETE').then(()=>{$('#twofa-totp-confirm').hidden=true;say('Authenticator app removed.');}));
  $('#twofa-recovery').onclick=()=>confirmed('Make new recovery codes? Your old ones will stop working.',async pw=>{const r=await api('/api/account/2fa/recovery',{password:pw});showCodes(r.recoveryCodes);say('New recovery codes made. The old ones no longer work.');});
  $('#twofa-passkey-add').onclick=()=>change(async()=>{
   if(!window.PublicKeyCredential)throw new Error('This browser cannot use passkeys.');
   const o=await api('/api/account/2fa/passkey/options',{});let cred;
   try{cred=await navigator.credentials.create({publicKey:{...o,challenge:u8(o.challenge),user:{...o.user,id:u8(o.user.id)},excludeCredentials:o.excludeCredentials.map(c=>({...c,id:u8(c.id)}))}});}catch{throw new Error('No passkey was added.');}
   made=cred;$('#twofa-passkey-save').hidden=false;$('#twofa-passkey-name').focus();});
  $('#twofa-passkey-save').addEventListener('submit',e=>{e.preventDefault();act(async()=>{err.textContent='';
   try{const r=made.response,res=await api('/api/account/2fa/passkey',{id:made.id,name:$('#twofa-passkey-name').value.trim(),clientDataJSON:b64u(r.clientDataJSON),attestationObject:b64u(r.attestationObject)});
    made=null;$('#twofa-passkey-save').hidden=true;$('#twofa-passkey-name').value='';showCodes(res.recoveryCodes);say('Passkey added.');await load();}
   catch(e){err.textContent=actionError(e);}});});
  load();
 }
 $('#account-magic-cancel').addEventListener('click',()=>{box.hidden=true;$('#account-magic-password').value='';});
  box.addEventListener('submit',e=>{e.preventDefault();err.textContent='';act(async()=>{try{await api('/api/account/magic',{on:true,password:$('#account-magic-password').value},'PUT');sw.checked=true;box.hidden=true;$('#account-magic-password').value='';note.textContent='On. You can ask for a link from the sign-in page.';say('Sign-in links are on.');}catch(e){err.textContent=e.status===403?'That password was not right.':actionError(e);$('#account-magic-password').focus();}});});
 }
 $('#delete-account').onclick=()=>{$('#delete-error').textContent='';$('#delete-form').reset();$('#delete-dialog').showModal();};
 $('#delete-cancel').onclick=()=>$('#delete-dialog').close();
 $('#delete-form').onsubmit=e=>{e.preventDefault();$('#delete-error').textContent='';act(async()=>{try{await api('/api/account/delete',{confirm:$('#delete-confirm').value.trim(),password:$('#delete-password').value});location.href='/signin';}catch(err){$('#delete-error').textContent=actionError(err);}});};
 $('#account-alerts').onchange=async()=>{
  if(!account||alertsSaving)return;
  $('#account-alerts').checked=account.alertsOn;
  if(account.alertsOn){$('#alerts-error').textContent='';$('#alerts-password').removeAttribute('aria-invalid');alertsDialog.showModal();return;}
  alertsSaving=true;$('#account-alerts').disabled=true;
  try {await act(async()=>{
   $('#account-alerts-error').textContent='';
   try {await ready;await api('/api/account/alerts',{on:true},'PUT');account.alertsOn=true;$('#account-alerts').checked=true;say('Sign-in alerts turned on.');}
   catch(e){$('#account-alerts-error').textContent=actionError(e);}
  });}finally{alertsSaving=false;syncAccountControls();}
 };
 $('#alerts-form').onsubmit=async event=>{
  event.preventDefault();if(alertsSaving)return;alertsSaving=true;$('#account-alerts').disabled=true;
  try {await act(async()=>{
   $('#alerts-error').textContent='';$('#alerts-password').removeAttribute('aria-invalid');
   try {await ready;await api('/api/account/alerts',{on:false,password:$('#alerts-password').value},'PUT');account.alertsOn=false;$('#account-alerts').checked=false;alertsDialog.close();say('Sign-in alerts turned off.');}
   catch(e){$('#account-alerts').checked=true;$('#alerts-error').textContent=actionError(e);if(e.status===403)$('#alerts-password').setAttribute('aria-invalid','true');$('#alerts-password').focus();}
   finally{$('#alerts-password').value='';}
  },$('#alerts-form'));}finally{alertsSaving=false;syncAccountControls();}
 };
 $('#alerts-cancel').onclick=()=>alertsDialog.close();
 alertsDialog.addEventListener('cancel',event=>{if(alertsSaving)event.preventDefault();});
 alertsDialog.addEventListener('close',()=>{$('#alerts-password').value='';$('#account-alerts').focus();});
 loadAccount();
 let pendingEmail='';
 document.querySelectorAll('[data-reveal]').forEach(button=>button.onclick=()=>{
  const panel=document.getElementById(button.dataset.reveal);panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));
  button.textContent=panel.hidden?'Change':'Cancel';if(!panel.hidden)panel.querySelector('input')?.focus();
 });
 $('#next').addEventListener('input',()=>{const value=$('#next').value;const score=Number(value.length>=8)+Number(value.length>=12)+Number(/[A-Z]/.test(value)&&/[a-z]/.test(value))+Number(/[^a-zA-Z]/.test(value));const meter=$('#password-strength');meter.style.width=(value?score*25:0)+'%';meter.style.background=score>=3?'var(--ok)':score>=2?'var(--warn)':'var(--bad)';});
 region('#email-state',async()=>{const d=await read('/api/onboarding');$('#email-address').value=d.contactEmail||'';$('#contact-email').textContent=d.contactEmail||'No email added';if(!account)emailStatus(d.emailVerified);$('#reminders').checked=d.remindersOn;});
 submit('#change-password',async()=>{await ready;await api('/api/account/password',{current:$('#current').value,next:$('#next').value});$('#change-password').reset();$('#password-strength').style.width='0';say('Password changed. Your other sessions have been signed out.');await loadAccount();setTimeout(syncAccountControls,0);});
 submit('#email',async()=>{await ready;const email=$('#email-address').value.trim();await api('/api/email/send-code',{email,password:$('#email-password').value});pendingEmail=email;$('#email-code').value='';$('#email-password').value='';$('#confirm-email').hidden=false;say('Check your email. The code works for 10 minutes.');$('#email-code').focus();});
 submit('#confirm-email',async()=>{await ready;await api('/api/email/confirm',{code:$('#email-code').value});$('#confirm-email').hidden=true;$('#email-state').textContent='Verified';$('#contact-email').textContent=pendingEmail;$('#email-address').value=pendingEmail;$('#email-code').value='';emailStatus(true);say('Email verified.');await loadAccount();setTimeout(syncAccountControls,0);});
 $('#reminders').onchange=()=>act(async()=>{try {await ready;await api('/api/me/reminders',{on:$('#reminders').checked},'PUT');say('Reminder preference saved.');}catch(e){$('#reminders').checked=!$('#reminders').checked;throw e;}});
}
if(page==='help') {
 const guides=[
  ['Open your TV’s app store and search for Jellyfin.','Install and open it, then choose Add server.','Type the server address below.','Choose Quick Connect and type the code it shows into the box at the top of this page.'],
  ['Install Jellyfin from the App Store or Google Play.','Open it, tap Add server and paste the address below (use Copy).','Sign in with your username and password.'],
  ['On the TV, search for Jellyfin in the Amazon or Google Play store and install it.','Open it and choose Add server, then type the address below.','Choose Quick Connect and type the code it shows into the box at the top of this page.'],
  ['Open the Jellyfin button on Home, or the server address below, in any modern browser.','Sign in with your username and password.','Bookmark it, or use Add to Home Screen on a phone, so it is one tap next time.']];
 document.querySelectorAll('[data-guide]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-guide]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('#guide-instructions').replaceChildren(...guides[Number(b.dataset.guide)].map(t=>li(text('span',t))));});
 // Collapsible sections remember what each member left open; links to #something open the section that holds it.
 { const KEY='help-closed',secs=[...document.querySelectorAll('details[data-sec]')];
   let closed=[];try{closed=JSON.parse(localStorage.getItem(KEY)||'[]');}catch{}
   secs.forEach(d=>{if(closed.includes(d.dataset.sec))d.open=false;d.addEventListener('toggle',()=>{closed=secs.filter(x=>!x.open).map(x=>x.dataset.sec);try{localStorage.setItem(KEY,JSON.stringify(closed));}catch{}});});
   const reveal=el=>{for(let n=el&&el.closest('details');n;n=n.parentElement&&n.parentElement.closest('details'))n.open=true;};
   document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[href^="#"]');if(!a||a.getAttribute('href')==='#')return;const t=document.getElementById(a.getAttribute('href').slice(1));reveal(t);if(a.dataset.subject){const sel=$('#subject');if([...sel.options].some(o=>o.value===a.dataset.subject||o.text===a.dataset.subject))sel.value=a.dataset.subject;}});
   if(location.hash.length>1)reveal(document.getElementById(location.hash.slice(1))); }
 document.querySelectorAll('[data-copy-server]').forEach(b=>b.onclick=()=>act(async()=>{await navigator.clipboard.writeText($('#help-server-url').textContent);say('Server address copied.');}));
 const articleEls=()=>[...document.querySelectorAll('[data-article]')].filter(a=>!a.hidden);
 $('#help-expand').onclick=()=>articleEls().forEach(a=>{a.open=true;});$('#help-collapse').onclick=()=>articleEls().forEach(a=>{a.open=false;});
 document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{const q=$('#help-search');q.value=b.dataset.q;category='all';document.querySelectorAll('[data-category]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.category==='all')));filter();const first=articleEls()[0];if(first)first.open=true;$('#articles').scrollIntoView({block:'start'});});
 $('#copy-server').onclick=()=>act(async()=>{await navigator.clipboard.writeText($('#guide-server').textContent);say('Server address copied.');});
 let category='all';function filter(){let count=0;document.querySelectorAll('[data-article]').forEach(a=>{a.hidden=!((category==='all'||a.dataset.article===category)&&a.textContent.toLowerCase().includes($('#help-search').value.toLowerCase()));if(!a.hidden)count++;});$('#no-help').hidden=!!count;if($('#help-search').value.trim()&&count<=3)articleEls().forEach(a=>{a.open=true;});}
 {const want=new URLSearchParams(location.search).get('subject'),sel=$('#subject');if(want&&[...sel.options].some(o=>o.value===want||o.text===want))sel.value=want;}
 $('#help-search').oninput=filter;document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;document.querySelectorAll('[data-category]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));filter();});
 submit('#help-quickconnect',async()=>{const out=$('#help-qc-result');out.textContent='';try{await ready;await api('/api/onboarding/quickconnect',{code:$('#help-qc-code').value.trim()});out.textContent='Done! Your device is signed in. You can start watching.';$('#help-qc-code').value='';}catch(e){out.textContent=e.status===400?'Enter the 6 digit code shown on your TV.':e.status===422?'That code did not work. Check the code on your TV (they expire quickly) and try again.':e.status===429?'Too many tries. Wait a few minutes and try again.':e.message;}});
 $('#help-copy-url').onclick=()=>act(async()=>{await navigator.clipboard.writeText($('#help-server-url').textContent);say('Server address copied.');});
 // Official Jellyfin apps, kept up to date from jellyfin.org by the server.
 const grid=$('#client-grid'),server=grid.dataset.server.replace(/\/$/,''),svgNs='http://www.w3.org/2000/svg';
 const ART={phone:'M8 3h8a2 2 0 012 2v14a2 2 0 01-2 2H8a2 2 0 01-2-2V5a2 2 0 012-2zM11 18h2',tv:'M3 8h18v11H3zM8 3.5L12 8l4-4.5',desktop:'M4 5h16v11H4zM8 20h8M12 16v4',browser:'M3 5h18v14H3zM3 9h18M6.5 7h.01M9.5 7h.01'};
 const kindOf=c=>c.platforms.includes('Browser')?'browser':c.deviceTypes.includes('TV')?'tv':c.deviceTypes.includes('Mobile')?'phone':'desktop';
 const groupsOf=c=>{const g=[];if(c.deviceTypes.includes('Mobile'))g.push('phone');if(c.deviceTypes.includes('TV'))g.push('tv');if(c.deviceTypes.includes('Desktop'))g.push('computer');if(c.platforms.includes('Browser'))g.push('browser');return g;};
 const art=kind=>{const svg=document.createElementNS(svgNs,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','help-device-icon');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');const path=document.createElementNS(svgNs,'path');path.setAttribute('d',ART[kind]);svg.append(path);return svg;};
 const stepsFor=c=>{const k=kindOf(c),n=c.name;
  if(k==='browser')return ['Open '+server+' in any modern web browser. There is nothing to install.','Sign in with your username and password.'];
  const steps=[k==='desktop'?'Download “'+n+'” with the Get it button and install it.':'Install “'+n+'” with the Get it button, or search for it in your device’s app store.','Open it and choose Add server (sometimes called Connect to server).','Type our server address: '+server];
  steps.push(k==='tv'?'Sign in with your username and password, or choose Quick Connect: the TV shows a 6 digit code. Approve it from Jellyfin on your phone or the web (profile menu, then Quick Connect).':'Sign in with your username and password.');return steps;};
 function card(c){
  const k=kindOf(c),el=text('article','','card help-client');el.dataset.groups=groupsOf(c).join(' ');
  const head=text('div','','help-client-head');head.append(art(k));
  const titles=text('div','','grow');const h=text('h3',c.name);titles.append(h);
  const badges=text('div','','help-badges');if(c.recommended)badges.append(text('span','Recommended','help-badge is-rec'));if(c.beta)badges.append(text('span','Beta','help-badge'));if(badges.children.length)titles.append(badges);
  head.append(titles);el.append(head,text('p',c.description,'muted'));
  const plats=text('div','','help-platforms');c.platforms.forEach(p=>plats.append(text('span',p,'help-chip')));el.append(plats);
  const acts=text('div','','actions');
  const rank=l=>/play store|app store/i.test(l.name)?0:/amazon|channel|store|testflight/i.test(l.name)?1:/f-droid|flathub/i.test(l.name)?2:3;
  c.links.slice().sort((a,b)=>rank(a)-rank(b)).slice(0,3).forEach((l,i)=>{const a=document.createElement('a');a.className='btn'+(i===0?' pri':'');a.href=l.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=i===0&&c.links.length===1?'Get it':l.name;acts.append(a);});
  if(acts.children.length)el.append(acts);
  const d=document.createElement('details');d.append(text('summary','How to set it up'));const ol=document.createElement('ol');stepsFor(c).forEach(t=>ol.append(li(text('span',t))));d.append(ol);el.append(d);
  if(c.moreLinks.length){const more=text('p','','help-more');c.moreLinks.slice(0,2).forEach((l,i)=>{if(i)more.append(document.createTextNode(' · '));const a=link(l.url,l.name);a.target='_blank';a.rel='noopener noreferrer';more.append(a);});el.append(more);}
  return el;
 }
 region('#client-grid',async()=>{
  const data=await read('/api/help/clients');
  grid.replaceChildren(...data.clients.map(card),Object.assign(text('p','No apps match this filter.','muted'),{id:'no-clients',hidden:true}));
  grid.setAttribute('aria-busy','false');
  const when=new Date(data.updatedAt);$('#clients-updated').textContent=Number.isFinite(+when)?'Kept up to date automatically (last checked '+when.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})+').':'';
 });
 document.querySelectorAll('[data-device]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-device]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));let n=0;grid.querySelectorAll('.help-client').forEach(c=>{const show=b.dataset.device==='all'||c.dataset.groups.split(' ').includes(b.dataset.device);c.hidden=!show;if(show)n++;});const none=$('#no-clients');if(none)none.hidden=n>0;});
 submit('#help-message',async()=>{await ready;await api('/api/help/message',{subject:$('#subject').value,body:$('#message').value,diagnostics:$('#diagnostics').checked});$('#message').value='';say('Message sent. An admin will get back to you.');});
}
if(page==='devices') region('#signins',async()=>{
 const rows=await read('/api/signins');let verified=false;try{verified=(await read('/api/onboarding')).emailVerified;}catch{}
 // One line per device and place (the latest sign-in plus how many), 8 shown at a time, so the page stays short.
 const groups=new Map(); for(const r of rows){ const k=(r.device||'Unknown device')+'|'+(r.city||''); const g=groups.get(k); if(g) g.count++; else groups.set(k,{...r,count:1}); }
 const devices=new Map();rows.forEach(r=>{const name=r.device||'Unknown device';if(!devices.has(name))devices.set(name,r);});
 $('#device-count').textContent=String(devices.size);
 $('#device-list').replaceChildren(...[...devices].map(([name,r])=>li(text('span',name,'grow'),text('span',ago(r.seenAt),'faint'))));
 if(!devices.size)$('#device-list').append(li(text('span','No devices yet. Install Jellyfin on your TV or phone, then use Quick Connect.','muted')));
 const list=[...groups.values()]; let shown=8, selected; const dialog=$('#not-me-dialog');
 const when=v=>v?new Date(v).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
 function draw() {
  $('#signins').innerHTML=(list.slice(0,shown).map(r=>'<div class="signin-row"><div class="grow"><b>'+esc(r.device||'Unknown device')+'</b>'+(r.count>1?' <span class="faint">× '+esc(r.count)+'</span>':'')+'<p class="muted" style="font-size:13px">'+esc(r.city||'Location unknown')+(r.ip?' · '+esc(r.ip):'')+' · '+esc(when(r.seenAt))+' · '+(r.source==='portal'?'Jellypass':'Jellyfin')+'</p></div><button class="btn" data-not-me="'+esc(r.id)+'">This wasn’t me</button></div>').join('')||'<p>No sign-ins yet.</p>')+(list.length>shown?'<p><button class="btn" id="signins-more">Show '+(list.length-shown)+' more</button></p>':'');
  document.querySelectorAll('[data-not-me]').forEach(b=>b.onclick=()=>{selected=b.dataset.notMe;dialog.showModal();});
  const more=$('#signins-more'); if(more) more.onclick=()=>{shown+=8;draw();};
 }
 $('#devices-signout').onclick=()=>{if(confirm('Sign out every Jellyfin app, TV and other browser? You stay signed in here.'))act(async()=>{await api('/api/account/sign-out-devices');$('#status').textContent='Signed out of your other devices.';});};
 draw(); $('#not-me-cancel').onclick=()=>dialog.close();
 $('#not-me-confirm').onclick=()=>act(async()=>{await api('/api/signins/'+encodeURIComponent(selected)+'/not-me');dialog.close();$('#signins').innerHTML='<p>You have been signed out everywhere. Your Jellyfin password was reset to a random one.</p>'+(verified?'<p>Reset your password to get back in.</p><a class="btn pri" href="/forgot">Reset your password</a>':'<p>You have no confirmed email. Ask an admin to help you recover your account.</p><a href="/forgot">Password recovery</a>');say('Your account has been secured.');});
 await import('/assets/devices-map.js').then(m=>m.drawMap(rows));
});
`;
