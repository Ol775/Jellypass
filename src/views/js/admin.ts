/** Browser ES module, served verbatim. All API text is rendered with textContent. */
export const adminJs = String.raw`
import { $, api } from '/assets/common.js';
import { ready, read, avatar } from '/assets/shell.js';
const page = $('[data-page]').dataset.page;
/* Self-hosted installs: tell admins when a newer release exists (404 on Cloudflare, so nothing shows there). */
(async()=>{try{await ready;const a=await read('/api/admin/selfhost/about');if(!a.updateAvailable)return;let gone='';try{gone=localStorage.getItem('jp-update-dismissed')||'';}catch(e){}if(gone===a.latest.version)return;
 const host=document.querySelector('main')||document.body;const b=el('div',null,'update-banner');b.setAttribute('role','status');
 b.append(el('span','Jellypass '+a.latest.version+' is available (you have '+a.version+').'));const go=el('a','See what is new');go.href='/admin/settings#settings-selfhost';b.append(go);
 const x=el('button','Dismiss','btn ghost');x.type='button';x.addEventListener('click',()=>{try{localStorage.setItem('jp-update-dismissed',a.latest.version);}catch(e){}b.remove();});b.append(x);host.prepend(b);}catch(e){}})();
const say = text => { $('#status').textContent = text; };
const error = e => { const message=e.message || String(e); $('#error').textContent=message; const dialog=$('dialog[open]'); if(dialog){let notice=dialog.querySelector('[role=alert]');if(!notice){notice=el('p',null,'err');notice.setAttribute('role','alert');notice.tabIndex=-1;dialog.prepend(notice);}notice.textContent=message;notice.focus();}else $('#error').focus(); };
const path = (base,id,suffix='') => base + '/' + encodeURIComponent(id) + suffix;
function el(tag,text,cls) { const n=document.createElement(tag); if(text!=null)n.textContent=String(text); if(cls)n.className=cls; return n; }
function button(text,fn,danger=false) { const b=el('button',text,'btn'+(danger?' danger':'')); b.type='button'; b.addEventListener('click',()=>run(fn,b)); return b; }
async function run(fn,target) { if(target?.disabled)return; if(target)target.disabled=true; $('#error').textContent=''; try {await ready;await fn();} catch(e){error(e);} finally{if(target)target.disabled=false;} }
async function region(id,fn) { try {await fn();}catch(e){$(id).textContent='Could not load this section.';$(id).append(button('Try again',()=>region(id,fn)));error(e);} }
function form(id,fn) { $(id).addEventListener('submit',e=>{e.preventDefault();run(fn,$(id).querySelector('button[type="submit"],button:not([type])'));}); }
async function write(url,body={},method='POST') {await ready;return api(url,body,method);}
function confirmAction(message) { return new Promise(resolve => {
  document.getElementById('inline-confirm')?.remove();
  const back = document.activeElement, bar = el('div',null,'inline-confirm-bar'); bar.id = 'inline-confirm'; bar.setAttribute('role','group'); bar.setAttribute('aria-label','Confirm this action');
  const text = el('p',message), yes = el('button','Confirm','btn pri'), no = el('button','Cancel','btn'); yes.type = 'button'; no.type = 'button';
  const done = value => { document.removeEventListener('keydown', onKey, true); bar.remove(); if (back && back.isConnected) back.focus(); resolve(value); };
  const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); done(false); } };
  yes.addEventListener('click', () => done(true)); no.addEventListener('click', () => done(false));
  document.addEventListener('keydown', onKey, true);
  const actions = el('div',null,'actions'); actions.append(yes, no); bar.append(text, actions); document.body.append(bar); yes.focus();
}); }
function date(value,empty='Never') { if(!value)return el('span',empty,'muted');const d=new Date(value);if(!Number.isFinite(+d))return el('span','Date unknown');const days=Math.round((+d-Date.now())/86400000);const n=el('time',Math.abs(days)<1?'Today':new Intl.RelativeTimeFormat('en-GB',{numeric:'auto'}).format(days,'day'),'num');n.dateTime=d.toISOString();n.title=d.toLocaleString('en-GB');return n; }
function table(headers,rows,empty) {if(!rows.length)return el('p',empty,'pad muted');const t=el('table',null,'admin-table');const head=el('thead'),tr=el('tr');headers.forEach(h=>{const th=el('th',h);th.scope='col';tr.append(th);});head.append(tr);const body=el('tbody');rows.forEach(cells=>{const row=el('tr');cells.forEach((value,i)=>{const td=el('td');td.dataset.label=headers[i];td.append(value instanceof Node?value:document.createTextNode(String(value??'')));row.append(td);});body.append(row);});t.append(head,body);return t; }
function actions(...buttons){const n=el('div',null,'actions');n.append(...buttons);return n;}
function option(value,text){const o=el('option',text);o.value=String(value);return o;}
function input(label,type='text',value=''){const wrap=el('label',label);const field=el('input',null,'field');field.type=type;field.value=String(value);wrap.append(field);return {wrap,field};}
function select(label,options,value){const wrap=el('label',label),field=el('select',null,'field');options.forEach(p=>field.append(option(p.id,p.name)));if(value!=null)field.value=value;wrap.append(field);return {wrap,field};}
function number(field,min,max){const n=Number(field.value);if(!Number.isInteger(n)||n<min||n>max)throw new Error('Enter a whole number between '+min+' and '+max+'.');return n;}
function grants(p){if(!p)return 'Choose an access level.';return [(p.libraries==='all'?'Every library':p.libraries.length+' libraries'),Number(p.bitrateLimit)===0?'No streaming quality limit':'Streaming up to '+Number(p.bitrateLimit)/1000000+' Mbps',p.remoteAccess?'Watch away from home':'Home network only',({none:"Can't request titles",request:'Can request films and TV',auto:'Requests are approved automatically'})[p.requestRights],p.membershipDays?'Access for '+Number(p.membershipDays)+' days':'No end date'].join(' · ');}
function jsonDetails(value,label='Details'){const d=el('details'),p=el('pre');let parsed=value;try{parsed=JSON.parse(value);}catch{}p.textContent=typeof parsed==='string'?parsed:JSON.stringify(parsed,null,2);d.append(el('summary',label),p);return d;}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.close).close()));

if(page==='users') {
 const root=$('.admin-users'),list=$('#users-list'),panel=$('#user-panel'),detailBox=$('#user-detail'),sheet=$('#users-sheet'),search=$('#user-search');
 const narrow=window.matchMedia('(max-width:1200px)'),selected=new Set(),rows=new Map();
 let users=[],presets=null,filter='all',activeId=null,visible=[],timer,busy=false,loaded=false,returnFocus=null;
 const expired=u=>!!u.expiresAt&&Date.parse(u.expiresAt)<Date.now();
 const matches=(u,f)=>f==='active'?!u.isDisabled&&!expired(u):f==='expired'?expired(u):f==='disabled'?u.isDisabled:f==='admins'?u.isAdmin:true;
 const state=u=>u.isDisabled?'Disabled':u.isAdmin?'Admin':expired(u)?'Expired':'Active';
 function badge(text,kind){return el('span',text,'users-badge '+(kind||''));}
 function emailBadge(u){const n=badge(u.contactEmail?(u.emailVerified?'Verified':'Not verified'):'No email',u.contactEmail&&u.emailVerified?'verified':'');const ns=root.querySelector('svg').namespaceURI,icon=document.createElementNS(ns,'svg'),use=document.createElementNS(ns,'use');icon.setAttribute('class','i users-email-icon');icon.setAttribute('aria-hidden','true');icon.setAttribute('focusable','false');use.setAttribute('href',u.contactEmail&&u.emailVerified?'#check':'#mail');icon.append(use);n.prepend(icon);return n;}
 function endDate(u){return u.isAdmin||!u.expiresAt?el('span','No end date','muted'):date(u.expiresAt);}
 function lastSeen(value){if(!value)return el('span','Not seen yet','muted');const seen=new Date(value);if(!Number.isFinite(+seen))return el('span','Date unknown','muted');const today=new Date(),day=d=>Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()),days=Math.round((day(seen)-day(today))/86400000),n=el('time',days===0?'Today':new Intl.RelativeTimeFormat('en-GB',{numeric:'always'}).format(days,'day'),'num');n.dateTime=seen.toISOString();n.title=seen.toLocaleString('en-GB');return n;}
 function selectBox(label){const wrap=el('label',null,'users-check'),field=el('input');field.type='checkbox';field.setAttribute('aria-label',label);wrap.append(field);return {wrap,field};}
 const tableNode=el('table',null,'admin-table users-table'),thead=el('thead'),head=el('tr'),tbody=el('tbody'),all=selectBox('Select all visible users');
 const caption=el('caption','User accounts. Use arrow keys to move between rows and Enter to open details.','users-sr');tableNode.append(caption);
 ['Select','Name','Access level','Ends','Last seen','Email status'].forEach((name,i)=>{const th=el('th',i?name:null);th.scope='col';if(!i)th.append(all.wrap);head.append(th);});thead.append(head);tableNode.append(thead,tbody);
 const empty=el('div',null,'users-empty');empty.append(el('h2','No users match'),el('p','Try another name or clear your filters.','muted'),button('Clear filters',()=>{search.value='';filter='all';render();search.focus();}));
 function bulk(){
  const eligible=visible.filter(u=>!u.isAdmin),count=eligible.filter(u=>selected.has(u.id)).length;
  all.field.disabled=!eligible.length;all.field.checked=!!eligible.length&&count===eligible.length;all.field.indeterminate=count>0&&count<eligible.length;
  $('#bulk-form').hidden=!selected.size;$('#selected-count').textContent=selected.size+' selected';
  $('#bulk-days-wrap').hidden=$('#bulk-action').value!=='extend';$('#bulk-days').disabled=$('#bulk-action').value!=='extend';
  rows.forEach((r,id)=>{r.check.checked=selected.has(id);r.node.classList.toggle('is-selected',selected.has(id));r.node.classList.toggle('is-current',id===activeId);r.open.setAttribute('aria-expanded',String(id===activeId));});
 }
 function makeRow(u){
  const node=el('tr'),check=selectBox('Select '+u.name),identity=el('div',null,'users-identity'),name=el('div',null,'users-name-copy'),open=button(u.name,()=>showDetail(u.id));
  open.className='users-name-button';open.setAttribute('aria-controls','user-detail');
  const status=badge('','users-state'),access=badge('','users-access');name.append(open,status);identity.append(avatar(u.id,u.name),name);
  const cells=['Select','Name','Access level','Ends','Last seen','Email status'].map(label=>{const td=el('td');td.dataset.label=label;node.append(td);return td;});
  cells[0].append(check.wrap);cells[1].append(identity);cells[2].append(access);
  check.wrap.addEventListener('click',e=>e.stopPropagation());check.field.addEventListener('change',()=>{check.field.checked?selected.add(u.id):selected.delete(u.id);bulk();});
  node.addEventListener('click',e=>{if(!e.target.closest('button,input,label'))run(()=>showDetail(u.id));});
  node.addEventListener('keydown',e=>{
   if(e.target.closest('input'))return;
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const index=visible.findIndex(v=>v.id===u.id),next=visible[Math.max(0,Math.min(visible.length-1,index+(e.key==='ArrowDown'?1:-1)))];if(next)rows.get(next.id).open.focus();}
   else if(e.key==='Enter'&&e.target===node){e.preventDefault();run(()=>showDetail(u.id));}
  });
  node.tabIndex=-1;const r={node,check:check.field,open,status,access,cells,signature:''};rows.set(u.id,r);return r;
 }
 function render(){
  const query=search.value.trim().toLowerCase(),searched=users.filter(u=>u.name.toLowerCase().includes(query));visible=searched.filter(u=>matches(u,filter));const ids=new Set(visible.map(u=>u.id));
  root.querySelectorAll('[data-filter]').forEach(b=>{const count=searched.filter(u=>matches(u,b.dataset.filter)).length;b.querySelector('span').textContent=String(count);b.setAttribute('aria-pressed',String(filter===b.dataset.filter));});
  $('#user-search-clear').hidden=!search.value;$('#users-summary').textContent=visible.length+' of '+users.length+' users';
  users.forEach(u=>{
   if(u.isAdmin)selected.delete(u.id);const r=rows.get(u.id)||makeRow(u);if(!r.node.parentNode)tbody.append(r.node);r.node.hidden=!ids.has(u.id);
   const signature=JSON.stringify(u);if(signature!==r.signature){r.signature=signature;r.open.textContent=u.name;r.check.disabled=!!u.isAdmin;r.check.setAttribute('aria-label',u.isAdmin?u.name+' is an admin and cannot be selected':'Select '+u.name);r.status.textContent=state(u);r.status.dataset.state=state(u);r.access.textContent=u.isAdmin?'Admin':u.presetName||'No access level';r.access.classList.toggle('unassigned',!u.isAdmin&&!u.presetName);r.cells[3].replaceChildren(endDate(u));r.cells[4].replaceChildren(lastSeen(u.lastSeen));r.cells[5].replaceChildren(emailBadge(u));}
  });
  const existing=new Set(users.map(u=>u.id));rows.forEach((r,id)=>{if(!existing.has(id)){r.node.remove();rows.delete(id);selected.delete(id);}});
  tableNode.hidden=!visible.length;empty.hidden=!!visible.length;bulk();
 }
 async function load(){
  const fresh=await read('/api/admin/users');users=fresh;
  if(!loaded){list.replaceChildren(tableNode,empty);list.setAttribute('aria-busy','false');loaded=true;}
  render();
 }
 function placeDetail(){
  if(narrow.matches&&activeId){if(detailBox.parentNode!==sheet)sheet.append(detailBox);if(!sheet.open)sheet.showModal();}
  else {if(detailBox.parentNode!==panel)panel.append(detailBox);if(sheet.open)sheet.close();}
 }
 function closeDetail(){
  activeId=null;placeDetail();detailBox.replaceChildren(el('h2','User details'),el('p','Select a user to see their access and account actions.','muted'));bulk();
  const target=returnFocus?.isConnected&&!returnFocus.closest('[hidden]')?returnFocus:search;target.focus({preventScroll:true});
 }
 sheet.addEventListener('cancel',e=>{e.preventDefault();closeDetail();});
 sheet.addEventListener('close',()=>{if(narrow.matches&&activeId&&detailBox.parentNode===sheet)closeDetail();});
 narrow.addEventListener('change',()=>{placeDetail();if(activeId)$('#user-title')?.focus({preventScroll:true});});
 async function showDetail(id,focus=true,message=''){
  const u=users.find(x=>x.id===id);if(!u)return;
  if(focus)returnFocus=rows.get(id)?.open||document.activeElement;activeId=id;
  detailBox.replaceChildren();const close=button('Close',closeDetail);close.classList.add('users-close');
  const heading=el('div',null,'users-detail-heading'),copy=el('div'),title=el('h2',u.name);title.id='user-title';title.tabIndex=-1;
  const status=badge(state(u),'users-state');status.dataset.state=state(u);copy.append(title,status);heading.append(avatar(u.id,u.name),copy);
  const notice=el('p',message,'users-notice');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
  detailBox.append(close,heading,notice);placeDetail();bulk();if(focus)title.focus({preventScroll:true});
  function section(label){const s=el('section',null,'users-detail-section stack');s.append(el('h3',label));detailBox.append(s);return s;}
  const contact=section('Email');contact.append(emailBadge(u));if(u.contactEmail)contact.append(el('p',u.contactEmail,'users-email'));
  if(u.isAdmin){section('Account access').append(el('p','Admins keep their own access and have no membership end date.','muted'));return;}
  const access=section('Access level'),membership=section('Membership end date'),account=section('Account actions'),danger=section('Danger zone');danger.classList.add('users-danger');
  // Keep action failures next to the account and never replace the list while saving.
  async function change(suffix,body={},method='POST'){
   if(busy){notice.textContent='Another update is in progress. Please wait.';return;}
   busy=true;notice.className='users-notice';notice.textContent='Saving changes…';const controls=[...detailBox.querySelectorAll('button,input,select')].filter(n=>n!==close);controls.forEach(n=>n.disabled=true);
   try{
    await write(path('/api/admin/users',u.id,suffix),body,method);
    if(method==='DELETE'){users=users.filter(x=>x.id!==u.id);selected.delete(u.id);render();if(activeId===u.id)closeDetail();say('User deleted.');return;}
    // Reconcile with server truth, including Extend re-enabling disabled accounts.
    try{await load();}catch{notice.textContent='Saved, but the list could not refresh. Try refreshing the page.';return;}
    if(activeId===u.id){const scroll=sheet.open?sheet.scrollTop:panel.scrollTop;await showDetail(u.id,false,'Changes saved.');if(sheet.open)sheet.scrollTop=scroll;else panel.scrollTop=scroll;const h=$('#user-title');h?.focus({preventScroll:true});}
   }catch(e){notice.className='users-notice err';notice.textContent=e.message||'Could not save changes. Try again.';}
   finally{busy=false;controls.forEach(n=>n.disabled=false);}
  }
  membership.append(endDate(u),el('p','Extending access also enables this account.','muted'),actions(...[30,90,365].map(days=>button('+'+days+' days',()=>change('/extend',{days})))));
  const when=input(u.expiresAt?'Change the end date':'Add an end date','date',u.expiresAt?String(u.expiresAt).slice(0,10):'');when.field.min=new Date().toISOString().slice(0,10);
  membership.append(when.wrap,button(u.expiresAt?'Save end date':'Set end date',()=>{if(!when.field.value){notice.className='users-notice err';notice.textContent='Choose a date first.';when.field.focus();return;}return change('/end-date',{date:when.field.value});}));
  const days=input('Custom extension (days)','number',30);days.field.min='1';days.field.max='3650';
  membership.append(days.wrap,button('Extend access',()=>{try{return change('/extend',{days:number(days.field,1,3650)});}catch(e){notice.className='users-notice err';notice.textContent=e.message;days.field.focus();}}),button('Give no end date',async ()=>{if(await confirmAction(u.name+' will have access with no end date. Continue?'))return change('/indefinite',{});}));
  account.append(el('p',u.isDisabled?'This account is disabled.':'Disabling signs the user out of their devices.','muted'),button(u.isDisabled?'Enable account':'Disable account',async ()=>{if(await confirmAction((u.isDisabled?'Enable ':'Disable ')+u.name+'?'))return change(u.isDisabled?'/enable':'/disable');}));
  if(u.twoFactor&&!u.isAdmin){const pw=input('Your admin password','password');pw.field.autocomplete='current-password';account.append(el('p','Two-step sign-in is on. If they have lost their phone, passkey and recovery codes, reset it: they will be signed out and can sign in with just their password.','muted'),pw.wrap,button('Reset two-step sign-in',async ()=>{if(!pw.field.value){notice.className='users-notice err';notice.textContent='Enter your own password to confirm.';pw.field.focus();return;}if(await confirmAction('Reset two-step sign-in for '+u.name+'? Their authenticator app, passkeys and recovery codes are removed and they are signed out.'))return change('/reset-2fa',{password:pw.field.value});}));}
  const typed=input('Type '+u.name+' to confirm deletion');typed.field.autocomplete='off';
  danger.append(el('p','Permanently remove this account. This cannot be undone.','muted'),typed.wrap,button('Delete user',async ()=>{if(typed.field.value!==u.name){notice.className='users-notice err';notice.textContent='Type the username exactly to confirm.';typed.field.focus();return;}if(await confirmAction('Permanently delete '+u.name+'? This cannot be undone.'))return change('',{confirm:typed.field.value},'DELETE');},true));
  async function levels(){access.replaceChildren(el('h3','Access level'),el('p','Loading access levels…','muted'));try{
   if(!presets)presets=await read('/api/admin/presets');if(activeId!==id||!access.isConnected)return;
   access.replaceChildren(el('h3','Access level'));if(!presets.length){access.append(el('p','No access levels have been created yet.','muted'));return;}
   const group=el('fieldset',null,'level-choices'),legend=el('legend','Assigned level');legend.className='sr-only';group.append(legend);
   presets.forEach(p=>{const l=el('label',null,'level-choice'),r=el('input');r.type='radio';r.name='level-'+id;r.value=p.id;r.checked=p.id===u.presetId;l.append(r,el('span',p.name));group.append(l);});
   access.append(group,button('Apply access level',async ()=>{const pick=group.querySelector('input:checked');if(!pick){notice.textContent='Choose an access level first.';group.querySelector('input')?.focus();return;}if(await confirmAction('Assign this access level to '+u.name+'?'))return change('/preset',{presetId:pick.value});}));
  }catch{access.replaceChildren(el('h3','Access level'),el('p','Could not load access levels.','err'),button('Try again',levels));}}
  await levels();
 }
 all.field.addEventListener('change',()=>{visible.filter(u=>!u.isAdmin).forEach(u=>all.field.checked?selected.add(u.id):selected.delete(u.id));bulk();});
 search.addEventListener('input',()=>{clearTimeout(timer);$('#user-search-clear').hidden=!search.value;timer=setTimeout(render,180);});
 $('#user-search-clear').addEventListener('click',()=>{clearTimeout(timer);search.value='';render();search.focus();});
 root.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{clearTimeout(timer);filter=b.dataset.filter;render();}));
 $('#bulk-action').addEventListener('change',bulk);$('#bulk-clear').addEventListener('click',()=>{selected.clear();bulk();all.field.focus({preventScroll:true});});
 document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!sheet.open&&!e.target.closest('input,textarea,select,[contenteditable]')){e.preventDefault();search.focus();}if(e.key==='Escape'&&activeId&&!sheet.open){e.preventDefault();closeDetail();}});
 form('#bulk-form',async()=>{
  if(busy)return;const action=$('#bulk-action').value,ids=[...selected],results=$('#bulk-results');if(!ids.length)return;
  let days;try{days=action==='extend'?number($('#bulk-days'),1,3650):undefined;}catch(e){results.textContent=e.message;$('#bulk-days').focus();return;}
  if(!await confirmAction(action==='indefinite'?'Give '+ids.length+' selected users no end date?':action[0].toUpperCase()+action.slice(1)+' '+ids.length+' selected users?'))return;
  busy=true;results.textContent='Updating '+ids.length+' users…';
  try{const result=await write('/api/admin/users/bulk',{action,ids,days});const names=new Map(users.map(u=>[u.id,u.name]));const failed=result.results.filter(x=>!x.ok);result.results.filter(x=>x.ok).forEach(x=>selected.delete(x.id));
   results.replaceChildren(el('p',(result.results.length-failed.length)+' updated'+(failed.length?' · '+failed.length+' could not be updated.':'.')),...failed.map(x=>el('p',(names.get(x.id)||'User')+': '+(x.error||'Could not update'),'err')));
   try{await load();if(activeId)await showDetail(activeId,false);}catch{results.append(el('p','Updates saved, but the list could not refresh. Try refreshing the page.','err'));}
  }catch(e){results.textContent=e.message||'Could not update users. Try again.';}finally{busy=false;bulk();}
 });
 async function initial(){list.setAttribute('aria-busy','true');try{await load();}catch{list.setAttribute('aria-busy','false');list.replaceChildren(el('p','Could not load users.','pad err'),button('Try again',initial));$('#users-summary').textContent='Users unavailable';}}
 run(initial);
}

if(page==='invites') {
 let presets=[];
 async function load(){const all=await read('/api/admin/invites');const stateOf=r=>Number(r.uses)>=Number(r.max_uses)?'Accepted':Date.parse(r.expires_at)<=Date.now()?'Expired':'Pending';const rows=[...all].sort((a,b)=>(stateOf(a)==='Pending'?0:1)-(stateOf(b)==='Pending'?0:1));$('#invites-list').replaceChildren(table(['Sent to','Access','Uses','Status','Actions'],rows.map(r=>[r.email||'Share a link',presets.find(p=>p.id===r.preset_id)?.name||r.preset_id,Number(r.uses)+' / '+Number(r.max_uses),stateOf(r)==='Pending'?(()=>{const w=el('span','Pending, ends ');w.append(date(r.expires_at));return w;})():stateOf(r),actions(...(r.email&&stateOf(r)==='Pending'?[button('Resend',async()=>{if(!await confirmAction('Resend this invite? The old link will stop working.'))return;try{await write(path('/api/admin/invites',r.id,'/resend'));say('Invite resent. The old link no longer works.');await load();}catch(e){if(e.status===429)throw new Error('Wait a minute before resending this invite.');throw e;}})]:[]),button(stateOf(r)==='Pending'?'Revoke':'Remove',async()=>{if(await confirmAction(stateOf(r)==='Pending'?'Revoke this invite? The link stops working now.':'Remove this invite from the list?')){await write(path('/api/admin/invites',r.id),{},'DELETE');await load();say('Invite revoked. The link stops working now.');}},true))]),'No invites yet.'));}
 function emailPreview(){const box=$('#invite-preview-box'),id=$('#invite-preset').value;if(!box.open||!id)return;$('#invite-preview').src='/api/admin/invites/preview?preset='+encodeURIComponent(id)+'&days='+encodeURIComponent($('#invite-days').value||7);}
 function preview(){$('#invite-grants').textContent=grants(presets.find(p=>p.id===$('#invite-preset').value));emailPreview();}
 $('#invite-preview-box').addEventListener('toggle',emailPreview);$('#invite-days').addEventListener('change',emailPreview);
 $('#invite-preset').addEventListener('change',preview);
 form('#invite-form',async()=>{const emails=$('#invite-emails').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(emails.length>25||emails.some(x=>!/^\S+@[^\s@]+\.[^\s@]+$/.test(x)))throw new Error('Enter up to 25 valid email addresses, one per line.');const r=await write('/api/admin/invites',{presetId:$('#invite-preset').value,maxUses:number($('#invite-uses'),1,100),expiresInDays:number($('#invite-days'),1,90),...(emails.length?{emails}:{})});const out=$('#invite-created');out.replaceChildren();r.invites.forEach(i=>{const box=el('article',null,'help stack');box.append(el('b',i.email||'Share a link'));if(i.link){const line=input('Invite link','text',i.link);line.field.readOnly=true;box.append(line.wrap,button('Copy link',async()=>{await navigator.clipboard.writeText(i.link);say('Link copied.');}));}if(!i.ok)box.append(el('p','The email could not be sent; copy the link instead. '+(i.error||''),'err'));out.append(box);});say('Invites created. Copy the links now.');await load();});
 region('#invites-list',async()=>{presets=await read('/api/admin/presets');$('#invite-preset').replaceChildren(...presets.map(p=>option(p.id,p.name)));preview();await load();});
}

if(page==='streams') {
 let loading=false,pins=[],setPins=()=>{};
 $('#map').dataset.note='City-level locations of live streams.';
 import('/assets/devices-map.js').then(m=>m.drawMap(pins)).then(f=>{setPins=f;f(pins);});
 const streamUsers=read('/api/admin/users').catch(()=>[]);
 async function load(){if(loading)return;loading=true;try{const data=await read('/api/admin/streams'), avatarUsers=await streamUsers;$('#stream-health').textContent=data.degraded?'Tracearr is unavailable. Live streams will return when it reconnects.':'';$('#stream-health').className=data.degraded?'banner':'';$('#streams-list').replaceChildren(...data.streams.map(s=>{
  const row=el('article',null,'service stream');
  const message=input('Message to '+s.username+' (optional)');message.field.maxLength=200;
  const head=el('div',null,'stream-head');const names=el('div',null,'grow');names.append(el('b',s.title||'Unknown title'));if(s.subtitle)names.append(el('div',s.subtitle,'muted'));
  if(s.posterUrl){const img=document.createElement('img');img.src=s.posterUrl;img.alt='';img.className='stream-poster';img.loading='lazy';img.onerror=()=>img.remove();head.append(img);}
  head.append(avatar(avatarUsers.find(u=>u.name===s.username)?.id,s.username),names,el('span',null,'sp'),button('Stop stream',async()=>{if(await confirmAction('Stop '+s.username+'’s stream?')){await write(path('/api/admin/streams',s.id,'/terminate'),{message:message.field.value});await load();say('Stream stopped.');}},true));
  const state=s.state==='paused'?'Paused':s.state==='playing'?'Playing':(s.state||'');
  const meta=[s.username,s.device,state,s.transcoding?'Transcoding':'Direct play',s.resolution,s.durationMinutes?s.durationMinutes+' min':''].filter(Boolean).join(' · ');
  names.append(el('p',meta,'muted'));row.append(head);
  const fmt=v=>{const t=new Date(v);if(!Number.isFinite(+t))return '';const same=t.toDateString()===new Date().toDateString();return (same?'Today ':t.toLocaleDateString('en-GB',{day:'numeric',month:'short'})+', ')+t.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});};
  const left=m=>m>=60?Math.floor(m/60)+' h'+(m%60?' '+(m%60)+' min':''):m+' min';
  const facts=el('dl',null,'stream-facts');const fact=(k,v,muted)=>{facts.append(el('dt',k),el('dd',v,muted?'muted':''));};
  if(s.startedAt)fact('Started',fmt(s.startedAt));
  if(s.remainingMinutes!=null)fact(s.state==='paused'?'Time left':'Ends about',s.state==='paused'?left(s.remainingMinutes)+' (paused)':fmt(Date.now()+s.remainingMinutes*60000)+' ('+left(s.remainingMinutes)+' left)');
  fact('Address',s.ip?[s.ip,s.city,s.isp].filter(Boolean).join(' · ')+(s.city||s.isp?'':' · Location unknown'):'Unavailable',!s.ip);
  row.append(facts);
  if(s.progressPct!=null){const bar=el('span',null,'prog');bar.setAttribute('role','img');bar.setAttribute('aria-label',s.progressPct+' percent played');const fill=document.createElement('i');fill.style.width=Math.max(0,Math.min(100,Number(s.progressPct)||0))+'%';bar.append(fill);head.insertBefore(bar,head.lastChild);}
  const more=el('details');const sendMsg=button('Send message',async()=>{const text=message.field.value.trim();if(!text){say('Type a message first.');return;}await write(path('/api/admin/streams',s.id,'/message'),{message:text});message.field.value='';say('Message sent to '+s.username+'.');});more.append(el('summary','Add a message for them'),message.wrap,sendMsg);row.append(more);
  return row;}));pins=data.streams.map(s=>({lat:s.lat,lng:s.lng,city:s.city,device:s.username+' · '+s.title,ip:s.ip,seenAt:s.startedAt}));setPins(pins);$('#streams-map').hidden=!pins.some(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));if(!data.streams.length)$('#streams-list').append(el('p',data.degraded?'Stream information is temporarily unavailable.':'No one is streaming right now.','muted'));}finally{loading=false;}}
 region('#streams-list',load);const timer=setInterval(()=>{if(!document.hidden&&!$('#streams-list').contains(document.activeElement))region('#streams-list',load);},15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('#streams-list').contains(document.activeElement))region('#streams-list',load);});window.addEventListener('pagehide',()=>clearInterval(timer));
}

if(page==='announcements') {
 async function load(){const rows=await read('/api/announcements');$('#announcements-list').replaceChildren(...rows.map(a=>{const row=el('article',null,'service announcement-row');row.append(el('h3',a.title),el('p',a.body),el('p',a.kind==='incident'?'Status update':'Announcement','muted'),button('Take down',async()=>{if(await confirmAction('Take down this announcement?')){await write(path('/api/admin/announcements',a.id),{},'DELETE');await load();say('Announcement taken down.');}},true));return row;}));if(!rows.length)$('#announcements-list').append(el('p','No live announcements.','muted'));}
 form('#announcement-form',async()=>{await write('/api/admin/announcements',{title:$('#announcement-title').value,body:$('#announcement-body').value,kind:$('#announcement-kind').value});$('#announcement-form').reset();await load();say('Published. Members see it on Home.');});region('#announcements-list',load);
}

if(page==='audit') {
 let rows=[],before=null,more=true;
 const LABELS={'account.alerts_email':'Turned sign-in alerts on','account.alerts_off':'Turned sign-in alerts off','account.end_session':'Ended a browser session','account.secured_not_me':'Pressed “This wasn’t me”','account.self_delete':'Deleted their own account','account.sign_out_devices':'Signed out all devices','account.sign_out_others':'Signed out other browsers','compare.on':'Turned Compare on','compare.off':'Turned Compare off','expiry.failed':'Expiry job failed','invite.create':'Created an invite','invite.redeem':'Accepted an invite','key.set':'Saved an API key','migrate.jfa_go':'Imported from jfa-go','password.change':'Changed their password','password.reset':'Reset their password','preset.apply':'Applied an access level','redeem.orphan':'Invite used but setup incomplete','seerr.import_failed':'Seerr import failed','seerr.permissions_failed':'Seerr permissions failed','seerr.email_failed':'Seerr email not updated','signin.not_me':'Pressed “This wasn’t me” on a sign-in','user.expire':'Account expired','user.delete':'Deleted a user','stream.message':'Sent a message to a viewer','notice.send':'Sent a notice','notice.remove':'Removed a notice','settings.update':'Changed a setting','settings.maintenance':'Changed maintenance mode','announcement.create':'Published an announcement','announcement.remove':'Removed an announcement','stream.terminate':'Stopped a stream','user.extend':'Extended access','user.indefinite':'Removed the end date','user.preset':'Changed access level','user.disable':'Disabled a user','user.end_date':'Set an end date','user.reset_2fa':'Reset two-step sign-in','user.enable':'Enabled a user','invite.resend':'Resent an invite','invite.revoke':'Revoked an invite','key.remove':'Removed an API key','preset.create':'Created an access level','preset.update':'Edited an access level','preset.delete':'Deleted an access level','preset.clone':'Copied an access level','security.clear_lockout':'Cleared a lockout','security.revoke_session':'Ended a session','security.sign_out_all':'Signed everyone out','security.sign_out_user':'Signed a user out'};
 const label=a=>LABELS[a]||(()=>{const [h,...t]=String(a).split('.');return h.charAt(0).toUpperCase()+h.slice(1)+(t.length?': '+t.join(' ').replace(/_/g,' '):'');})();
 const CATS={security:['Security',a=>/^(password|signin|account\.(secured|alerts|end_session|sign_out))/.test(a)||a==='key.set'],invites:['Invites',a=>/^(invite|redeem)/.test(a)],users:['Users',a=>/^(user|preset|expiry|account\.self_delete)/.test(a)],notices:['Notices',a=>/^(notice|announcement)/.test(a)],streams:['Streams',a=>a.startsWith('stream.')],settings:['Settings',a=>/^(settings|compare|migrate)/.test(a)],failed:['Failed',a=>/failed|orphan/.test(a)]};
 let cat='';
 const DANGER=new Set(['account.secured_not_me','signin.not_me','account.alerts_off','account.self_delete','user.delete','password.reset']);
 const severity=a=>a==='seerr.email_failed'?'warn':/failed|orphan/.test(a)?'bad':DANGER.has(a)?'warn':'ok';
 const q=v=>'“'+String(v).slice(0,80)+(String(v).length>80?'…':'')+'”',when=v=>{const d=new Date(v);return Number.isFinite(+d)?d.toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):String(v);},n=(c,w)=>c+' '+w+(Number(c)===1?'':'s');
 const describe=(r,d)=>{const t=r.target_name||d.name||'a user',a=r.action;switch(a){
  case 'notice.send':return 'Sent the notice '+q(d.title)+' to members’ bells'+(d.push?' and pushed it to '+n(d.members||0,'member')+'.':'.');
  case 'notice.remove':return 'Removed a notice from members’ bells.';
  case 'announcement.create':return 'Published the announcement '+q(d.title)+'.';
  case 'announcement.remove':return 'Removed an announcement.';
  case 'settings.maintenance':return 'Turned maintenance mode '+(d.enabled?'on':'off')+(d.message?' with the message '+q(d.message):'')+'.'+(d.startsAt||d.endsAt?' Scheduled '+(d.startsAt?when(d.startsAt):'now')+' to '+(d.endsAt?when(d.endsAt):'no end set')+'.':'');
  case 'settings.update':return r.target==='digest_email'?'Turned the daily security digest '+(d.on?'on.':'off.'):r.target==='outage_email'?'Turned outage emails '+(d.value?'on.':'off.'):null;
  case 'stream.message':return 'Sent a viewer the message '+q(d.message)+'.';
  case 'stream.terminate':return 'Stopped a stream'+(d.message?' with the message '+q(d.message):'')+'.';
  case 'user.delete':return 'Deleted the account '+(d.name||t)+'.';
  case 'user.extend':return 'Extended '+t+'’s access by '+n(d.days,'day')+(d.expiresAt?', to '+when(d.expiresAt):'')+'.';
  case 'user.reset_2fa':return 'Reset '+t+'’s two-step sign-in.';
  case 'user.end_date':return 'Set '+t+'’s access to end on '+(d.expiresAt?new Date(d.expiresAt).toLocaleDateString('en-GB'):'a chosen date')+'.';
  case 'user.indefinite':return 'Removed '+t+'’s end date, so access no longer expires.';
  case 'user.preset':return 'Changed '+t+'’s access level to '+d.preset+'.';
  case 'user.disable':return 'Disabled '+t+'’s account.';
  case 'user.enable':return 'Enabled '+t+'’s account.';
  case 'user.expire':return (d.name||t)+'’s access ran out and the account was disabled.';
  case 'expiry.failed':return 'Could not end '+(d.name||t)+'’s access: '+(d.error||'unknown error')+'.';
  case 'invite.create':return 'Created an invite '+(d.email?'for '+d.email:'as a shareable link')+' with '+d.preset+' access.';
  case 'invite.resend':return 'Sent an invite email again. The old link stopped working.';
  case 'invite.revoke':return 'Revoked an invite. Its link stopped working.';
  case 'invite.redeem':return 'Accepted an invite and joined with '+d.preset+' access.';
  case 'redeem.orphan':return 'Used an invite, but the account setup did not finish.';
  case 'seerr.email_failed':return 'Seerr kept its default email for this account (the rights are fine)'+(d.error?': '+d.error:'')+'.';
  case 'seerr.import_failed':case 'seerr.permissions_failed':return 'Seerr could not be set up for this account'+(d.error?': '+d.error:'')+'.';
  case 'preset.create':return 'Created the access level '+q(d.name)+'.';
  case 'preset.update':return 'Edited the access level '+q(d.name)+'.';
  case 'preset.delete':return 'Deleted an access level.';
  case 'preset.clone':return 'Copied an access level.';
  case 'preset.apply':return 'Applied an access level to its members: '+d.applied+' updated, '+d.skipped+' skipped, '+d.failed+' failed.';
  case 'key.set':return 'Saved the '+r.target+' key ('+(d.verified?'the connection worked':'the connection could not be checked')+').';
  case 'key.remove':return 'Removed the '+r.target+' key.';
  case 'security.clear_lockout':return 'Cleared a sign-in lockout (by '+(r.target==='ip'?'address':'username')+').';
  case 'security.revoke_session':return 'Ended a browser session for '+r.target+'.';
  case 'security.sign_out_all':return 'Signed everyone out'+(d.includeAdmins?', admins included':'')+' ('+n(d.ended||0,'session')+').';
  case 'security.sign_out_user':return 'Signed '+t+' out ('+n(d.sessions||0,'session')+').';
  case 'account.secured_not_me':return 'Pressed “This wasn’t me” and secured their account.';
  case 'account.self_delete':return 'Deleted their own account.';
  case 'account.sign_out_devices':return 'Signed out of all their devices.';
  case 'account.sign_out_others':return 'Signed out their other browsers.';
  case 'account.end_session':return 'Ended one of their browser sessions.';
  case 'account.alerts_email':return 'Turned sign-in alerts on.';
  case 'account.alerts_off':return 'Turned sign-in alerts off.';
  case 'password.change':return 'Changed their password.';
  case 'password.reset':return 'Reset their password with an emailed code.';
  case 'signin.not_me':return 'Pressed “This wasn’t me” on a sign-in.';
  case 'compare.on':return 'Turned Compare on.';
  case 'compare.off':return 'Turned Compare off.';
  case 'migrate.jfa_go':return 'Imported from jfa-go: '+n(d.users||0,'member')+' and '+n(d.invites||0,'invite')+'.';
  default:{const m=/^account\.notify_(\w+)_(on|off)$/.exec(a);return m?'Turned the '+m[1]+' notice '+m[2]+'.':null;}}};
 const detailPairs=json=>{let o;try{o=JSON.parse(json);}catch{return json&&json!=='{}'?[['',String(json).slice(0,120)]]:[];}if(!o||typeof o!=='object')return o?[['',String(o)]]:[];return Object.entries(o).filter(([,v])=>v!==null&&v!==''&&typeof v!=='object').map(([k,v])=>[k.replace(/_/g,' '),String(v).slice(0,80)]);};
 const dayLabel=d=>{const n=Math.round((new Date().setHours(0,0,0,0)-new Date(d).setHours(0,0,0,0))/86400000);return n===0?'Today':n===1?'Yesterday':d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});};
 const searchText=r=>[r.actor,label(r.action),r.action,r.target_name,r.target,r.detail_json].join(' ').toLowerCase();
 function render(){const q=$('#audit-search').value.trim().toLowerCase();
  const bar=$('#audit-filters');bar.replaceChildren(...[['','All',()=>true],...Object.entries(CATS).map(([k,[n,f]])=>[k,n,r=>f(r.action)])].map(([k,n,f])=>{const count=rows.filter(f).length;if(k&&!count)return null;const b=el('button',n+' '+count,'btn');b.type='button';b.setAttribute('aria-pressed',String(cat===k));b.onclick=()=>{cat=k;render();};return b;}).filter(Boolean));
  const test=cat?CATS[cat][1]:null,shown=rows.filter(r=>(!test||test(r.action))&&(!q||searchText(r).includes(q)));
  if(!shown.length){$('#audit-list').replaceChildren(el('p','No actions match.','card pad muted'));$('#audit-more').hidden=!more;return;}
  const groups=[];for(const r of shown){const d=new Date(r.at),key=Number.isFinite(+d)?d.toDateString():'?';const g=groups.at(-1);if(g&&g.key===key)g.items.push(r);else groups.push({key,d,items:[r]});}
  $('#audit-list').replaceChildren(...groups.map(g=>{const sec=el('section',null,'audit-day'),card=el('div',null,'card');sec.append(el('h2',Number.isFinite(+g.d)?dayLabel(g.d):'Date unknown'),card);
   g.items.forEach(r=>{const row=el('div',null,'audit-row'),d=new Date(r.at),sev=el('span',null,'audit-sev');sev.dataset.sev=severity(r.action);sev.title={ok:'Routine',warn:'Security-relevant',bad:'Something failed'}[sev.dataset.sev];
    const time=el('time',Number.isFinite(+d)?d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'?','audit-time num');time.dateTime=Number.isFinite(+d)?d.toISOString():'';time.title=Number.isFinite(+d)?d.toLocaleString('en-GB'):'';
    const what=el('div',null,'audit-what'),head=el('div',null,'audit-head');head.append(el('b',label(r.action)));what.append(head);
    let det={};try{det=JSON.parse(r.detail_json)||{};}catch{}const sentence=describe(r,det);
    if(sentence)what.append(el('p',sentence,'audit-sentence'));
    else{const pairs=detailPairs(r.detail_json);if(pairs.length){const c=el('div',null,'audit-chips');pairs.forEach(([k,v])=>c.append(el('span',k?k+': '+v:v)));what.append(c);}
     if(!r.target_name&&r.target){what.append(el('small',r.target,'audit-raw muted'));}}
    row.append(sev,time,el('span',r.actor,'audit-who'),what);card.append(row);});
   return sec;}));$('#audit-more').hidden=!more;}
 async function load(){const batch=await read('/api/admin/audit?limit=100'+(before==null?'':'&before='+encodeURIComponent(before)));rows.push(...batch);before=batch.at(-1)?.id??before;more=batch.length===100;render();}
 $('#audit-search').addEventListener('input',render);
 $('#audit-more').addEventListener('click',e=>run(load,e.currentTarget));region('#audit-list',load);
}

if(page==='settings') {
 const tabs=[...document.querySelectorAll('.settings-tabs [role="tab"]')].filter(t=>!t.hidden);
 function showSection(id,focus=false){
  const active=tabs.find(tab=>tab.getAttribute('aria-controls')===id)||tabs[0];
  tabs.forEach(tab=>{const selected=tab===active;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;document.getElementById(tab.getAttribute('aria-controls')).hidden=!selected;});
  if(focus)active.focus();
 }
 /* Handlers sit on the tab bar, so a tab added later (self-hosted installs) works too. */
 const tabBar=$('.settings-tabs');
 function activate(next){const id=next.getAttribute('aria-controls');showSection(id,true);if(location.hash!=='#'+id)history.replaceState(history.state,'','#'+id);}
 tabBar.addEventListener('click',event=>{const tab=event.target.closest('[role="tab"]');if(tab&&tabs.includes(tab))activate(tab);});
 tabBar.addEventListener('keydown',event=>{const tab=event.target.closest('[role="tab"]');const index=tabs.indexOf(tab);if(index<0)return;let next;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();activate(tabs[next]);});
 window.addEventListener('hashchange',()=>showSection(location.hash.slice(1)));
 showSection(location.hash.slice(1));
 let presets=[],libraries=[],editing=null,drySnapshot=null;
 const loadLocal=()=>read('/api/admin/selfhost').catch(()=>null); /* 404 on Cloudflare */
 let localP=loadLocal();
 async function refreshLocal(){localP=loadLocal();await Promise.all([keys(),selfhost()]);}
 const NAMES={jellyfin:'Jellyfin',seerr:'Seerr (requests)',tracearr:'Tracearr (live streams)'};

 const SVC={jellyfin:{name:'Jellyfin',required:true,hint:'Jellyfin: Dashboard, API Keys, then +. The address must work from inside the container, so not localhost.',ph:'192.168.1.10:8096',pub:'watch.example.com',pubHint:'Only if members connect from outside your home network, or by a different address. Used for posters, Open in Jellyfin links, the app set-up guide and request-ready emails. Leave blank to use the address above.'},seerr:{name:'Seerr (requests)',hint:'Seerr: Settings, General, API Key.',ph:'192.168.1.10:5055',pub:'requests.example.com',pubHint:'Only if members use a different address. Used for the Open Seerr buttons. Leave blank to use the address above.'},tracearr:{name:'Tracearr (live streams)',hint:'Tracearr: Settings, API token.',ph:'192.168.1.10:1912'}};
 function fieldRow(...wraps){const r=el('div',null,'field-row');r.append(...wraps);return r;}
 function chip(text,state){const c=el('span',text,'connection-status');c.dataset.state=state;c.setAttribute('role','status');return c;}
 function renderConnections(box,L){
  box.replaceChildren();$('#settings-connections .settings-note')?.setAttribute('hidden','');{const p=$('#settings-connections .section-heading p');if(p)p.textContent='Where Jellypass finds Jellyfin, Seerr and Tracearr, and the keys it uses. Every change is tested before it is saved.';}
  const grid=el('div',null,'sh-grid');
  for(const [svc,meta] of Object.entries(SVC)){
   const c=L.connections[svc],set=!!c.url;
   const sec=el('section',null,'card pad stack connection-card');const head=el('div',null,'top');head.append(el('h3',meta.name));
   const st=chip(set?'Checking…':'Not set up',set?'checking':'off');head.append(st);sec.append(head);
   const url=input('Address','url',c.url);url.field.placeholder=meta.ph;url.field.autocomplete='off';url.field.spellcheck=false;
   const key=input('API key','password');key.field.autocomplete='off';key.field.spellcheck=false;key.field.maxLength=500;key.field.placeholder=c.keySet?'Saved. Leave blank to keep it.':'';
   const hint=el('small',meta.hint,'muted');
   const pub=meta.pub?input('Address members use (optional)','url',c.publicUrl||''):null;let pubHint=null;if(pub){pub.field.placeholder=meta.pub;pub.field.autocomplete='off';pub.field.spellcheck=false;pubHint=el('small',meta.pubHint,'muted');}
   const anyway=el('label','Save even if it cannot be reached right now','check-label');const ck=el('input');ck.type='checkbox';anyway.prepend(ck);anyway.hidden=true;
   sec.append(url.wrap,key.wrap,hint,...(pub?[pub.wrap,pubHint]:[]),anyway);
   const btns=[button(set?'Check and save':'Connect',async()=>{const body={};const u=url.field.value.trim(),k=key.field.value.trim();if(!u)throw new Error('Enter the address.');if(u!==c.url)body.url=u;if(k)body.key=k;if(pub){const p=pub.field.value.trim();if(p!==(c.publicUrl||''))body.publicUrl=p;}if(!c.keySet&&!k)throw new Error('Enter the API key.');if(!Object.keys(body).length)throw new Error('Nothing has changed.');body.force=ck.checked;try{await write('/api/admin/selfhost/connection/'+svc,body,'PUT');}catch(e){if(!meta.required&&e.status===422&&/Could not reach/.test(e.message))anyway.hidden=false;throw e;}say(meta.name+' saved.');await refreshLocal();})];
   if(set)btns.push(button('Test',async()=>{st.textContent='Checking…';st.dataset.state='checking';await probe(svc,st);}));
   if(set&&!meta.required)btns.push(button('Remove',async()=>{if(!await confirmAction('Remove '+meta.name+'? Jellypass stops using it until you add it again.'))return;await write('/api/admin/selfhost/connection/'+svc,{},'DELETE');say(meta.name+' removed.');await refreshLocal();},true));
   const a=actions(...btns);a.firstElementChild.classList.add('pri');sec.append(a);grid.append(sec);
   if(set&&c.keySet)probe(svc,st);else if(set){st.textContent='No key';st.dataset.state='bad';}
  }
  box.append(grid);
 }
 async function probe(svc,st){try{const r=await write('/api/admin/integrations/'+encodeURIComponent(svc)+'/test');st.textContent=r.ok?'Working':'Not working';st.dataset.state=r.ok?'ok':'bad';if(!r.ok&&r.error)st.title=r.error;}catch(e){st.textContent='Not working';st.dataset.state='bad';}}
 async function keys(){const L=await localP;const box=$('#keys-list');if(L){renderConnections(box,L);return;}const data=await read('/api/admin/keys');box.replaceChildren();
  if(!data.canStore)box.append(el('p','Changing keys here needs the KEYS_SECRET Worker secret, which is not set yet. Keys from the Worker secrets still work.','muted'));
  for(const g of [...new Set(data.keys.map(k=>k.integration))]){
   const sec=el('section',null,'card pad stack connection-card');const head=el('div',null,'top');head.append(el('h3',NAMES[g]||g));
   const result=el('span','Not tested','connection-status');result.setAttribute('role','status');
   const test=button('Test connection',async()=>{result.textContent='Checking…';result.dataset.state='checking';try{const r=await write('/api/admin/integrations/'+encodeURIComponent(g)+'/test');result.textContent=r.ok?'Working':'Not working'+(r.error?' ('+r.error+')':'');result.dataset.state=r.ok?'ok':'bad';}catch(e){result.textContent='Could not test';result.dataset.state='bad';throw e;}});
   const checks=actions(result,test);checks.classList.add('connection-checks');head.append(checks);sec.append(head);
   for(const k of data.keys.filter(x=>x.integration===g)){
    const row=el('details',null,'key-editor');row.append(el('summary',k.label));
    row.append(el('p',(k.source==='stored'?'Set here':k.source==='worker'?'From the Worker secrets':'Not set')+(k.updatedAt?' · '+new Date(k.updatedAt).toLocaleString('en-GB')+' by '+k.updatedBy:''),'muted'));
    if(data.canStore){
     const f=input('New value','password');f.field.autocomplete='off';f.field.spellcheck=false;f.field.maxLength=500;const hint=el('small','Checked before saving. The saved key is never shown again.');hint.id='key-help-'+k.name;f.field.setAttribute('aria-describedby',hint.id);f.wrap.append(hint);
     const anyway=el('label','Save even if the service cannot be reached right now','check-label');const box2=el('input');box2.type='checkbox';anyway.prepend(box2);
     if(k.name==='jellyfin_admin_key')anyway.hidden=true;
     row.append(f.wrap,anyway,actions(button('Check and save',async()=>{const v=f.field.value.trim();if(!v)throw new Error('Paste the new key first.');await write('/api/admin/keys/'+encodeURIComponent(k.name),{value:v,force:box2.checked},'PUT');f.field.value='';await keys();}),
      ...(k.source==='stored'?[button('Remove the one set here',async()=>{if(!await confirmAction('Remove the key set here? Jellypass will go back to the Worker secret, if there is one.'))return;await write('/api/admin/keys/'+encodeURIComponent(k.name),{}, 'DELETE');await keys();},true)]:[])));
    }
    const save=row.querySelector('.actions .btn:not(.danger)');if(save)save.classList.add('pri');sec.append(row);
   }
   box.append(sec);
  }
 }
 region('#keys-list',keys);
 const PRESETS={gmail:['smtp.gmail.com',587,false,'Gmail (needs an app password)'],outlook:['smtp.office365.com',587,false,'Outlook / Microsoft 365'],brevo:['smtp-relay.brevo.com',587,false,'Brevo'],mailgun:['smtp.mailgun.org',587,false,'Mailgun'],resend:['smtp.resend.com',465,true,'Resend']};
 function steps(title,items,open){const d=el('details',null,'key-editor guide');if(open)d.open=true;d.append(el('summary',title));const ol=el('ol',null,'guide-steps');items.forEach(t=>{const li=el('li',t);ol.append(li);});d.append(ol);return d;}
 function check(label,checked){const l=el('label',label,'check-label');const b=el('input');b.type='checkbox';b.checked=checked;l.prepend(b);return {wrap:l,box:b};}
 async function selfhost(){
  const d=await localP;if(!d)return; /* Cloudflare: the tab stays hidden */
  const tab=$('#settings-tab-selfhost');
  if(tab.hidden){tab.hidden=false;$('#settings-tab-connections').after(tab);$('#settings-connections').after($('#settings-selfhost'));tabs.splice(0,tabs.length,...document.querySelectorAll('.settings-tabs [role="tab"]'));if(location.hash==='#settings-selfhost')showSection('settings-selfhost');}
  const box=$('#selfhost-box');box.replaceChildren();const grid=el('div',null,'sh-grid');box.append(grid);


  const notesBox=text=>{const box=el('div',null,'changelog-body');let ul=null;for(const line of String(text).split('\n')){const l=line.trimEnd();if(!l.trim()){ul=null;continue;}let m=/^#{1,4}\s+(.*)/.exec(l);if(m){ul=null;box.append(el('h5',m[1].replace(/[\x60*]/g,'')));continue;}m=/^\s*[-*]\s+(.*)/.exec(l);if(m){if(!ul){ul=el('ul');box.append(ul);}ul.append(el('li',m[1].replace(/[\x60*]/g,'')));continue;}ul=null;box.append(el('p',l.replace(/[\x60*]/g,'')));}return box;};
  // About and updates
  let ab=null;try{ab=await read('/api/admin/selfhost/about');}catch(e){}
  if(ab){
   const as=el('section',null,'card pad stack connection-card');const ah=el('div',null,'top');ah.append(el('h3','About and updates'));
   const ac=chip(ab.updateAvailable?'Update available':'Version '+ab.version,ab.updateAvailable?'checking':'ok');ah.append(ac);as.append(ah);
   if(ab.updateAvailable){
    as.append(el('p','Version '+ab.latest.version+' is available. You are running '+ab.version+'.','update-line'));
    if(ab.latest.notes){as.append(notesBox(ab.latest.notes));}
    as.append(steps('How to update',['In Portainer, open the stack and choose Pull and redeploy. With Docker Compose, run docker compose pull, then docker compose up -d.','Your settings and data live in the volume, so they are kept. Database updates apply automatically when the new version starts.','Full release notes: '+ab.repo+' on GitHub, under Releases.'],true));
   }else{
    as.append(el('p',ab.latest?'You are running the latest version ('+ab.version+').':'You are running version '+ab.version+'. No release has been published to compare with yet.','muted'));
   }
   if(ab.error)as.append(el('p',ab.error+' Updates are checked once a day; try again later.','muted'));
   const when=ab.checkedAt?'Last checked '+new Date(ab.checkedAt).toLocaleString('en-GB')+'.':'Not checked yet.';
   const uc=check('Check for updates once a day',ab.updateCheck);
   uc.box.addEventListener('change',()=>run(async()=>{await write('/api/admin/selfhost',{updateCheck:uc.box.checked},'PUT');say(uc.box.checked?'Update checks turned on.':'Update checks turned off.');await refreshLocal();},uc.box));
   as.append(uc.wrap,el('small','This asks GitHub for the newest release number. Nothing about your server or members is sent. '+when,'muted'));
   as.append(actions(button('Check now',async()=>{await write('/api/admin/selfhost/about/check');say('Checked for updates.');await refreshLocal();})));
   if(ab.changelog.length){
    const ch=el('div',null,'stack changelog');ch.append(el('h4','What changed'));
    ab.changelog.forEach((c,i)=>{const d=el('details',null,'key-editor');if(i===0)d.open=true;d.append(el('summary','Version '+c.version+(c.date?' · '+c.date:'')));d.append(notesBox(c.body));ch.append(d);});
    as.append(ch);
   }
   grid.append(as);
  }
  // Address and HTTPS
  const nw=d.network,ns=el('section',null,'card pad stack connection-card');const nh=el('div',null,'top');nh.append(el('h3','Address and HTTPS'));
  const hst=chip(nw.https?'HTTPS on':'HTTP only',nw.https?'ok':'off');nh.append(hst);ns.append(nh);
  ns.append(el('p','The address members use, and how this server provides HTTPS. Changes apply straight away without restarting the container.','muted'));
  ns.append(steps('Using a Cloudflare Tunnel or a reverse proxy',['Leave HTTPS off here: the tunnel or proxy provides it. Point it at this container (port '+nw.port+') over plain HTTP.','Set the Public address below to the https address members will open, for example jellypass.example.com.','Tick Trust the proxy so each member’s real IP is used for rate limits and sign-in locations. Only tick it when the proxy is the only way in, otherwise anyone could fake their IP.','If the proxy or tunnel talks to this container over HTTPS using the self-signed certificate, tell it to skip certificate checks.'],false));
  const pub=input('Public address','text',nw.publicUrl);pub.field.autocomplete='off';pub.field.spellcheck=false;
  const mode=select('HTTPS on this server',[{id:'',name:'Off: plain HTTP (a proxy or tunnel provides HTTPS)'},{id:'self-signed',name:'Self-signed certificate (made for you)'},{id:'custom',name:'My own certificate'}],nw.tlsMode);
  const hosts=input('Extra names or IP addresses for the certificate','text',nw.tlsHosts);hosts.field.placeholder='192.168.1.10, jellypass.lan';hosts.field.autocomplete='off';hosts.field.spellcheck=false;
  const hostsHint=el('small','The Public address and this server’s own addresses are included automatically. Add the LAN address or names you browse to.','muted');hosts.wrap.append(hostsHint);
  const certBox=el('div',null,'stack');
  const ct=el('label','Certificate (PEM text)');const cta=el('textarea',null,'field');cta.rows=5;cta.spellcheck=false;cta.autocomplete='off';cta.placeholder='-----BEGIN CERTIFICATE-----';ct.append(cta);
  const kt=el('label','Private key (PEM text)');const kta=el('textarea',null,'field');kta.rows=5;kta.spellcheck=false;kta.autocomplete='off';kta.placeholder=nw.tlsMode==='custom'&&nw.cert?'Saved. Leave both boxes empty to keep it.':'-----BEGIN PRIVATE KEY-----';kt.append(kta);
  certBox.append(ct,kt,el('small','The key is checked against the certificate, saved on this server only and never shown again. It must not be password protected.','muted'));
  const tp=check('Trust the proxy for client IP addresses',nw.trustProxy);
  const cur=el('p','','muted');
  if(nw.cert){const days=Math.round((Date.parse(nw.cert.validTo)-Date.now())/86400000);cur.textContent='Serving '+(nw.cert.selfSigned?'a self-signed':'a')+' certificate for '+(nw.cert.names||nw.cert.subject)+'. Expires '+new Date(nw.cert.validTo).toLocaleDateString('en-GB')+' ('+days+' days).';}
  const showFor=()=>{hosts.wrap.hidden=mode.field.value!=='self-signed';certBox.hidden=mode.field.value!=='custom';};
  mode.field.addEventListener('change',()=>{showFor();/* keep the address's scheme in step when browsing this server directly; still editable */const v=pub.field.value.trim();try{const u=new URL(v);if(u.hostname===location.hostname){if(mode.field.value&&u.protocol==='http:'){u.protocol='https:';pub.field.value=u.origin;}else if(!mode.field.value&&u.protocol==='https:'){u.protocol='http:';pub.field.value=u.origin;}}}catch{}});showFor();
  ns.append(pub.wrap,mode.wrap,hosts.wrap,certBox,tp.wrap);if(nw.cert)ns.append(cur);
  const dl=button('Download certificate',async()=>{const r=await fetch('/api/admin/selfhost/certificate',{credentials:'same-origin'});if(!r.ok)throw new Error('There is no certificate to download.');const b=await r.blob();const a=el('a');a.href=URL.createObjectURL(b);a.download='jellypass.crt';document.body.append(a);a.click();a.remove();URL.revokeObjectURL(a.href);});
  const nres=el('p','','test-result');nres.setAttribute('role','status');
  ns.append(actions(button('Apply',async()=>{
   const body={publicUrl:pub.field.value.trim(),tlsMode:mode.field.value,trustProxy:tp.box.checked};
   if(!body.publicUrl)throw new Error('Enter the public address.');
   if(body.tlsMode==='self-signed')body.tlsHosts=hosts.field.value.trim();
   if(body.tlsMode==='custom'&&(cta.value.trim()||kta.value.trim())){body.cert=cta.value.trim();body.key=kta.value.trim();}
   const r=await write('/api/admin/selfhost',{network:body},'PUT');
   cta.value='';kta.value='';
   const after=r.network;nres.dataset.state='ok';
   if(after.https!==(location.protocol==='https:')){const next=(after.https?'https:':'http:')+'//'+location.host+location.pathname+location.hash;nres.textContent='Applied. This page is now at '+next+(after.https&&after.cert&&after.cert.selfSigned?' and your browser will warn about the certificate once.':'')+' Opening it in a moment…';setTimeout(()=>{location.href=next;},3500);}
   else{nres.textContent='Applied.';await refreshLocal();}
  }),...(nw.https?[dl]:[])));
  ns.append(nres);ns.querySelector('.actions .btn').classList.add('pri');grid.append(ns);
  // Turnstile
  const ts=el('section',null,'card pad stack connection-card');const th=el('div',null,'top');th.append(el('h3','Sign-in challenge (Cloudflare Turnstile)'));
  const on=d.turnstile.siteKey&&d.turnstile.secretSet;const st=el('span',on?'On':'Off','connection-status');st.dataset.state=on?'ok':'checking';th.append(st);ts.append(th);
  ts.append(el('p','Stops bots guessing passwords on the sign-in, invite and reset pages. It is free, works on any website and your site does not need to be on Cloudflare. When it is on, members’ browsers load a small script from challenges.cloudflare.com.','muted'));
  ts.append(steps('Quick setup',['Sign in at dash.cloudflare.com (a free account is needed), open Turnstile in the left menu and choose Add widget.','Name it Jellypass. Under Hostname add the address members use, written without the https part, for example jellypass.example.com. Turnstile will not work on a bare IP address, so use your domain.','Choose the Managed widget mode, then Create.','Copy the Site Key and the Secret Key into the boxes below and press Check and save. The secret is checked with Cloudflare and kept on this server only.'],!on));
  const sk=input('Site key','text',d.turnstile.siteKey);sk.field.autocomplete='off';sk.field.spellcheck=false;
  const sec=input('Secret key','password');sec.field.autocomplete='off';sec.field.spellcheck=false;sec.field.placeholder=d.turnstile.secretSet?'Saved. Leave blank to keep it.':'';
  ts.append(sk.wrap,sec.wrap,actions(button('Check and save',async()=>{const body={siteKey:sk.field.value.trim()};if(sec.field.value.trim())body.secret=sec.field.value.trim();if(!body.siteKey)throw new Error('Paste the site key first.');if(!body.secret&&!d.turnstile.secretSet)throw new Error('Paste the secret key too.');await write('/api/admin/selfhost',{turnstile:body},'PUT');say('Sign-in challenge saved.');await refreshLocal();}),...(on?[button('Turn off',async()=>{if(!await confirmAction('Turn off the sign-in challenge? Anyone can then try passwords without being checked.'))return;await write('/api/admin/selfhost',{turnstile:{siteKey:'',secret:null}},'PUT');say('Sign-in challenge turned off.');await refreshLocal();},true)]:[])));
  ts.querySelector('.actions .btn:not(.danger)').classList.add('pri');grid.append(ts);
  // SMTP
  const m=d.smtp,ms=el('section',null,'card pad stack connection-card');const mh=el('div',null,'top');mh.append(el('h3','Email (SMTP)'));
  const emailOnNow=d.emailEnabled&&!!m.host;const mst=el('span',emailOnNow?'On':(m.host?'Switched off':'Off: not set up'),'connection-status');mst.dataset.state=emailOnNow?'ok':'off';mh.append(mst);ms.append(mh);
  ms.append(el('p','Used for password resets, email verification, sign-in links and notices. Email is optional: with it off, those screens are hidden and nothing is sent. Invites still work by copying the link.','muted'));const use=check('Send email from this server',d.emailEnabled);use.box.addEventListener('change',()=>run(async()=>{await write('/api/admin/selfhost',{emailEnabled:use.box.checked},'PUT');say(use.box.checked?'Email turned on.':'Email turned off.');await refreshLocal();},use.box));ms.append(use.wrap);if(d.emailEnabled&&!m.host)ms.append(el('p','Email stays off until you add the mail server details below.','muted'));
  ms.append(steps('Quick setup',['Pick your provider below, or copy the server name, port and login from your email provider’s SMTP settings.','Port 587 uses STARTTLS: leave SSL off. Port 465 uses SSL: tick it.','Gmail and Outlook need an app password (turn on 2-step verification first), not your normal password.','The From address must be one your provider lets you send as.','Press Save, then send yourself a test email.'],!m.host));
  const pre=select('Provider',[{id:'',name:'Custom'},...Object.entries(PRESETS).map(([k,v])=>({id:k,name:v[3]}))],'');
  const host=input('Mail server','text',m.host),port=input('Port','number',m.port||587),ssl=check('Use SSL (port 465)',m.secure),user=input('Username','text',m.user),pass=input('Password','password'),from=input('From address','text',m.from);
  [host.field,user.field,pass.field,from.field].forEach(f=>{f.autocomplete='off';f.spellcheck=false;});pass.field.placeholder=m.passSet?'Saved. Leave blank to keep it.':'';port.field.min=1;port.field.max=65535;
  pre.field.addEventListener('change',()=>{const p=PRESETS[pre.field.value];if(!p)return;host.field.value=p[0];port.field.value=p[1];ssl.box.checked=p[2];});
  ms.append(pre.wrap,fieldRow(host.wrap,port.wrap),ssl.wrap,fieldRow(user.wrap,pass.wrap),from.wrap);
  ms.append(actions(button('Save email settings',async()=>{const body={host:host.field.value.trim(),port:Number(port.field.value),secure:ssl.box.checked,user:user.field.value.trim(),from:from.field.value.trim()};if(pass.field.value)body.pass=pass.field.value;await write('/api/admin/selfhost',{smtp:body},'PUT');say('Email settings saved.');await refreshLocal();}),...(m.passSet?[button('Remove saved password',async()=>{if(!await confirmAction('Remove the saved email password?'))return;await write('/api/admin/selfhost',{smtp:{pass:null}},'PUT');await refreshLocal();},true)]:[])));
  ms.querySelector('.actions .btn:not(.danger)').classList.add('pri');
  const to=input('Send a test email to','email','');to.field.autocomplete='email';const res=el('p','','test-result');res.setAttribute('role','status');
  ms.append(to.wrap,actions(button('Send test email',async()=>{res.textContent='Sending…';res.dataset.state='checking';try{await write('/api/admin/selfhost/test-email',{to:to.field.value.trim()});res.textContent='Sent. Check the inbox.';res.dataset.state='ok';}catch(e){res.textContent=e.message;res.dataset.state='bad';}})));ms.append(res);
  grid.append(ms);
 }
 region('#selfhost-box',selfhost);

 const presetForm=$('#preset-form');
 function libraryState(){$('#preset-libraries').disabled=$('#preset-all').checked;}
 $('#preset-all').addEventListener('change',libraryState);
 async function edit(p){if(!libraries.length)libraries=await read('/api/admin/libraries');editing=p?.id??null;presetForm.hidden=false;$('#preset-new').setAttribute('aria-expanded','true');$('#preset-heading').textContent=p?'Edit '+p.name:'New access level';$('#preset-name').value=p?.name||'';$('#preset-all').checked=!p||p.libraries==='all';$('#preset-bitrate').value=Number(p?.bitrateLimit||0)/1000000;$('#preset-remote').checked=p?.remoteAccess??true;$('#preset-rights').value=p?.requestRights||'request';$('#preset-days').value=p?.membershipDays??'';const box=$('#preset-libraries');box.replaceChildren(el('legend','Choose libraries'));libraries.forEach(l=>{const label=el('label'),check=el('input');check.type='checkbox';check.value=l.id;check.checked=Array.isArray(p?.libraries)&&p.libraries.includes(l.id);label.append(check,document.createTextNode(' '+l.name));box.append(label);});libraryState();$('#preset-name').focus();}
 async function load(){presets=await read('/api/admin/presets');$('#presets-list').replaceChildren(...presets.map(p=>{const row=el('article',null,'card pad preset-row');const summary=el('div',null,'preset-summary');summary.append(el('h3',p.name),el('p',grants(p),'muted'));row.append(summary,actions(button('Edit',()=>edit(p)),button('Clone',async()=>{const clone=await write(path('/api/admin/presets',p.id,'/clone'));await load();await edit(clone);say('Access level cloned.');}),button('Apply to members',async()=>{if(await confirmAction('Apply '+p.name+' to all existing members on this level? This changes their library access, streaming limits and request rights.')){const r=await write(path('/api/admin/presets',p.id,'/apply'));say('Applied to '+Number(r.applied)+' members.');}}),button('Delete',async()=>{if(await confirmAction('Delete '+p.name+'?')){try{await write(path('/api/admin/presets',p.id),{},'DELETE');if(editing===p.id){presetForm.hidden=true;$('#preset-new').setAttribute('aria-expanded','false');}await load();say('Access level deleted.');}catch(e){if(e.status===409)throw new Error('This access level is in use. '+e.message);throw e;}}},true)));return row;}));if(!presets.length)$('#presets-list').append(el('p','No access levels yet. Create one to get started.'));}
 $('#preset-new').addEventListener('click',e=>run(()=>edit(null),e.currentTarget));$('#preset-cancel').addEventListener('click',()=>{presetForm.hidden=true;$('#preset-new').setAttribute('aria-expanded','false');$('#preset-new').focus();});
 form('#preset-form',async()=>{const md=$('#preset-days').value;const data={name:$('#preset-name').value,libraries:$('#preset-all').checked?'all':[...$('#preset-libraries').querySelectorAll('input:checked')].map(x=>x.value),bitrateLimit:Math.round(Number($('#preset-bitrate').value)*1000000),remoteAccess:$('#preset-remote').checked,requestRights:$('#preset-rights').value,membershipDays:md===''?null:number($('#preset-days'),1,365000)};await write(editing?path('/api/admin/presets',editing):'/api/admin/presets',data,editing?'PUT':'POST');presetForm.hidden=true;$('#preset-new').setAttribute('aria-expanded','false');await load();$('#preset-new').focus();say('Access level saved. Existing members are unchanged until you apply it.');});
 region('#presets-list',load);
 $('#outage-email').disabled=true;run(async()=>{const s=await read('/api/admin/settings');$('#outage-email').checked=s.outageEmail;$('#outage-email').disabled=false;});
 async function loadNotices(){const rows=await read('/api/admin/notices');$('#notice-list').replaceChildren(...rows.map(r=>{const row=el('div',null,'row');const t=el('div',null,'grow');t.append(el('b',r.title),el('p',r.body+(r.pushed?' · pushed to '+r.pushed+(r.pushed===1?' member':' members'):''),'muted'));row.append(t,button('Remove',async()=>{if(!await confirmAction('Remove this notice from members\' bells?'))return;await write('/api/admin/notices/'+encodeURIComponent(r.id),{},'DELETE');await loadNotices();say('Notice removed.');},true));return row;}));}
 run(loadNotices);
 form('#notice-form',async()=>{const r=await write('/api/admin/notices',{title:$('#notice-title').value,body:$('#notice-body').value,link:$('#notice-link').value,push:$('#notice-push').checked});$('#notice-title').value='';$('#notice-body').value='';$('#notice-link').value='';say($('#notice-push').checked?'Notice sent. Pushed to '+r.members+(r.members===1?' member':' members')+' ('+r.devices+' devices).':'Notice added to members\' bells.');await loadNotices();});
 run(async()=>{$('#digest-email').value=(await read('/api/admin/digest')).email;});
 form('#digest-form',async()=>{await write('/api/admin/digest',{email:$('#digest-email').value},'PUT');say($('#digest-email').value.trim()?'Daily digest on.':'Daily digest off.');});
 const pad2=n=>String(n).padStart(2,'0');
 const toLocal=iso=>{if(!iso)return '';const d=new Date(iso);return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())+'T'+pad2(d.getHours())+':'+pad2(d.getMinutes());};
 const fromLocal=v=>v?new Date(v).toISOString():null;
 const fmtWhen=iso=>new Date(iso).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 function maintPill(m){const pill=$('#maint-state');let t='Off',s='off';if(m.enabled){t='On now';s='on';}else if(m.active){t='On (scheduled window)';s='on';}else if(m.startsAt&&Date.parse(m.startsAt)>Date.now()){t='Scheduled for '+fmtWhen(m.startsAt);s='sched';}pill.textContent=t;pill.dataset.state=s;}
 async function maintLoad(){const m=await read('/api/admin/maintenance');$('#maint-on').checked=m.enabled;$('#maint-message').value=m.message;$('#maint-start').value=toLocal(m.startsAt);$('#maint-end').value=toLocal(m.endsAt);maintPill(m);}
 $('#maint-on').disabled=true;run(async()=>{try{await maintLoad();}finally{$('#maint-on').disabled=false;}});
 async function maintSave(field,done){$('#maint-error').textContent='';await run(async()=>{try{await write('/api/admin/maintenance',{enabled:$('#maint-on').checked,message:$('#maint-message').value,startsAt:fromLocal($('#maint-start').value),endsAt:fromLocal($('#maint-end').value)},'PUT');await maintLoad();say(done());}catch(e){$('#maint-error').textContent=e.message;await maintLoad().catch(()=>{});throw e;}},field);}
 $('#maint-on').addEventListener('change',e=>{const f=e.currentTarget;if(f.checked){f.checked=false;$('#maint-confirm').hidden=false;$('#maint-confirm-yes').focus();return;}$('#maint-confirm').hidden=true;maintSave(f,()=>'Maintenance mode is off.');});
 $('#maint-confirm-no').addEventListener('click',()=>{$('#maint-confirm').hidden=true;$('#maint-on').focus();});
 $('#maint-confirm-yes').addEventListener('click',async e=>{const f=$('#maint-on');f.checked=true;$('#maint-confirm').hidden=true;await maintSave(e.currentTarget,()=>'Maintenance mode is on. Members now see the maintenance page.');});
 $('#maint-save').addEventListener('click',e=>maintSave(e.currentTarget,()=>'Maintenance settings saved.'));
 $('#maint-clear').addEventListener('click',e=>{$('#maint-start').value='';$('#maint-end').value='';maintSave(e.currentTarget,()=>'Schedule cleared.');});
 $('#outage-email').addEventListener('change',e=>{const field=e.currentTarget,value=field.checked;run(async()=>{try{await write('/api/admin/settings',{outageEmail:value},'PUT');say(value?'Outage emails on.':'Outage emails off.');}catch(e){field.checked=!value;throw e;}},field);});
 async function messages(){const rows=await read('/api/admin/messages');$('#messages-list').replaceChildren(...rows.map(m=>{const row=el('article',null,'service stack');row.append(el('h3',m.subject),el('p',m.username),date(m.created_at),el('p',m.body));if(m.diagnostics)row.append(jsonDetails(m.diagnostics,'Diagnostics'));row.append(m.resolved?el('p','Resolved','muted'):button('Mark resolved',async()=>{await write(path('/api/admin/messages',m.id,'/resolve'));await messages();say('Message resolved.');}));return row;}));if(!rows.length)$('#messages-list').append(el('p','No help messages.','muted'));}
 region('#messages-list',messages);
 function snapshot(){return JSON.stringify({text:$('#import-json').value,trustEmails:$('#import-trust').checked});}
 function invalidate(){drySnapshot=null;$('#import-real').disabled=true;$('#import-report').textContent='Run a dry run to review this export.';}
 $('#import-json').addEventListener('input',invalidate);$('#import-trust').addEventListener('change',invalidate);
 const count=value=>Array.isArray(value)?value.length:Number(value)||0;
 function report(r){const box=$('#import-report');box.replaceChildren(el('h3',r.dryRun?'Dry-run report — no changes made':'Import complete'),el('p',Number(r.users.matched)+' users matched; '+count(r.users.unmatched)+' unmatched; '+count(r.users.skippedAdmins)+' admins skipped.'),el('p',Number(r.invites.imported)+(r.dryRun?' invites would be imported; ':' invites imported; ')+Number(r.invites.alreadyImported)+' already imported; '+count(r.invites.skipped)+' skipped.'));if(Array.isArray(r.users.unmatched)&&r.users.unmatched.length)box.append(el('p','Unmatched users: '+r.users.unmatched.join(', ')));if(Array.isArray(r.users.skippedAdmins)&&r.users.skippedAdmins.length)box.append(el('p','Admins skipped: '+r.users.skippedAdmins.join(', ')));if(Array.isArray(r.invites.skipped))r.invites.skipped.forEach(i=>box.append(el('p','Invite '+i.code+': '+i.reason)));}
 async function migrate(dryRun){let exp;try{exp=JSON.parse($('#import-json').value);}catch{throw new Error('Enter valid export JSON.');}const start=snapshot();const r=await write('/api/admin/migrate/jfa-go',{export:exp,dryRun,trustEmails:$('#import-trust').checked});report(r);drySnapshot=dryRun&&start===snapshot()?start:null;$('#import-real').disabled=!drySnapshot;}
 form('#import-form',()=>migrate(true));
 $('#import-real').addEventListener('click',async()=>{const b=$('#import-real');if(b.disabled)return;await run(async()=>{if(!drySnapshot||drySnapshot!==snapshot())throw new Error('Run a dry run for this export first.');if(await confirmAction('Import these users and invites for real? Review the dry-run report above before continuing.'))await migrate(false);},b);b.disabled=!drySnapshot;});
}
run(async()=>{const m=await read('/api/admin/maintenance');if(!m.active)return;const b=el('div',null,'banner maint-banner');b.setAttribute('role','status');b.append(el('b','Maintenance mode is on. '),el('span','Members see the maintenance page; only admins can use Jellypass right now. '));const a=el('a','Change it in Settings');a.href='/admin/settings#settings-notifications';b.append(a);const host=$('.page-content');if(host)host.before(b);});

if(page==='security') {
 const root=$('#security-root'),loading=$('#security-loading'),failure=$('#security-error'),notice=$('#security-notice');
 let data=null,users=[],usersAvailable=false,filter='all',busy=false,me=null;
 const sessionRows=new Map(),ranks={bad:0,warn:1,info:2,ok:3},labels={ok:'OK',warn:'Review',bad:'Action needed',info:'Information'};
 const eventLabels={
  'signin.not_me':"Member reported a sign-in that wasn't them",'password.change':'Password changed','password.reset':'Password reset',
  'key.set':'API key changed','key.remove':'API key removed','settings.update':'Settings updated','settings.maintenance':'Maintenance settings changed',
  'user.delete':'User deleted','user.preset':'Access level changed','account.sign_out_devices':'Member signed out their devices','account.sign_out_others':'Member signed out other sessions',
  'security.revoke_session':'Portal session ended','security.sign_out_all':'Everyone signed out (current admin session kept)',
  'security.sign_out_user':'All sessions for a user ended','security.clear_lockout':'Sign-in lockout cleared',
  'user.indefinite':'Membership given no end date','user.end_date':'Membership end date set','user.reset_2fa':'Two-step sign-in reset for a user','invite.create':'Invite created','invite.revoke':'Invite revoked','migrate.jfa_go':'Accounts imported from jfa-go','expiry.failed':'Membership expiry failed'
 };
 function stamp(value,relative=false) {
  const d=value?new Date(value):null;
  if(!d||!Number.isFinite(+d))return el('span','Unknown','muted');
  let text=d.toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  if(relative){const seconds=Math.round((+d-Date.now())/1000),abs=Math.abs(seconds);const unit=abs<60?'second':abs<3600?'minute':abs<86400?'hour':'day';const divisor={second:1,minute:60,hour:3600,day:86400}[unit];text=new Intl.RelativeTimeFormat('en-GB',{numeric:'auto'}).format(Math.round(seconds/divisor),unit);}
  const t=el('time',text);t.dateTime=d.toISOString();t.title=d.toLocaleString('en-GB');if(relative)t.dataset.relative='';return t;
 }
 function pill(text,state='info'){const n=el('span',text,'security-pill');n.dataset.state=state;return n;}
 function empty(text){return el('li',text,'security-empty muted');}
 function list(id,nodes,message){$(id).replaceChildren(...(nodes.length?nodes:[empty(message)]));}
 function announce(text){notice.textContent=text;}
 function setBusy(value){busy=value;root.setAttribute('aria-busy',String(value));$('#security-refresh').disabled=value;root.querySelectorAll('[data-security-mutation]').forEach(b=>{b.disabled=value;});}
 function mutation(text,fn){const b=button(text,fn,true);b.dataset.securityMutation='';b.disabled=busy;return b;}
 function matchUser(s){const matches=users.filter(u=>u.name===s.username&&!!u.isAdmin===!!s.isAdmin);return matches.length===1?matches[0]:null;}
 function renderSessions(){
  const visible=data.sessions.filter(s=>filter==='all'||(filter==='admins'?s.isAdmin:!s.isAdmin)),host=$('#security-sessions');
  const currentName=me?.user.name||data.sessions.find(s=>s.current)?.username;
  $('#security-session-count').textContent=visible.length+' '+(visible.length===1?'session':'sessions')+' shown';
  $('#security-users-note').textContent=usersAvailable?'':'User details are unavailable. Refresh to retry per-user sign-out controls.';
  const keep=new Set(visible.map(s=>s.id));
  for(const [id,entry] of sessionRows){if(!keep.has(id)){entry.node.remove();sessionRows.delete(id);}}
  host.querySelectorAll('.security-empty').forEach(n=>n.remove());
  visible.forEach((s,index)=>{
   const user=matchUser(s),signature=JSON.stringify([s,user?.id,currentName]);
   let entry=sessionRows.get(s.id);
   if(!entry||entry.signature!==signature){
    const row=el('li',null,'security-session'),identity=el('div',null,'security-identity'),names=el('div'),name=el('div',null,'security-name');
    name.append(el('strong',s.username));if(s.isAdmin)name.append(pill('Admin'));if(s.current)name.append(pill('This session','ok'));
    names.append(name,el('p',s.label||'Unknown device','muted'),el('p',s.city||'Location unknown','muted'));
    identity.append(avatar(user?.id,s.username),names);
    const dates=el('dl',null,'security-dates');
    [['Signed in',s.createdAt,false],['Last active',s.lastActive,true],['Expires',s.expiresAt,false]].forEach(([label,value,relative])=>{const pair=el('div'),dd=el('dd');dd.append(stamp(value,relative));pair.append(el('dt',label),dd);dates.append(pair);});
    const controls=el('div',null,'actions security-session-actions');
    if(!s.current){const end=mutation('End session',()=>change('End this portal session for '+s.username+'?',path('/api/admin/security/sessions',s.id,'/revoke'),{},()=>{data.sessions=data.sessions.filter(x=>x.id!==s.id);},()=> 'Session ended.','#security-sessions-heading'));end.setAttribute('aria-label','End session for '+s.username+' on '+s.label);controls.append(end);}
    if(s.username!==currentName&&user){const all=mutation("Sign out all of this user's sessions",()=>change('End all portal sessions for '+s.username+'?',path('/api/admin/security/users',user.id,'/sign-out'),{},()=>{data.sessions=data.sessions.filter(x=>x.username!==s.username);},r=>countEnded(r)+' for '+s.username+'.','#security-sessions-heading'));controls.append(all);}
    if(!s.isAdmin&&s.username!==currentName&&user){const dis=mutation('Disable account',()=>change('Disable '+s.username+'? They are signed out of everything and cannot sign in until you enable the account again on the Users page.',path('/api/admin/users',user.id,'/disable'),{},()=>{data.sessions=data.sessions.filter(x=>x.username!==s.username);},()=>s.username+' disabled.','#security-sessions-heading'));dis.classList.add('danger');dis.setAttribute('aria-label','Disable the account of '+s.username);controls.append(dis);}
    else controls.append(el('p',s.username===currentName?'Use the account menu to sign yourself out.':'User could not be matched. You can still end individual sessions.','muted'));
    row.append(identity,dates,controls);
    if(entry)entry.node.replaceWith(row);
    entry={node:row,signature};sessionRows.set(s.id,entry);
   }else{entry.node.querySelectorAll('time[data-relative]').forEach(t=>t.replaceWith(stamp(s.lastActive,true)));}
   if(host.children[index]!==entry.node)host.insertBefore(entry.node,host.children[index]||null);
  });
  if(!visible.length)host.append(empty(filter==='all'?'No active portal sessions.':'No '+(filter==='admins'?'admin':'member')+' sessions.'));
 }
 function renderLockouts(){list('#security-lockouts',data.lockouts.map(l=>{const row=el('li',null,'security-control'),copy=el('div'),line=el('div',null,'security-name'),until=el('p',null,'muted');line.append(pill(l.kind==='ip'?'IP address':'Username','warn'),el('strong',l.subject));until.append(l.attempts+' failed attempts · Locked until ',stamp(l.until));copy.append(line,until);const clear=mutation('Clear lockout',()=>change('Clear this sign-in lockout? Further sign-in attempts will be allowed.','/api/admin/security/lockouts/clear',{key:l.key},()=>{data.lockouts=data.lockouts.filter(x=>x.key!==l.key);},()=> 'Lockout cleared.','#security-lockouts-heading'));row.append(copy,clear);return row;}),'Nobody is locked out.');}
 function countEnded(r){return Number(r.ended)+' '+(Number(r.ended)===1?'session':'sessions')+' signed out';}
 async function change(message,url,body,update,success,focus){
  if(busy)return;const trigger=document.activeElement;setBusy(true);
  try{
   if(!await confirmAction(message))return;
   const result=await write(url,body);update();renderSessions();renderLockouts();announce(success(result));
   if(focus)$(focus).focus({preventScroll:true});
   await load(true);
  }catch{announce('The action could not be completed. Refresh the overview before trying again.');notice.focus({preventScroll:true});}
  finally{setBusy(false);if(trigger?.isConnected)trigger.focus({preventScroll:true});}
 }
 function render(){
  const review=data.checks.filter(c=>c.status==='warn'||c.status==='bad').length,bad=data.checks.some(c=>c.status==='bad'),state=bad?'bad':review?'warn':'ok';
  $('.security-summary').dataset.state=state;
  $('#security-posture').textContent=bad?'Action needed':review?review+' '+(review===1?'thing':'things')+' to review':'Looks good';
  $('#security-summary-detail').textContent=bad?'Review the urgent checks below.':review?'Review these checks to strengthen account protection.':'No warnings or urgent issues in the current checks.';
  $('#security-environment').textContent=(data.environment==='prod'?'Production':'Beta')+' · Security overview';
  $('#security-checked').textContent='Last checked '+new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  list('#security-checks',data.checks.slice().sort((a,b)=>ranks[a.status]-ranks[b.status]||a.label.localeCompare(b.label,'en-GB')).map(c=>{const row=el('li',null,'security-check'),copy=el('div');row.dataset.state=c.status;copy.append(el('h3',c.label),el('p',c.detail,'muted'));row.append(pill(labels[c.status],c.status),copy);return row;}),'No security checks returned.');
  renderSessions();renderLockouts();
  const adminCheck=data.checks.find(c=>c.id==='admins');
  list('#security-admins',data.admins.map(a=>{const row=el('li',null,'security-account');row.append(avatar(a.id,a.name),el('strong',a.name),pill(a.disabled?'Disabled':'Enabled',a.disabled?'warn':'info'));return row;}),adminCheck?.status==='warn'?'Admin accounts could not be confirmed. Refresh to try again.':'No admin accounts found.');
  const m=data.members;
  $('#security-members').replaceChildren(...[['Verified emails',Math.max(0,m.total-m.noEmail-m.unverified)],['Unverified',m.unverified],['No email',m.noEmail],['Alerts turned off',m.alertsOff],['Total members',m.total]].map(([label,value])=>{const a=el('a',null,'security-stat');a.href='/admin/users';a.append(el('strong',value),el('span',label));a.setAttribute('aria-label',label+': '+value+'. View users');return a;}));
  list('#security-keys',data.keys.map(k=>{const row=el('li',null,'security-key'),meta=el('p',null,'muted');meta.append('Updated ',stamp(k.updatedAt),' · By '+(k.updatedBy||'Unknown'));row.append(el('strong',k.name),meta);return row;}),'No API keys stored in the app. Connections may use Worker secrets.');
  list('#security-events',data.events.map(e=>{const row=el('li'),copy=el('div'),who=el('p',null,'muted');copy.append(el('strong',eventLabels[e.action]||e.action.replace(/[._-]+/g,' ')));who.textContent=(e.actor||'System')+(e.target?' · '+e.target:'');copy.append(who);row.append(stamp(e.at,true),copy);return row;}),'No recent security events.');
 }
 async function load(afterAction=false){
  failure.hidden=true;
  try{
   me=await ready;
   const results=await Promise.allSettled([read('/api/admin/security'),read('/api/admin/maintenance'),read('/api/admin/users')]);
   if(results[0].status!=='fulfilled')throw new Error('Security overview unavailable');
   data=results[0].value;usersAvailable=results[2].status==='fulfilled';users=usersAvailable?results[2].value:[];
   render();
   const maintenance=$('#security-maintenance');
   if(results[1].status==='fulfilled'){const m=results[1].value;maintenance.textContent=m.active?'On · Members cannot use Jellypass.':m.startsAt&&Date.parse(m.startsAt)>Date.now()?'Off · A maintenance window is scheduled.':'Off · Members can use Jellypass.';}
   else maintenance.textContent='State unavailable. Open Settings to check or refresh to retry.';
   root.hidden=false;loading.hidden=true;
  }catch{
   loading.hidden=true;failure.hidden=false;
   failure.replaceChildren(el('h2',data?'Could not refresh security':'Could not load security'),el('p',data?'The information below may be out of date.'+(afterAction?' Your completed action has been kept.':''):'Check your connection and try again.','muted'),button('Try again',refresh));
  }
 }
 async function refresh(){if(busy)return;setBusy(true);try{await load();}finally{setBusy(false);}}
 $('#security-refresh').addEventListener('click',refresh);
 [false,true].forEach(includeAdmins=>{const b=$(includeAdmins?'#security-signout-admins':'#security-signout-members');b.dataset.securityMutation='';b.addEventListener('click',()=>change(includeAdmins?'Sign everyone out, including other admins? Your current portal session will stay signed in.':'Sign all members out? Admin sessions will stay signed in.','/api/admin/security/sign-out-all',{includeAdmins},()=>{data.sessions=data.sessions.filter(s=>s.current||(!includeAdmins&&s.isAdmin));},r=>countEnded(r)+'. Your current session is still signed in.'));});
 $('#security-filters').addEventListener('click',e=>{const b=e.target.closest('[data-security-filter]');if(!b||!data)return;filter=b.dataset.securityFilter;$('#security-filters').querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));renderSessions();});
 refresh();
}
`;
