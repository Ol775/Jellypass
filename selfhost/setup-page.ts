
import { brand } from "../src/views/layout";

/** Only what the wizard adds on top of Jellypass's own stylesheet (/assets/app.css): progress, step transitions, the finish tick. Colours are the app's theme variables. */
const css = `
.auth-anim main.center{padding:clamp(16px,5vh,56px) clamp(12px,4vw,40px)}
.sw-in{width:min(680px,100%);min-width:0}
@media(min-width:1200px){.sw-in{width:min(740px,100%)}}
.sw-in .authcard{width:100%;max-width:none;padding:clamp(22px,4.5vw,52px);gap:0;overflow:hidden;position:relative;border-radius:14px}
.sw-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:clamp(18px,3vh,28px)}
.sw-in .brandline{font-size:clamp(16px,1.6vw,18px)}.sw-no{font-size:13px;color:var(--text3)}
.poster-wall{animation:wallin 1.4s ease both}@keyframes wallin{from{opacity:0}}
.sw-bar{height:5px;background:var(--line);border-radius:5px;overflow:hidden}.sw-bar i{display:block;height:100%;width:0;background:var(--accent);border-radius:5px;transition:width .5s var(--ease)}
.sw-dots{display:flex;justify-content:space-between;gap:8px;margin-top:12px;font-size:13px;color:var(--text3)}.sw-dots b{font-weight:500;transition:color .3s}.sw-dots b.on{color:var(--text)}.sw-dots b.done{color:var(--accent)}
.sw-steps{position:relative;display:flex;flex-direction:column;min-height:clamp(250px,36vh,320px);margin-top:clamp(26px,5vh,44px)}
.step{display:none;flex-direction:column;min-width:0}
.step.on{display:flex;flex:1;animation:in .42s var(--ease) both}.step.back.on{animation-name:inback}
.step.out{display:flex;position:absolute;left:0;right:0;top:0;pointer-events:none;animation:out .24s ease both}.step.out.back{animation-name:outback}
@keyframes in{from{opacity:0;transform:translateX(32px)}to{opacity:1;transform:none}}@keyframes inback{from{opacity:0;transform:translateX(-32px)}to{opacity:1;transform:none}}
@keyframes out{to{opacity:0;transform:translateX(-32px)}}@keyframes outback{to{opacity:0;transform:translateX(32px)}}
.step h1{font-size:clamp(24px,3vw,32px);line-height:1.2;margin-bottom:10px}.step h1:focus,.step h1:focus-visible{outline:none!important}
.step p.lede{color:var(--text2);font-size:clamp(15px,1.4vw,16px);line-height:1.6;max-width:60ch;margin-bottom:clamp(14px,3vh,26px)}
.step .lab{margin-top:20px;font-size:14px}.step .lab:first-of-type{margin-top:0}
.step .field{min-height:48px;font-size:16px}
.step small{display:block;color:var(--text2);margin-top:10px;font-size:13px;line-height:1.5}
.step .password{display:flex;gap:8px}.step .password .field{flex:1}
.serr{display:none;margin-top:18px;padding:11px 14px;border-radius:8px;border:1px solid var(--bad);color:var(--bad);background:color-mix(in srgb,var(--bad) 8%,var(--surface));font-size:14px}.serr.show{display:block;animation:shake .35s}
@keyframes shake{20%,60%{transform:translateX(-5px)}40%,80%{transform:translateX(5px)}}
.wrow{display:flex;gap:10px;margin-top:auto;padding-top:clamp(22px,4vh,36px);align-items:center}.wrow .sp{flex:1}.wrow .btn{min-width:110px}
.btn .sp8{display:none;width:14px;height:14px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite}.btn.busy .sp8{display:inline-block}@keyframes spin{to{transform:rotate(360deg)}}
dl{display:grid;grid-template-columns:auto 1fr;gap:12px 24px;font-size:15px}dt{color:var(--text2)}dd{margin:0;overflow-wrap:anywhere}
.done-mark{width:84px;height:84px;margin:6px auto 18px;display:block}.done-mark circle{fill:none;stroke:var(--accent);stroke-width:3;stroke-dasharray:226;stroke-dashoffset:226;animation:draw .7s .1s ease forwards}.done-mark path{fill:none;stroke:var(--accent);stroke-width:4;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:50;stroke-dashoffset:50;animation:draw .5s .7s ease forwards}@keyframes draw{to{stroke-dashoffset:0}}
.step.fin{text-align:center;align-items:center;justify-content:center}.step.fin .lede{margin-inline:auto}.fin .btn{display:inline-flex;text-decoration:none;margin-top:6px;padding-inline:28px}
.step code{background:var(--side);border:1px solid var(--line);padding:1px 6px;border-radius:5px}
@media(max-width:640px){.sw-dots{justify-content:center}.sw-dots b:not(.on){display:none}}
@media(max-width:520px){.wrow{flex-wrap:wrap}.wrow .btn.pri{order:-1;flex:1 0 100%;justify-content:center}.wrow .btn:not(.pri){flex:1 1 0}.wrow .sp{display:none}}
@media(max-height:720px){.auth-anim main.center{padding-block:16px}.sw-steps{margin-top:22px}.sw-top{margin-bottom:14px}.step p.lede{margin-bottom:14px}.wrow{padding-top:20px}}
@media (prefers-reduced-motion:reduce){.step.on,.step.out,.serr.show{animation:none!important}.sw-bar i{transition:none}}
`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const pw = (id: string) => `<div class="password"><input class="field" id="${id}" type="password" autocomplete="off"><button type="button" class="btn" data-show="${id}" aria-label="Show">Show</button></div>`;
const err = `<p class="serr" role="alert" aria-live="polite"></p>`;

export function setupPage(publicGuess: string): string {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Set up · Jellypass</title><meta name="robots" content="noindex,nofollow,noarchive"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon.ico" sizes="32x32" type="image/png"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="stylesheet" href="/assets/app.css"><script src="/assets/theme.js"></script><style>${css}</style></head><body>
<div class="auth-anim" id="app" data-guess="${esc(publicGuess)}"><div class="poster-wall" id="poster-wall" aria-hidden="true"></div><main class="center"><div class="sw-in">
<div class="card authcard" id="card">
<div class="sw-top">${String(brand)}<span class="sw-no" id="stepno"></span></div>
<div class="sw-bar" role="progressbar" aria-label="Setup progress"><i id="fill"></i></div>
<div class="sw-dots" id="dots"><b>Welcome</b><b>Jellyfin</b><b>Seerr</b><b>Tracearr</b><b>Address</b><b>Finish</b></div>
<div class="sw-steps" id="steps">

<section class="step" data-step="0"><h1 tabindex="-1">Welcome to Jellypass</h1><p class="lede">Let's connect it to your media server. It takes about a minute, and every connection is tested before you move on.</p>${err}<div class="wrow"><span class="sp"></span><button class="btn pri" data-next><span class="sp8"></span>Continue</button></div></section>

<section class="step" data-step="1"><h1 tabindex="-1">Jellyfin</h1><p class="lede">Required. Jellypass signs members in and reads watch history through Jellyfin.</p>
<label class="lab" for="jf-url">Address</label><input class="field" id="jf-url" inputmode="url" placeholder="http://192.168.1.10:8096">
<label class="lab" for="jf-key">API key</label>${pw("jf-key")}
<small>Jellyfin: Dashboard, API Keys, "+". The address must work from inside the container, so not localhost.</small>
<label class="lab" for="jf-pub">Address members use <span class="muted">(optional)</span></label><input class="field" id="jf-pub" inputmode="url" placeholder="watch.example.com">
<small>Only if members connect from outside your network, by a different address. Used for posters, Open in Jellyfin links and the app set-up guide. Leave blank to use the address above.</small>${err}
<div class="wrow"><button class="btn ghost" data-back>Back</button><span class="sp"></span><button class="btn pri" data-next><span class="sp8"></span>Test and continue</button></div></section>

<section class="step" data-step="2"><h1 tabindex="-1">Seerr</h1><p class="lede">Optional. Lets members make and follow requests.</p>
<label class="lab" for="se-url">Address</label><input class="field" id="se-url" inputmode="url" placeholder="http://192.168.1.10:5055">
<label class="lab" for="se-key">API key</label>${pw("se-key")}<small>Seerr: Settings, General.</small>
<label class="lab" for="se-pub">Address members use <span class="muted">(optional)</span></label><input class="field" id="se-pub" inputmode="url" placeholder="requests.example.com">
<small>Only if members use a different address. Used for the Open Seerr buttons.</small>${err}
<div class="wrow"><button class="btn ghost" data-back>Back</button><span class="sp"></span><button class="btn" data-skip>Skip</button><button class="btn pri" data-next><span class="sp8"></span>Test and continue</button></div></section>

<section class="step" data-step="3"><h1 tabindex="-1">Tracearr</h1><p class="lede">Optional. Powers live streams and sign-in locations for admins.</p>
<label class="lab" for="tr-url">Address</label><input class="field" id="tr-url" inputmode="url">
<label class="lab" for="tr-key">API token</label>${pw("tr-key")}${err}
<div class="wrow"><button class="btn ghost" data-back>Back</button><span class="sp"></span><button class="btn" data-skip>Skip</button><button class="btn pri" data-next><span class="sp8"></span>Test and continue</button></div></section>

<section class="step" data-step="4"><h1 tabindex="-1">Your address</h1><p class="lede">The web address members will open. Used in emails and links.</p>
<label class="lab" for="pub">Public address</label><input class="field" id="pub" inputmode="url" placeholder="https://jellypass.example.com">
<small>Use the https address members will open: your reverse proxy or tunnel address, or this server's own https address if built-in HTTPS is on. Plain http works for a LAN trial.</small>${err}
<div class="wrow"><button class="btn ghost" data-back>Back</button><span class="sp"></span><button class="btn pri" data-next>Continue</button></div></section>

<section class="step" data-step="5"><h1 tabindex="-1">All set?</h1><p class="lede">Check these, then finish.</p><dl id="review"></dl>${err}
<div class="wrow"><button class="btn ghost" data-back>Back</button><span class="sp"></span><button class="btn pri" data-next><span class="sp8"></span>Finish setup</button></div></section>

<section class="step fin" data-step="6"><svg class="done-mark" viewBox="0 0 76 76" aria-hidden="true"><circle cx="38" cy="38" r="36"/><path d="M23 39l11 11 20-23"/></svg>
<h1 tabindex="-1">You're ready</h1><p class="lede">Sign in with a Jellyfin administrator account.</p><a class="btn pri" id="go" href="/">Open Jellypass</a></section>

</div></div></div></main></div><script type="module" src="/assets/wall.js"></script><script src="/setup.js"></script></body></html>`;
}

export const setupScript = `
(()=>{
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const steps=$$('.step'), dots=$$('#dots b'), fill=$('#fill'), D={code:'',jf:{},se:{},tr:{},pub:''};
let at=0;
const clean=v=>v.trim().replace(/\\/+$/,'');
function show(n,back){
  const old=steps[at], nw=steps[n];
  if(old&&old!==nw){old.classList.remove('on');old.classList.add('out');old.classList.toggle('back',!!back);setTimeout(()=>old.classList.remove('out','back'),260);}
  nw.classList.toggle('back',!!back);nw.classList.add('on');at=n;
  fill.style.width=Math.min(n,5)/5*100+'%';$('#stepno').textContent=n<6?'Step '+(n+1)+' of 6':'';
  dots.forEach((d,i)=>{d.classList.toggle('on',i===n);d.classList.toggle('done',i<n)});
  $('h1',nw).focus({preventScroll:true});
  const f=$('input',nw);if(f&&n<6)setTimeout(()=>f.focus({preventScroll:true}),300);
}
const err=(n,m)=>{const e=$('.serr',steps[n]);e.textContent=m||'';e.classList.remove('show');if(m){void e.offsetWidth;e.classList.add('show')}};
async function api(body){
  const r=await fetch('/setup/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({error:'Unexpected answer from the server.'}));
  if(!r.ok)throw new Error(j.error||'Something went wrong.');return j;
}
async function busy(btn,fn){btn.disabled=true;btn.classList.add('busy');if(!btn.firstElementChild)btn.insertAdjacentHTML('afterbegin','<span class="sp8"></span>');try{await fn()}finally{btn.disabled=false;btn.classList.remove('busy')}}
const svc=(n,key,url,k,pubId)=>async()=>{
  const u=clean($('#'+url).value),v=$('#'+k).value.trim();
  if(!u||!v)throw new Error('Enter both the address and the key, or skip this step.');
  const j=await api({action:'test',service:key,url:u,key:v});D[n]={url:u,key:v,publicUrl:(($('#'+pubId)||{}).value||'').trim()};if(j.posters){delete $('#poster-wall').dataset.built;import('/assets/wall.js?w='+Date.now()).catch(()=>{});}
};
const handlers={
  0:async()=>{},
  1:svc('jf','jellyfin','jf-url','jf-key','jf-pub'),2:svc('se','seerr','se-url','se-key','se-pub'),3:svc('tr','tracearr','tr-url','tr-key'),
  4:async()=>{const v=clean($('#pub').value);try{if(!/^https?:$/.test(new URL(v).protocol))throw 0}catch{throw new Error('Enter an address starting http:// or https://')}D.pub=v;
    const r=$('#review');const row=(a,b)=>'<dt>'+a+'</dt><dd></dd>';r.innerHTML='';
    [['Address',D.pub],['Jellyfin',D.jf.url],...(D.jf.publicUrl?[['Members use for Jellyfin',D.jf.publicUrl]]:[]),['Seerr',D.se.url||'Skipped'],...(D.se.publicUrl?[['Members use for Seerr',D.se.publicUrl]]:[]),['Tracearr',D.tr.url||'Skipped']].forEach(([a,b])=>{const t=document.createElement('dt');t.textContent=a;const d=document.createElement('dd');d.textContent=b;r.append(t,d)});},
  5:async()=>{const j=await api({action:'save',publicUrl:D.pub,jellyfin:D.jf,seerr:D.se,tracearr:D.tr});$('#go').href=j.next;fill.style.width='100%';
    dots.forEach(d=>{d.classList.remove('on');d.classList.add('done')});},
};
steps.forEach((s,i)=>{
  const next=$('[data-next]',s);
  const go=async()=>{err(i,'');try{await busy(next,handlers[i]);show(i+1)}catch(e){err(i,e.message)}};
  next&&next.addEventListener('click',go);
  $$('input',s).forEach(x=>x.addEventListener('keydown',e=>{if(e.key==='Enter')go()}));
  const b=$('[data-back]',s);b&&b.addEventListener('click',()=>show(i-1,true));
  const k=$('[data-skip]',s);k&&k.addEventListener('click',()=>{err(i,'');({2:'se',3:'tr'})[i]&&(D[{2:'se',3:'tr'}[i]]={});show(i+1)});
});
$('#pub').value=$('#app').dataset.guess;
$$('[data-show]').forEach(b=>b.addEventListener('click',()=>{const i=$('#'+b.dataset.show);const h=i.type==='password';i.type=h?'text':'password';b.textContent=h?'Hide':'Show'}));
show(0);
})();
`;
