// Shared prototype styles, including the reusable member shell.
import { adminSettingsCss } from './css-admin-settings';
import { authPagesCss } from './css-auth-pages';
import { notFoundCss } from './css-notfound';
import { adminUsersCss } from './css-admin-users';
import { adminSecurityCss } from './css-admin-security';
import { historyCss } from './css-history';
import { helpCss } from './css-help';
import { wrappedCss } from './css-wrapped';
import { tourCss } from './css-tour';
import { scrollCss } from './css-scroll';
import { mobileCss } from './css-mobile';
import { homeCss } from './css-home';
export const css = String.raw`
.avatar-slot{display:inline-flex;flex-shrink:0}
.avatar{position:relative;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:32px;height:32px;border-radius:50%;overflow:hidden;background:#0f766e;color:#fff;font-size:12px;font-weight:600;vertical-align:middle}
.avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.user-name>.avatar{float:left;margin-right:10px}

:root{--bg:#f6f5f2;--surface:#fff;--side:#efede8;--line:rgba(30,28,24,.10);--line2:rgba(30,28,24,.18);--text:#1b1a17;--text2:#5f5c55;--text3:#8b877e;--accent:#0f766e;--ink:#fff;--soft:rgba(15,118,110,.10);--ok:#2f855a;--warn:#b7791f;--bad:#c0392b;--idle:#a8a498;--sh:0 1px 2px rgba(30,28,24,.06),0 4px 14px rgba(30,28,24,.05);--ease:cubic-bezier(.2,.7,.2,1);color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#121311;--surface:#1a1b19;--side:#161715;--line:rgba(255,255,255,.08);--line2:rgba(255,255,255,.16);--text:#ecebe6;--text2:#a7a59c;--text3:#77756d;--accent:#2dd4bf;--ink:#06201d;--soft:rgba(45,212,191,.12);--sh:0 1px 2px rgba(0,0,0,.4),0 4px 14px rgba(0,0,0,.3)}}
:root[data-theme=light]{--bg:#f6f5f2;--surface:#fff;--side:#efede8;--line:rgba(30,28,24,.10);--line2:rgba(30,28,24,.18);--text:#1b1a17;--text2:#5f5c55;--text3:#8b877e;--accent:#0f766e;--ink:#fff;--soft:rgba(15,118,110,.10);--sh:0 1px 2px rgba(30,28,24,.06),0 4px 14px rgba(30,28,24,.05);color-scheme:light}
:root[data-theme=dark]{--bg:#121311;--surface:#1a1b19;--side:#161715;--line:rgba(255,255,255,.08);--line2:rgba(255,255,255,.16);--text:#ecebe6;--text2:#a7a59c;--text3:#77756d;--accent:#2dd4bf;--ink:#06201d;--soft:rgba(45,212,191,.12);--sh:0 1px 2px rgba(0,0,0,.4),0 4px 14px rgba(0,0,0,.3);color-scheme:dark}
:root[data-theme=oled]{--bg:#000;--surface:#0a0a0a;--side:#000;--line:rgba(255,255,255,.10);--line2:rgba(255,255,255,.20);--text:#ecebe6;--text2:#a7a59c;--text3:#77756d;--accent:#2dd4bf;--ink:#06201d;--soft:rgba(45,212,191,.12);--sh:none;color-scheme:dark}
*{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--text);font:14px/1.5 ui-sans-serif,-apple-system,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
h1,h2,h3{letter-spacing:-.02em;font-weight:600;text-wrap:balance}
button,input,select,textarea{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
.num{font-variant-numeric:tabular-nums}.muted{color:var(--text2)}.faint{color:var(--text3)}
svg.i{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}
/* prototype bar */
.proto{position:sticky;top:0;z-index:50;display:flex;gap:6px;align-items:center;padding:8px 14px;background:var(--text);color:var(--bg);flex-wrap:wrap;font-size:13px}
.proto b{font-weight:500;opacity:.7;margin-right:4px}
.proto button{border:1px solid rgba(128,128,128,.5);background:transparent;color:inherit;padding:3px 11px;border-radius:999px;cursor:pointer}
.proto button:hover{background:rgba(128,128,128,.25)}
.proto .sp{flex:1}
/* controls */
.btn{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line2);background:var(--surface);padding:7px 14px;border-radius:6px;cursor:pointer;transition:background .15s,transform .1s}
.btn:hover{background:var(--line)}.btn:active{transform:translateY(1px)}
.btn.pri{background:var(--accent);color:var(--ink);border-color:transparent;font-weight:500}.btn.pri:hover{filter:brightness(1.08)}
.btn.ghost{border-color:transparent;background:none;color:var(--text2)}
.btn.danger{color:var(--bad)}
.btn[disabled]{opacity:.5;cursor:not-allowed;transform:none}
.field{background:var(--surface);border:1px solid var(--line2);border-radius:6px;padding:8px 10px;width:100%;min-width:0}
.field:focus{outline:2px solid var(--accent);outline-offset:0}
.lab{font-weight:500;display:block;margin-bottom:6px}
.err{color:var(--bad);font-size:13px;margin-top:4px;min-height:0}
.card{background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:var(--sh)}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:8px;vertical-align:middle}
.sw{width:34px;height:20px;border-radius:999px;background:var(--line2);position:relative;flex:none;border:0;cursor:pointer;padding:0}
.sw::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s var(--ease)}
.sw[aria-checked=true]{background:var(--accent)}.sw[aria-checked=true]::after{left:16px}
.mark{width:28px;height:28px;border-radius:8px;background:var(--accent);display:grid;place-items:center;color:var(--ink);flex:none}
.av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#0f766e,#164e63);color:#fff;display:grid;place-items:center;font-size:12px;font-weight:600;flex:none}
.tag{display:inline-block;font-size:12px;color:var(--text2);border:1px solid var(--line2);border-radius:999px;padding:1px 10px}
.row{display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--line)}.row:first-child{border-top:0}
.tabs{display:flex;gap:6px;flex-wrap:wrap}
.toast{position:fixed;bottom:20px;left:50%;transform:translate(-50%,20px);background:var(--text);color:var(--bg);padding:9px 16px;border-radius:8px;opacity:0;pointer-events:none;transition:all .2s var(--ease);z-index:100}
.toast.on{opacity:1;transform:translate(-50%,0)}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
.fade{animation:in .22s var(--ease)}@keyframes in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
/* auth / wizard */
.poster-wall{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));align-content:start;gap:12px;background:light-dark(var(--text),var(--bg))}
.poster-wall:empty{display:none}
.poster-wall img{display:block;width:100%;aspect-ratio:2/3;object-fit:cover;opacity:.25;transform:translateY(-24px) rotate(-3deg);border-radius:8px}
.poster-wall img:nth-child(even){margin-top:-40px}
.poster-wall::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent,light-dark(var(--text),var(--bg))),linear-gradient(transparent,light-dark(var(--text),var(--bg)))}
.poster-wall+main{position:relative;z-index:1}
@media(prefers-reduced-motion:no-preference){.poster-wall img{animation:poster-drift 40s ease-in-out infinite alternate}@keyframes poster-drift{to{transform:translateY(0) rotate(-3deg)}}}
@media(max-width:600px){.poster-wall{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.poster-wall img:nth-child(n+13){display:none}}
.center{min-height:calc(100vh - 41px);display:grid;place-items:center;padding:24px}
.authcard{width:100%;max-width:400px;padding:26px;display:flex;flex-direction:column;gap:14px}
.wiz{min-height:calc(100vh - 41px);display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.wl{padding:44px 56px;display:flex;flex-direction:column;max-width:580px;margin-left:auto;width:100%;gap:16px}
.wr{background:var(--side);border-left:1px solid var(--line);display:grid;place-items:center;padding:32px}
.steps{display:flex;gap:6px}.steps i{height:4px;flex:1;border-radius:2px;background:var(--line2);transition:background .2s}.steps i.d{background:var(--accent)}
.wnav{display:flex;gap:10px;align-items:center;margin-top:auto;padding-top:20px}.wnav .sp{flex:1}
.link{background:none;border:0;color:var(--text2);text-decoration:underline;cursor:pointer;padding:6px}
.opt{display:flex;gap:12px;padding:12px 14px;border:1px solid var(--line2);border-radius:10px;cursor:pointer;background:var(--surface);align-items:flex-start;text-align:left;width:100%}
.opt[aria-pressed=true]{border-color:var(--accent);background:var(--soft)}
.opts{display:grid;gap:8px}.opts.g2{grid-template-columns:1fr 1fr}
.meter{height:4px;border-radius:2px;background:var(--line2);overflow:hidden;margin-top:8px}.meter i{display:block;height:100%;width:0;transition:width .2s,background .2s}
.code{font:600 36px/1 ui-monospace,Menlo,monospace;letter-spacing:.14em;color:var(--accent)}
.help{padding:14px;border-radius:8px;background:var(--soft)}
/* shell */
.app{display:grid;grid-template-columns:240px 1fr;min-height:calc(100vh - 41px)}
.side{background:var(--side);border-right:1px solid var(--line);padding:16px 12px;display:flex;flex-direction:column;gap:2px}
.brand{display:flex;align-items:center;gap:10px;padding:4px 10px 16px;font-weight:600;letter-spacing:-.02em}
.grp{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text3);padding:16px 10px 6px}
.nav{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;color:var(--text2);background:none;border:0;text-align:left;cursor:pointer;width:100%;position:relative;transition:color .15s,background .15s}
.nav:hover{background:var(--line);color:var(--text)}
.nav[aria-current=page]{background:var(--soft);color:var(--accent);font-weight:500}
.nav[aria-current=page]::before{content:"";position:absolute;left:-12px;top:8px;bottom:8px;width:3px;border-radius:0 3px 3px 0;background:var(--accent)}
.nav .ct{margin-left:auto;font-size:12px;color:var(--text3)}
.me{margin-top:auto;display:flex;gap:10px;align-items:center;padding:10px;border-top:1px solid var(--line)}
.main{padding:24px;min-width:0}
.top{display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap}.top h1{font-size:22px}.top .sp{flex:1}
.banner{display:flex;gap:10px;align-items:center;padding:10px 14px;margin-bottom:16px;border-radius:6px;background:var(--soft)}
.home{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:16px}
.stack{display:flex;flex-direction:column;gap:16px}
.shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,150px));gap:12px;margin-top:16px;justify-content:start}
.poster{aspect-ratio:2/3;border-radius:8px;position:relative;overflow:hidden;display:flex;align-items:flex-end;padding:10px;color:#fff;font-weight:600;font-size:13px;line-height:1.25}
.poster::after{z-index:2;content:"";position:absolute;left:0;bottom:0;height:4px;background:var(--accent);width:var(--p,0)}
.signin-row{display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--line)}.signin-row:first-child{border-top:0}.signin-row .btn{flex:none;font-size:13px;padding:6px 10px}.stream .prog{width:100%;display:block;margin:6px 0 2px}.stream summary{cursor:pointer;color:var(--text2);margin-top:8px}.catcard{display:flex;flex-direction:column}.catcard .poster{width:100%}.catcard .poster img{border-radius:8px}.cathead{display:flex;align-items:baseline;gap:8px;margin:0 0 12px}.cathead h2{font-size:17px;margin:0}.cat .empty{grid-column:1/-1}.poster img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.poster.has-img::before{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(to top,rgba(0,0,0,.7),transparent 55%)}.poster{text-decoration:none}.poster span{position:relative;z-index:1;text-shadow:0 1px 8px rgba(0,0,0,.5)}
.p1{background:linear-gradient(160deg,#134e4a,#0b1f2a)}.p2{background:linear-gradient(160deg,#7c2d12,#1c1917)}.p3{background:linear-gradient(160deg,#3730a3,#0f172a)}.p4{background:linear-gradient(160deg,#4d7c0f,#14201a)}.p5{background:linear-gradient(160deg,#9d174d,#1f1020)}.p6{background:linear-gradient(160deg,#0369a1,#0c1a2b)}
.cardh{font-size:14px;padding:14px 16px 6px}.cardh small{font-weight:400;color:var(--text3);margin-left:8px;font-size:12px}
.list{list-style:none;padding:0}.list li{display:flex;align-items:center;gap:10px;padding:10px 16px;border-top:1px solid var(--line)}.list li:first-child{border-top:0}
table{width:100%;border-collapse:collapse}th{font-weight:500;text-align:left;color:var(--text3);font-size:12px;padding:10px 14px;border-bottom:1px solid var(--line)}
td{padding:0 14px;height:46px;border-bottom:1px solid var(--line)}tr:last-child td{border-bottom:0}
tbody tr{cursor:default;transition:background .12s}tbody tr:hover{background:var(--soft)}tbody tr.sel{background:var(--soft)}
.who{display:flex;align-items:center;gap:10px}
.tools{display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap}
.bulk{display:flex;gap:8px;align-items:center;padding:10px 14px;background:var(--text);color:var(--bg);border-radius:6px;margin-bottom:12px;flex-wrap:wrap}.bulk .btn{background:transparent;color:var(--bg);border-color:rgba(128,128,128,.5)}
.split{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start}.split.eq{grid-template-columns:1fr 1fr}
.seg{border:1px solid var(--line2);border-radius:10px;overflow:hidden}
.seg label{display:flex;gap:12px;padding:10px 14px;cursor:pointer;border-top:1px solid var(--line)}.seg label:first-child{border-top:0}.seg label:has(input:checked){background:var(--soft)}.seg input{margin-top:4px;accent-color:var(--accent)}
.lnk{display:flex;gap:8px;align-items:center;padding:8px 8px 8px 12px;border:1px dashed var(--line2);border-radius:6px;font:13px ui-monospace,Menlo,monospace}.lnk span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.prog{display:inline-block;vertical-align:middle;height:4px;border-radius:2px;background:var(--line2);overflow:hidden;width:90px}.prog i{display:block;height:100%;background:var(--accent)}
.cat{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,170px));gap:14px;justify-content:start}
.up{display:flex;gap:2px;height:22px}.up i{flex:1;border-radius:1px}
/* tour */
.veil{position:fixed;inset:0;z-index:60}
.spot{position:fixed;z-index:61;border-radius:10px;box-shadow:0 0 0 9999px rgba(0,0,0,.4),0 0 0 2px var(--accent);pointer-events:none;transition:all .25s var(--ease)}
.pop{position:fixed;z-index:62;background:var(--surface);border:1px solid var(--line2);border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:16px;width:300px;transition:all .25s var(--ease)}
.dots{display:flex;gap:4px}.dots i{width:6px;height:6px;border-radius:50%;background:var(--line2)}.dots i.on{background:var(--accent)}
@media (max-width:900px){
 .app,.home,.split,.split.eq,.wiz{grid-template-columns:1fr}
 .side{flex-direction:row;overflow-x:auto;padding:8px;border-right:0;border-bottom:1px solid var(--line)}
 .brand,.grp,.me{display:none}.nav{width:auto;white-space:nowrap}.nav[aria-current=page]::before{display:none}
 .wr{display:none}.wl{padding:24px 16px;margin:0}
 th:nth-child(n+5),td:nth-child(n+5){display:none}
 .hprog{display:none}
}

/* Page forms and accessible wizard states. */
[hidden]{display:none!important}a{color:var(--accent)}.btn{text-decoration:none;min-height:44px;justify-content:center}.field{min-height:44px}.center,.wiz{min-height:100svh}.authcard form,.panel{display:flex;flex-direction:column;gap:16px}.authcard h1{font-size:24px}.wl h1{font-size:28px}.brandline{display:flex;align-items:center;gap:10px}.actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.actions>*{flex:1}.password{display:flex;gap:6px}.password input{flex:1;min-width:0}.password button{flex:none}.err:empty{display:none}.notice{min-height:1.5em}.grant-list{padding-left:20px}.help summary{cursor:pointer}.wl{min-width:0}.panel:focus{outline:none}.progress{color:var(--text2);font-variant-numeric:tabular-nums}.brand{display:flex}.authcard{overflow-wrap:anywhere}.faint{color:var(--text2)}
@media(max-width:420px){.center{padding:16px}.authcard{padding:22px}.actions{gap:8px}.wl{padding:24px 20px}.opts.g2{grid-template-columns:1fr}}

/* Member pages share the prototype's token palette and components. */
.member-app{min-height:100svh}.pad{padding:20px}.main{align-content:start}.main> .notice:empty{display:none}.main h2{font-size:18px}.main h3{font-size:15px}.main p{overflow-wrap:anywhere}.main .top{margin-bottom:0}.nav{text-decoration:none;min-height:44px}.grp{text-transform:none;font-size:13px}.me{flex-wrap:wrap}.mobilebar,.mobile-close{display:none}.skip{position:fixed;top:-100px;left:16px;z-index:100;background:var(--surface);padding:12px}.skip:focus{top:12px}.account{max-width:640px}.history-row{display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--line);flex-wrap:wrap}.grow{flex:1;min-width:100px}.thumb{width:44px;aspect-ratio:2/3;object-fit:cover;border-radius:6px;flex:none}.placeholder{background:var(--side)}.cat .thumb{width:100%;max-width:220px}.cat article{display:flex;flex-direction:column;gap:8px}.cat article>p{max-height:6em;overflow:auto}.service{padding:14px 0;border-bottom:1px solid var(--line)}.up{margin:10px 0}.day.good{background:var(--ok);opacity:.6}.day.bad{background:var(--bad)}.day.unknown{background:var(--idle)}.tabs [aria-pressed=true]{background:var(--soft);border-color:var(--accent)}details{padding:12px 0;border-bottom:1px solid var(--line)}summary{cursor:pointer;font-weight:500;min-height:28px}details p{margin-top:8px}#map{height:340px;border-radius:8px;overflow:hidden;margin-top:12px}.map-pin{width:18px;height:18px;border:2px solid var(--surface);border-radius:50%;background:var(--accent);cursor:pointer}dialog{max-width:min(480px,calc(100vw - 32px));margin:auto;padding:24px;border:1px solid var(--line2);border-radius:14px;background:var(--surface);color:var(--text)}dialog p{margin:16px 0}dialog::backdrop{background:rgba(0,0,0,.45)}
@media(max-width:900px){.mobilebar{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--side)}.member-app>.side{display:none}.member-app>.side.open{display:flex;position:fixed;inset:0 auto 0 0;width:min(300px,90vw);z-index:80;flex-direction:column;overflow-y:auto;box-shadow:0 0 0 100vmax rgba(0,0,0,.4);padding:16px}.side.open .brand,.side.open .grp,.side.open .me{display:flex}.side.open .mobile-close{display:block}.side .nav{width:100%}.main{padding:20px 16px}.home,.split,.split.eq{grid-template-columns:minmax(0,1fr)}}

/* Admin tables preserve every column as labelled cards on narrow screens. */
.admin-page{max-width:1200px}.admin-page .field{margin-top:6px}.admin-page label{display:block}.admin-page .bulk label{flex:1;min-width:120px}.admin-page .bulk .field{color:var(--text)}.admin-table td{padding:10px 14px;overflow-wrap:anywhere}.admin-table td:nth-child(n){display:table-cell}.admin-table th:nth-child(n){display:table-cell}.admin-page .actions{justify-content:flex-start}.admin-page .actions>*{flex:0 1 auto}.admin-page pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;max-width:100%;margin-top:10px}.admin-page fieldset{border:1px solid var(--line2);border-radius:6px;padding:12px;display:grid;gap:8px}.admin-page input[type=checkbox]{accent-color:var(--accent);min-width:18px;min-height:18px}.admin-page dialog{width:min(560px,calc(100vw - 32px));max-height:calc(100svh - 32px);overflow:auto}.admin-page dialog>.btn{margin-top:16px}.admin-page .service:last-child{border-bottom:0}
@media(max-width:700px){.admin-table,.admin-table tbody,.admin-table tr{display:block}.admin-table thead{position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden}.admin-table tr{padding:12px;border-bottom:1px solid var(--line2)}.admin-table td:nth-child(n){display:grid;grid-template-columns:90px minmax(0,1fr);gap:10px;height:auto;min-height:36px;padding:6px 0;border:0}.admin-table td::before{content:attr(data-label);font-weight:500;color:var(--text2)}.admin-page .bulk{align-items:stretch}.admin-page .actions{gap:6px}.admin-page .pad{padding:16px}}

/* Member pages: keep poster dimensions and history hierarchy from the prototype. */
#announcements:empty{display:none}#status-line{--tone:var(--idle);display:flex;align-items:center;gap:12px;margin-top:16px;padding:10px 14px;font-size:14px;color:var(--text);background:var(--surface);border:1px solid var(--line);border-radius:12px}#status-line[data-state=ok]{--tone:var(--ok)}#status-line[data-state=bad]{--tone:var(--bad)}#status-line .dot{flex:none;margin:0 4px;background:var(--tone);box-shadow:0 0 0 4px color-mix(in srgb,var(--tone) 18%,transparent)}#status-line span:nth-child(2){flex:1;min-width:0}#status-line a{flex:none;display:inline-flex;align-items:center;min-height:32px;padding:0 10px;border-radius:8px;font-weight:500;text-decoration:none}#status-line a::after{content:"\2192";margin-left:6px}#status-line a:hover{background:var(--soft)}@media(prefers-reduced-motion:no-preference){#status-line[data-state=ok] .dot{animation:status-pulse 2.4s ease-out infinite}@keyframes status-pulse{50%{box-shadow:0 0 0 7px color-mix(in srgb,var(--tone) 6%,transparent)}}}
.discover-search{display:flex;gap:8px;align-items:center;max-width:340px}.discover-search:focus-within{outline:2px solid var(--accent);outline-offset:2px}.discover-notifications{font-size:12px;margin-top:-16px}
.history-top .tabs{margin:0}.history-layout{grid-template-columns:minmax(0,1fr) 320px}.history-layout>*{min-width:0}.history-group h2{font-size:13px;font-weight:500;color:var(--text2);margin:0 0 8px 4px}
.history-row{padding:12px 16px;border-bottom:0;border-top:1px solid var(--line)}.history-row:first-child{border-top:0}.history-row .grow{min-width:120px;overflow-wrap:anywhere}.history-row p{font-size:13px}.history-poster{width:44px;flex:none;padding:0;border-radius:6px}.history-poster .thumb{display:block;border-radius:0}.history-poster .placeholder{background:transparent}.history-poster::after{z-index:2;height:3px}.history-actions{display:flex;gap:6px;align-items:center}.history-progress{margin-left:auto;white-space:nowrap}.finished-dot{background:var(--ok)}.history-total{font-size:32px;font-weight:600;letter-spacing:-.02em}.history-spark{display:block;width:100%;margin-top:12px}.history-chart-dates,.history-stat-row{display:flex;justify-content:space-between;gap:12px}.history-chart-dates{font-size:12px}.history-stat-row{margin-top:10px}#history-stats .prog{width:100%;height:6px}#history-stats h3{font-size:14px}#history-stats .list li{padding:10px 0}.history-layout .link{min-height:44px;padding:0}.catcard{min-width:0;overflow-wrap:anywhere}
@media(max-width:1100px){.history-layout{grid-template-columns:minmax(0,1fr)}.history-layout aside{max-width:640px}}
@media(max-width:600px){.history-row{gap:10px}.history-progress{margin-left:54px}.history-actions{margin-left:auto}.history-top .sp{display:none}.history-top .tabs{margin-left:auto}.tools .discover-search{max-width:none}.cat{grid-template-columns:repeat(auto-fill,minmax(130px,150px))}}

/* Approved prototype density, with larger targets on touch layouts. */
.page-content{display:flex;flex-direction:column;gap:16px;min-width:0}.page-content>.top{margin-bottom:4px}.page-content>.tools{margin-bottom:0}.page-content>*{min-width:0}
.main>.notice:not(:empty){margin-bottom:16px}.identity{flex:1;min-width:0;overflow-wrap:anywhere}.identity small{display:block;font-size:12px}.me{flex-wrap:nowrap;gap:8px}.me .btn{padding:4px 8px;font-size:12px}.nav>span:not(.ct){min-width:0}.nav .ct:empty{display:none}
.main .cardh{font-size:14px}.main .pad h2{font-size:16px}.main .pad{padding:16px 20px}.block{display:block}.sr-only{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.shelf{grid-template-columns:repeat(4,minmax(0,1fr))}.cat{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}.page-content>#recent-line{margin-top:0!important}
.account{padding:6px 20px;max-width:700px}.account-section+.account-section,.account>.row{border-top:1px solid var(--line)}.account-section>.row{border:0}.account .row{min-height:54px}.account .row>a,.account .row>.link{padding:6px 0}.account .row>.btn{padding:7px 14px}.account .grow{min-width:0}.account p{font-size:13px}.account .tag{white-space:nowrap}.inline-form{padding:4px 0 16px;max-width:440px;gap:10px}.inline-form>.btn{align-self:flex-start}.inline-form .lab{margin:0}.account #email-edit .inline-form+form{border-top:1px solid var(--line);padding-top:16px}
.switch-hit{position:relative;display:grid;place-items:center;width:44px;height:44px;flex:none;cursor:pointer}.switch-hit input{position:absolute;inset:0;width:44px;height:44px;opacity:0;cursor:pointer}.switch-track{pointer-events:none;width:34px;height:20px;border-radius:999px;background:var(--line2);padding:2px}.switch-track::after{content:"";display:block;width:16px;height:16px;border-radius:50%;background:#fff}.switch-hit input:checked+.switch-track{background:var(--accent)}.switch-hit input:checked+.switch-track::after{margin-left:14px}.switch-hit input:focus-visible+.switch-track{outline:2px solid var(--accent);outline-offset:3px}
.service-heading{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}.service-heading h3{flex:1;font-size:14px}.service-heading span{font-size:13px}.up i{min-width:0}.incident{padding:10px 0}.incident h3{font-size:14px}.incident .faint{font-size:12px}
.requests-card{margin-top:8px;padding-bottom:6px}.request-list li{border:0;padding:6px 16px;gap:12px}.request-title{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.request-state{flex:none;white-space:nowrap;font-size:12px;padding:1px 8px}.request-state .dot{width:6px;height:6px;margin-right:6px}.request-list .link{padding:4px 0}.request-list li:has(.req-row){padding:0}.req-row{display:flex;align-items:center;gap:12px;padding:8px 16px;color:inherit;text-decoration:none;min-width:0;width:100%}a.req-row:hover{background:var(--soft)}a.req-row:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}.req-poster{flex:none;width:40px;height:60px;border-radius:6px;object-fit:cover;background:var(--side)}.req-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.req-main b{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.req-main small{font-size:12px}.compare-people{display:flex;flex-wrap:wrap;gap:8px}.compare-person{display:inline-flex;align-items:center;gap:8px;padding-inline:12px}.compare-person[aria-pressed=true]{background:var(--soft);border-color:var(--accent)}.compare-head{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.compare-pct{font-size:40px;line-height:1;color:var(--accent)}.cmp-block{display:grid;gap:12px}.cmp-block>h2{font-size:18px}.cmp-note{font-size:13px;margin:0}.cmp-matches{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px}.cmp-match{display:grid;grid-template-columns:auto 1fr auto;grid-template-areas:'a i p' 'b b b';gap:8px 12px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:14px}.cmp-match .avatar{grid-area:a}.cmp-match-info{grid-area:i;display:grid;min-width:0}.cmp-pct{grid-area:p;font-size:28px}.cmp-match .cmp-bar{grid-area:b}.cmp-bar{display:block;height:8px;border-radius:4px;background:var(--line);overflow:hidden}.cmp-bar i{display:block;height:100%;border-radius:4px;background:var(--text2)}.cmp-match .cmp-bar i,.cmp-row.lead .cmp-bar i{background:var(--accent)}.cmp-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px}.cmp-stat{border:1px solid var(--line);border-radius:10px;padding:14px;display:grid;gap:10px;align-content:start}.cmp-stat h3{font-size:14px;font-weight:500;color:var(--text2);margin:0}.cmp-row{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:'w v' 'b b';gap:4px 12px;align-items:baseline}.cmp-who{grid-area:w;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cmp-val{grid-area:v;font-size:16px;text-align:right}.cmp-row .cmp-bar{grid-area:b}.cmp-row.lead .cmp-val{color:var(--accent)}.cmp-text{grid-template-areas:'w v';grid-template-columns:auto 1fr;align-items:start}.cmp-text .cmp-val{font-weight:500;text-align:right;overflow-wrap:anywhere}.compare-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:16px}.compare-item{display:flex;align-items:center;gap:12px;min-width:0}.compare-item img{width:84px;height:126px;border-radius:8px;object-fit:cover;flex:none}.compare-item{gap:14px}.compare-title b{font-size:16px;white-space:normal}.compare-title small{font-size:14px}.compare-open{align-self:flex-start;margin-top:8px;font-size:13px;min-height:32px;padding:4px 12px}.compare-title{display:flex;flex-direction:column;min-width:0}.compare-title b{font-weight:500;overflow:hidden;text-overflow:ellipsis}
.chips{display:inline-flex;gap:4px;align-items:center;vertical-align:middle}.discover-poster .chips{position:absolute;inset:auto auto 8px 8px;z-index:2}.bbfc,.qual{display:inline-grid;place-items:center;min-width:22px;height:20px;padding:0 5px;border-radius:5px;font-size:11px;font-weight:700;line-height:1;letter-spacing:.2px;font-style:normal}.bbfc{color:#111}.bbfc[data-r=U]{background:#4cc36b}.bbfc[data-r=PG]{background:#f2c230}.bbfc[data-r="12"],.bbfc[data-r=\31 2A]{background:#f08a3c}.bbfc[data-r="15"]{background:#e86aa6}.bbfc[data-r="18"],.bbfc[data-r=R18]{background:#e5484d;color:#fff}.qual{background:#111;color:#fff;border:1px solid rgba(255,255,255,.55)}.req-state{flex:none;display:inline-flex;align-items:center;font-size:12px;color:var(--text2)}
.map-card{overflow:hidden}.map-card #map{border-radius:0;margin-top:8px}.map-caption{padding:8px 16px 14px;font-size:12px}.compact-list{padding:0 16px 8px}.compact-list>.muted{padding:10px 0}.device-note{padding:10px 16px;font-size:12px}.devices-layout>*,.help-layout>*{min-width:0}
.help-tools>#help-search{max-width:420px;flex:1 1 240px}.help-layout{grid-template-columns:minmax(0,1fr) 340px;max-width:1100px}.articles{padding:6px 20px}.articles details:last-of-type{border-bottom:0}.guide-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}.guide-tabs .btn{padding:7px 8px}.help-layout .stack{gap:12px}#help-message>.btn,#device-guide>.btn{align-self:flex-start}
.admin-page{gap:12px}.admin-page h2{font-size:16px}.admin-page .stack{gap:12px}.admin-page .tools{margin:0}.user-tools>label{max-width:320px;flex:1}.user-tools{align-items:flex-end}.user-tools .tabs{align-self:flex-end}.admin-page .field{margin-top:4px}.admin-page .card{min-width:0}.admin-table td{padding:6px 14px}.user-name>.btn{border:0;background:none;padding:0;justify-content:flex-start;color:var(--accent)}.user-name>p{font-size:12px}.admin-streams,.admin-audit{max-width:820px}.admin-settings{max-width:700px}.admin-audit>label{max-width:300px}.admin-audit>#audit-more{align-self:flex-start}.invite-pending>details{margin:8px 16px}.announcement-row{padding:12px 0;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px}.announcement-row:first-child{padding-top:0}.announcement-row:last-child{padding-bottom:0;border-bottom:0}.announcement-row>h3{overflow-wrap:anywhere}.announcement-row>p{grid-column:1;font-size:13px;white-space:pre-wrap}.announcement-row>.btn{grid-column:2;grid-row:1/4;align-self:center}.admin-page .service.stack{gap:8px}
@media(min-width:901px){.member-app .btn,.member-app .field,.member-app .nav{min-height:36px}.member-app .grp{font-size:11px;letter-spacing:.06em;text-transform:uppercase}.member-app .nav{padding:8px 10px}.member-app .nav>span:not(.ct){white-space:nowrap;font-size:13px}}
@media(max-width:1200px){.users-layout{grid-template-columns:minmax(0,1fr)}.users-layout>aside{max-width:700px}}
@media(max-width:900px){.help-layout,.devices-layout{grid-template-columns:minmax(0,1fr)}.shelf{grid-template-columns:repeat(2,minmax(0,1fr))}.member-app .btn,.member-app .nav,.member-app summary,.member-app .link{min-height:44px}.member-app summary{display:flex;align-items:center}.member-app input:not([type=checkbox]),.member-app select,.member-app textarea{font-size:16px}.member-app .field{min-height:44px}.account .row>a{display:inline-flex;align-items:center;min-height:44px}.request-list .link{min-height:44px}.guide-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:420px){.account{padding:4px 12px}.account .row{gap:8px;flex-wrap:wrap}.account .tag{font-size:11px}.account #contact-email{overflow-wrap:anywhere}.service-heading{gap:6px}.service-heading h3{flex-basis:100%}.service-heading span:last-child{margin-left:auto}.signin-row{flex-wrap:wrap}.signin-row .btn{margin-left:auto}.cat{grid-template-columns:repeat(2,minmax(0,1fr))}.request-list li{padding:6px 12px}.request-state{padding:1px 6px}.admin-page .tools>label{max-width:none;flex-basis:100%}}

.stream-poster{width:56px;aspect-ratio:2/3;object-fit:cover;border-radius:6px;flex:none;background:var(--line)}.stream-head{display:flex;align-items:center;gap:12px}.stream-head p{font-size:13px}.stream-head .prog{width:90px;flex:none;margin:0}.stream-head .sp{display:none}.stream details{border:0;padding:0}.stream details[open]{padding-top:8px}.key-editor>label,.key-editor>.actions{margin-top:10px}.key-editor summary{font-size:13px}.admin-audit td details{border:0;padding:4px 0;font-size:12px}.admin-audit td>div>p{font-size:12px}.admin-audit summary{font-weight:400}.admin-settings .top{gap:8px}.admin-settings .top>h2,.admin-settings .top>h3{flex:1}
@media(max-width:600px){.stream-head{flex-wrap:wrap}.stream-head .grow{flex-basis:100%}.stream-head>.btn{margin-left:auto}.stream-head .prog{width:90px}.user-tools .tabs{gap:4px}}
/* Member status: shared service history and current health. */
.status-page{width:100%;max-width:760px;margin-inline:auto;min-width:0;--status-green:#21633f;--status-red:#a12b22;--status-amber:#8a590e}
.status-page .top{margin-bottom:24px}
.status-banner{display:flex;align-items:center;gap:24px;padding:24px;min-height:112px;border:1px solid var(--line);border-radius:16px;background:var(--side);margin-bottom:24px;--status-tone:var(--text3)}
.status-banner[data-state=operational]{--status-tone:var(--status-green)}.status-banner[data-state=problem]{--status-tone:var(--status-amber)}.status-banner[data-state=problem][data-severity=major]{--status-tone:var(--status-red)}
.status-banner[data-state=operational],.status-banner[data-state=problem]{background:color-mix(in srgb,var(--status-tone) 8%,var(--surface));border-color:color-mix(in srgb,var(--status-tone) 24%,var(--line))}
.status-banner .dot{position:relative;width:16px;height:16px;margin:8px;flex:none;border-radius:50%;background:var(--status-tone);box-shadow:0 0 0 8px color-mix(in srgb,var(--status-tone) 12%,transparent)}
.status-banner h2{font-size:clamp(20px,3vw,26px);line-height:1.25;letter-spacing:-.025em;margin:0 0 8px;color:var(--text)}.status-banner p{font-size:13px;line-height:20px;color:var(--text2)}
.status-services{overflow:hidden;border:1px solid var(--line);border-radius:12px;background:var(--surface);box-shadow:0 2px 4px #00000003,0 8px 24px #00000003}
.status-service{padding:24px;min-width:0}.status-service+.status-service{border-top:1px solid var(--line)}
.status-service-head{display:flex;justify-content:space-between;align-items:center;gap:16px;min-height:48px}.status-service-name{min-width:0}.status-service-name h3{font-size:15px;line-height:24px;font-weight:600;overflow-wrap:anywhere}.status-service-name p{font-size:12px;line-height:20px;margin-top:4px;color:var(--text2)}
.status-service-health{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:8px 12px;max-width:280px;font-size:12px;line-height:20px;font-variant-numeric:tabular-nums}.status-chip{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:6px;white-space:nowrap;background:var(--side);color:var(--text2);font-weight:600}.status-chip::before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor}
.status-chip[data-state=operational]{color:var(--status-green);background:color-mix(in srgb,var(--status-green) 9%,var(--surface))}.status-chip[data-state=problem]{color:var(--status-red);background:color-mix(in srgb,var(--status-red) 9%,var(--surface))}
.status-uptime{color:var(--text2);white-space:nowrap}.status-strip{display:flex;gap:3px;height:32px;margin-top:24px;min-width:0}.status-bar{display:block;flex:1 1 0;min-width:0;border-radius:3px;background:var(--line2);transform-origin:center bottom}.status-bar[data-state=healthy]{background:var(--status-green)}.status-bar[data-state=warning]{background:var(--status-amber)}.status-bar[data-state=problem]{background:var(--status-red)}.status-bar:hover{outline:2px solid var(--text);outline-offset:2px}
.status-strip-caption{display:flex;justify-content:space-between;gap:16px;font-size:11px;line-height:16px;margin-top:8px;color:var(--text2)}
.status-footnote{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 24px;margin-top:16px;font-size:11px;line-height:20px;color:var(--text2)}.status-legend{display:flex;flex-wrap:wrap;gap:8px 16px}.status-legend span{display:inline-flex;align-items:center;gap:6px}.status-legend span::before{content:"";width:8px;height:8px;border-radius:2px;background:var(--line2)}.status-legend [data-state=healthy]::before{background:var(--status-green)}.status-legend [data-state=problem]::before{background:var(--status-red)}.status-legend [data-state=warning]::before{background:var(--status-amber)}
.recent-incidents{margin-top:40px}.recent-incidents h2{font-size:18px;line-height:24px;letter-spacing:-.015em;margin-bottom:24px}.status-incident{position:relative;margin-left:4px;padding:0 0 32px 24px;border-left:1px solid var(--line2);overflow-wrap:anywhere}.status-incident::before{content:"";position:absolute;left:-5px;top:6px;width:9px;height:9px;border-radius:50%;background:var(--text3);box-shadow:0 0 0 4px var(--bg)}.status-incident:last-child{padding-bottom:0}.status-incident time{font-size:12px;line-height:20px}.status-incident h3{font-size:15px;line-height:24px;margin:8px 0}.status-incident p{font-size:14px;line-height:1.7;color:var(--text2);white-space:pre-wrap}
.status-empty{display:flex;align-items:center;gap:12px;min-height:88px;padding:24px;border:1px solid var(--line);border-radius:12px;font-size:14px;color:var(--text2);background:var(--surface)}.status-services>.status-empty{border:0;border-radius:0}.status-empty svg{width:24px;height:24px;flex:none;color:var(--status-green)}
.status-placeholder{display:inline-block;width:160px;height:12px;border-radius:4px;background:var(--line)}.status-service-name .status-placeholder{height:20px}.status-service-health .status-placeholder{width:104px}.status-skeleton .status-strip{opacity:.5}
@media(prefers-color-scheme:dark){.status-page{--status-green:#79d6a0;--status-red:#ff9a90;--status-amber:#ebbb6b}}
@media(max-width:600px){.status-service-head{flex-direction:column;align-items:stretch;gap:16px}.status-service-health{justify-content:flex-start;max-width:none}.status-service{padding:24px 16px}.status-banner{padding:24px 16px;gap:16px}.status-strip{gap:2px}}
@media(max-width:380px){.status-service-health{column-gap:8px;font-size:11px}.status-strip{gap:1px}.status-banner{gap:12px}.status-banner h2{font-size:20px}}
@media(prefers-reduced-motion:no-preference){.status-service:not(.status-skeleton) .status-bar{animation:status-bar-in 240ms ease-out both}.status-bar:nth-child(3n+2){animation-delay:40ms!important}.status-bar:nth-child(3n){animation-delay:80ms!important}.status-banner[data-state=operational] .dot::after{content:"";position:absolute;inset:-8px;border-radius:50%;border:1px solid var(--status-green);animation:status-pulse 3s ease-out infinite}@keyframes status-bar-in{from{opacity:0;transform:scaleY(.7)}to{opacity:1;transform:scaleY(1)}}@keyframes status-pulse{0%,100%{opacity:0;transform:scale(.85)}40%{opacity:.3}80%{opacity:0;transform:scale(1.3)}}}

.stream-facts{display:grid;grid-template-columns:max-content 1fr;gap:4px 14px;margin:10px 0 0;font-size:13px}.stream-facts dt{color:var(--text2)}.stream-facts dd{margin:0}@media(max-width:480px){.stream-facts{grid-template-columns:1fr}.stream-facts dd{margin-bottom:6px}}

/* Discover: persistent controls, poster details and quiet loading placeholders. */
.discover-toolbar{position:sticky;top:0;z-index:20;background:var(--bg);padding:12px 0;border-bottom:1px solid var(--line)}
.discover-toolbar .discover-search{flex:1 1 240px;padding:0 4px 0 12px;min-height:44px}
.discover-search input{border:0;background:none;outline:0;min-width:0;width:100%;font-size:16px;min-height:44px}
.discover-search input::-webkit-search-cancel-button{display:none}.discover-search .btn{flex:none;width:44px;padding:0;font-size:24px}
.discover-toolbar .tabs{display:flex;flex-wrap:wrap;gap:4px}.discover-toolbar .tabs .pri{background:var(--accent);color:var(--ink)}
#catalogue .discover-grid{grid-template-columns:repeat(auto-fill,minmax(min(150px,100%),1fr));gap:24px 16px}
.discover-section{margin-bottom:28px}.discover-section:last-child{margin-bottom:0}
#catalogue .catcard{gap:6px;scroll-margin-top:180px}#catalogue .catcard>p{margin:0;max-height:none;overflow:visible}
.discover-open{display:block;width:100%;padding:0;border:0;background:none;text-align:left;cursor:pointer;border-radius:8px}
.discover-poster{background:var(--side);color:var(--text2);text-align:left;isolation:isolate}.discover-poster>span{text-shadow:none}
.discover-card-title{display:block;font-weight:500;margin-top:8px;overflow-wrap:anywhere}
.discover-badge{display:inline-flex;align-items:center;gap:6px;background:var(--surface);color:var(--text);border:1px solid var(--line2);border-radius:6px;padding:4px 8px;font-size:12px;line-height:1.4;font-weight:500}
.discover-badge::before{content:"";width:7px;height:7px;flex:none;border-radius:50%;background:var(--idle)}
.discover-badge[data-state=available]::before{background:var(--ok)}.discover-badge[data-state=requested]::before,.discover-badge[data-state=partial]::before{background:var(--warn)}
.discover-poster .discover-badge{position:absolute;inset:8px 8px auto auto;max-width:calc(100% - 16px);z-index:2}
.discover-request{margin-top:auto;padding-top:4px}.discover-request .btn{margin-top:0}.discover-request .err{margin:6px 0 0;overflow-wrap:anywhere}
.discover-skeleton .poster,.skeleton-line{background:var(--line);position:relative;overflow:hidden}.skeleton-line{height:14px;border-radius:4px;margin-top:10px}.skeleton-line.short{width:55%;height:12px}
#discover-dialog{width:680px;max-width:calc(100vw - 32px);max-height:calc(100svh - 32px);overflow:auto}
#discover-close{display:flex;margin-left:auto;margin-bottom:16px}.discover-detail{display:grid;grid-template-columns:minmax(0,180px) minmax(0,1fr);gap:24px}.discover-detail>*{min-width:0}.discover-detail h2{overflow-wrap:anywhere}.discover-detail p{overflow-wrap:anywhere}#discover-overview{white-space:pre-wrap}
@media(max-width:480px){#catalogue .discover-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 12px}.discover-toolbar .discover-search{max-width:none;flex-basis:100%}.discover-toolbar .btn{padding-inline:10px}.discover-detail{grid-template-columns:minmax(0,1fr);gap:16px}#discover-art{max-width:140px}#discover-dialog{padding:16px}}
@media(prefers-reduced-motion:no-preference){.discover-skeleton .poster::before,.discover-skeleton .skeleton-line::before{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent,var(--surface),transparent);animation:discover-shimmer 1.6s ease-in-out infinite;transform:translateX(-100%)}.discover-open .poster{transition:transform .16s var(--ease),box-shadow .16s var(--ease)}.discover-open:focus-visible .poster{transform:translateY(-3px);box-shadow:var(--sh)}
 @media(hover:hover) and (pointer:fine){.discover-open:hover .poster{transform:translateY(-3px);box-shadow:var(--sh)}}
}
@keyframes discover-shimmer{to{transform:translateX(100%)}}
@media(prefers-reduced-motion:reduce){.discover-toolbar .btn,.discover-request .btn,#discover-close{transition:none;transform:none}}

.requests-card .request-grid{list-style:none;padding:16px;grid-template-columns:repeat(auto-fill,minmax(min(150px,100%),1fr));gap:24px 16px}
.request-tile{gap:6px;scroll-margin-top:180px}.request-tile .discover-card-title{margin-top:2px}.request-date{font-size:12px}.request-grid-wide{grid-column:1/-1}
.request-tile .poster.has-img>span:not(.discover-badge){visibility:hidden}.request-tile .poster.has-img::before{display:none}
.discover-badge[data-state=approved]::before{background:var(--warn)}.discover-badge[data-state=declined]::before{background:var(--bad)}
@media(max-width:480px){.requests-card .request-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 12px;padding:12px}}

/* Keep the new arrivals on one keyboard-scrollable shelf, within the content width. */
.recent-section{min-width:0;max-width:100%}.recent-section h2{margin-bottom:12px}
.recent-shelf{display:flex;gap:16px;overflow-x:auto;max-width:100%;padding:4px 4px 16px;scroll-snap-type:x proximity;scroll-padding-inline:4px}
.recent-shelf>*{flex:0 0 150px;min-width:0;scroll-snap-align:start}.recent-tile{display:block;text-decoration:none;color:var(--text);border-radius:8px;overflow-wrap:anywhere}
.recent-tile .poster{width:100%}.recent-caption{display:block;margin-top:8px;font-weight:500}.recent-caption small{font-weight:400;color:var(--text2)}
.recent-tile:focus-visible,.recent-shelf:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media(max-width:480px){.recent-shelf{gap:12px}.recent-shelf>*{flex-basis:130px}}
@media(prefers-reduced-motion:reduce){.recent-shelf{scroll-snap-type:none;scroll-behavior:auto}}
/* Account settings share the member card and form tokens. */
.account-page{width:100%;max-width:700px;gap:18px;min-width:0}
/* Wide screens: fill the space beside the nav in balanced columns instead of one narrow strip. */
.account-page>.col,.prefs-page>.col{display:flex;flex-direction:column;gap:18px;min-width:0}
@media(min-width:1000px){div.account-page,div.prefs-page{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;max-width:1240px}}
.account-page .account{max-width:none;padding:18px 20px;min-width:0}
.account-page h2{margin-bottom:12px}.account-page h3{margin-top:16px}
.account-identity{display:flex;align-items:center;gap:16px;padding:4px 0 14px}.account-identity .avatar{width:68px;height:68px;font-size:26px}.account-name{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px}.account-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0 0 14px}.account-facts[hidden]{display:none}.account-facts>div{background:var(--surface2,rgba(127,127,127,.08));border:1px solid var(--line);border-radius:10px;padding:10px 12px;min-width:0}.account-facts dt{font-size:12px;color:var(--text2);margin-bottom:2px}.account-facts dd{margin:0;font-weight:600;overflow-wrap:anywhere}.account-facts .account-wide{grid-column:1/-1}.account-libs{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px}.account-libs .tag{font-weight:500;color:var(--text)}
.account-identity .avatar-slot{flex:none}.account-identity b{font-size:20px;overflow-wrap:anywhere}
.account-identity p+p{margin-top:4px}.account-expiry{margin-top:10px!important;font-weight:500}
.account-warning{color:light-dark(#80520b,#ebbb6b)}
.account-dot{width:8px;height:8px;border-radius:50%;background:var(--text2);flex:none}
.account-dot.verified{background:var(--ok)}
.account-nudge{padding:10px 12px;background:var(--soft);border-radius:6px;margin-bottom:10px}
.account-page .row{gap:12px;flex-wrap:wrap}.account-page .row>.grow{flex-basis:210px}
.account-page .row>.btn{max-width:100%;white-space:normal;text-align:center}
.account-browsers{list-style:none;padding:0;margin:8px 0 16px}.account-browsers .row{padding:12px 0}
.account-page button:disabled{opacity:.55;cursor:not-allowed}
.account-page .skeleton-line{max-width:280px}.account-page .skeleton-line.short{max-width:180px}
#account-signout-dialog,#alerts-dialog{max-height:calc(100svh - 32px);overflow:auto}
@media(max-width:480px){.account-page .account{padding:16px 12px}.account-page .row>.grow{flex-basis:160px}.account-page .row>.btn{margin-left:auto}.account-identity{align-items:flex-start}.account-page .inline-form{max-width:100%}}

/* Collapsible desktop sidebar: an icon rail, remembered per browser. */
.side-toggle{display:none}
@media(min-width:901px){.member-app .side-toggle{display:inline-flex;align-items:center;justify-content:center;margin-left:auto;width:32px;height:32px;padding:0;border:0;border-radius:8px;background:none;color:var(--text2);cursor:pointer}.side-toggle:hover{background:var(--line);color:var(--text)}.side-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.member-app.collapsed{grid-template-columns:64px 1fr}.member-app.collapsed .side{padding-inline:8px;overflow:hidden}.member-app.collapsed .brand{flex-direction:column;gap:12px;padding-inline:0}.member-app.collapsed .side-toggle{margin-left:0}
.member-app.collapsed .brandline b,.member-app.collapsed .nav>span,.member-app.collapsed .grp,.member-app.collapsed .identity,.member-app.collapsed .me .btn{display:none}
.member-app.collapsed .nav{justify-content:center;padding-inline:0}.member-app.collapsed .nav[aria-current=page]::before{left:-8px}.member-app.collapsed .me{justify-content:center;padding-inline:0}}

/* Member Settings page */
.prefs-page{width:100%;max-width:720px;gap:18px;min-width:0}.prefs{padding:20px;display:flex;flex-direction:column;gap:12px}.prefs h2{font-size:16px}
.prefs .row{display:flex;align-items:center;gap:16px;padding:12px 0;border-top:1px solid var(--line)}.prefs .row:first-of-type{border-top:0}.prefs .row .grow p{margin-top:2px}
.theme-choices{--pos:0;position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin:0;padding:4px;border:1px solid var(--line2);border-radius:14px;background:var(--bg)}.theme-choices:has(input[value=light]:checked){--pos:1}.theme-choices:has(input[value=dark]:checked){--pos:2}.theme-choices:has(input[value=oled]:checked){--pos:3}.theme-thumb{position:absolute;top:4px;bottom:4px;left:4px;width:calc((100% - 8px)/4);border-radius:10px;background:var(--soft);box-shadow:0 0 0 1.5px var(--accent) inset;transform:translateX(calc(var(--pos)*100%));transition:transform .28s cubic-bezier(.34,1.3,.64,1)}.theme-option{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 8px;border-radius:10px;cursor:pointer;color:var(--text2);transition:color .2s}.theme-option:has(input:checked){color:var(--accent)}.theme-option input{position:absolute;opacity:0;inset:0;margin:0;cursor:pointer}.theme-option:has(input:focus-visible){outline:2px solid var(--accent);outline-offset:2px}.theme-option .i{width:20px;height:20px;flex:none}@media(max-width:420px){.theme-option{flex-direction:column;gap:2px;min-height:56px;padding:0 2px;font-size:12px}}.theme-option b{font-weight:500}#theme-desc{margin-top:12px}@media(prefers-reduced-motion:reduce){.theme-thumb{transition:none}}
.theme-fade,.theme-fade *{transition:background-color .35s,color .35s,border-color .35s!important}
@media(max-width:600px){.prefs .row{flex-wrap:wrap}.prefs .row .btn{margin-left:auto}}

/* Toggle switches (use on input[type=checkbox][role=switch].toggle) */
input.toggle{appearance:none;-webkit-appearance:none;position:relative;flex:none;width:46px;height:26px;min-width:46px;margin:0;border:1px solid var(--line2);border-radius:999px;background:var(--line2);cursor:pointer;transition:background .15s,border-color .15s}
input.toggle::after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:transform .15s}
input.toggle:checked{background:var(--accent);border-color:var(--accent)}input.toggle:checked::after{transform:translateX(20px)}
input.toggle:focus-visible{outline:2px solid var(--accent);outline-offset:2px}input.toggle:disabled{opacity:.5;cursor:not-allowed}
@media(prefers-reduced-motion:reduce){input.toggle,input.toggle::after{transition:none}}
.switch-row{display:flex;align-items:center;justify-content:space-between;gap:24px}.switch-row p{margin-top:4px}
.check-label{display:flex;gap:12px;align-items:center}
:root[data-motion=reduce] *,:root[data-motion=reduce] *::before,:root[data-motion=reduce] *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
/* Maintenance settings */
.maint-pill{display:inline-flex;align-items:center;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid var(--line2);color:var(--text2)}.maint-pill[data-state=on]{color:var(--warn);border-color:var(--warn);background:color-mix(in srgb,var(--warn) 12%,var(--surface))}.maint-pill[data-state=sched]{color:var(--accent);border-color:var(--accent);background:var(--soft)}
.maint-window{border:1px solid var(--line2);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}.maint-window legend{padding:0 6px;font-weight:600}.maint-window-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.maint-banner{display:block;margin-bottom:16px;border:1px solid var(--warn);background:color-mix(in srgb,var(--warn) 10%,var(--surface))}
/* Member settings toggles */
.prefs .switch-row{padding:12px 0;border-top:1px solid var(--line)}.prefs .switch-row:first-of-type{border-top:0}.prefs .inline-confirm{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;padding:0 0 12px}.prefs .inline-confirm .field{flex:1;min-width:200px}
.account .inline-confirm{display:flex;flex-wrap:wrap;align-items:center;gap:12px 8px;padding:12px 0 8px}.account .inline-confirm label{flex:1 1 100%;display:flex;flex-direction:column;gap:8px}.account .inline-confirm .btn{min-height:44px}.account .inline-confirm+.err:empty{display:none}

/* In-page confirmation bar (replaces the browser's confirm pop-up) */
.inline-confirm-bar{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:90;width:min(560px,calc(100vw - 32px));display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 16px;padding:14px 16px;background:var(--surface);border:1px solid var(--line2);border-left:4px solid var(--warn);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.45)}
.inline-confirm-bar p{flex:1 1 240px;margin:0}.inline-confirm-bar .actions{display:flex;gap:8px;margin:0}
@media(prefers-reduced-motion:no-preference){.inline-confirm-bar{animation:confirm-in .18s var(--ease)}@keyframes confirm-in{from{opacity:0;transform:translate(-50%,12px)}}}

/* Tablet and phone layout */
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
.mobilebar{position:sticky;top:0;z-index:60;border-bottom:1px solid var(--line)}
@media(min-width:701px){.member-app>.side{position:sticky;top:0;align-self:start;height:100svh;overflow-y:auto;overscroll-behavior:contain}}
/* Portrait tablets and landscape phones: a slim icon rail instead of the Menu bar, so the page keeps its width and navigation stays one tap away. */
@media(min-width:701px) and (max-width:900px){
.member-app{grid-template-columns:64px minmax(0,1fr)}
.mobilebar{display:none}
.member-app>.side{display:flex;flex-direction:column;padding:16px 8px;overflow-x:hidden;border-bottom:0;border-right:1px solid var(--line)}
.member-app>.side .brand,.member-app>.side .me{display:flex}
.member-app>.side .nav{width:100%;white-space:normal}.member-app>.side .nav[aria-current=page]::before{display:block}
.member-app .side-toggle{display:none}
.member-app>.side .brandline b,.member-app>.side .nav>span,.member-app>.side .grp,.member-app>.side .identity,.member-app>.side .me .btn{display:none}
.member-app>.side .brand{padding-inline:0;justify-content:center}
.member-app>.side .nav{justify-content:center;padding-inline:0}
.member-app>.side .nav[aria-current=page]::before{left:-8px}
.member-app>.side .me{justify-content:center;padding-inline:0}
}
/* Phones: 16px form text stops iOS zooming into fields, and the page gets comfortable side gutters. */
@media(max-width:700px){input,select,textarea,.field,.field input{font-size:16px}.main{padding-inline:16px}}
@media(max-height:500px) and (orientation:landscape){.center{align-items:flex-start;padding-block:16px}}
.admin-page.admin-streams{max-width:none}.streams-map[hidden]{display:none}.streams-split:has(.streams-map[hidden]){grid-template-columns:minmax(0,1fr)}.streams-split{grid-template-columns:repeat(2,minmax(0,1fr))}.streams-map{position:sticky;top:16px}.streams-map .map-pin{position:relative}.streams-map .map-pin::after{content:'';position:absolute;inset:-2px;border-radius:50%;background:var(--accent);opacity:.6;pointer-events:none;animation:pin-pulse 2s ease-out infinite}@keyframes pin-pulse{to{transform:scale(3);opacity:0}}@media(prefers-reduced-motion:reduce){.streams-map .map-pin::after{animation:none;opacity:.25;transform:scale(1.8)}}.streams-map #map{height:min(640px,70vh)}.streams-split .stream-head{flex-wrap:wrap}.streams-split .stream-head .grow{flex:1 1 180px;min-width:0}.streams-split .stream-head .prog{width:90px;flex:none}.streams-split .stream-head>.btn{flex:none;white-space:nowrap;margin-left:auto}@media(max-width:1100px){.streams-split{grid-template-columns:minmax(0,1fr)}.streams-map{position:static}}
#map .maplibregl-popup-content{background:var(--surface);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:12px 28px 12px 14px;font-size:14px;line-height:1.4;box-shadow:0 6px 20px rgba(0,0,0,.35)}#map .maplibregl-popup-content b{display:block;font-size:15px;margin-bottom:2px}#map .maplibregl-popup-content p{margin:0;color:var(--text2)}#map .maplibregl-popup-close-button{color:var(--text2);font-size:20px;width:28px;height:28px}#map .maplibregl-popup-close-button:hover{background:var(--line);color:var(--text)}
.maplibregl-popup-anchor-top .maplibregl-popup-tip,#map .maplibregl-popup-anchor-top-left .maplibregl-popup-tip,#map .maplibregl-popup-anchor-top-right .maplibregl-popup-tip{border-bottom-color:var(--surface)}#map .maplibregl-popup-anchor-bottom .maplibregl-popup-tip,#map .maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip,#map .maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip{border-top-color:var(--surface)}#map .maplibregl-popup-anchor-left .maplibregl-popup-tip{border-right-color:var(--surface)}#map .maplibregl-popup-anchor-right .maplibregl-popup-tip{border-left-color:var(--surface)}
` + adminSettingsCss + authPagesCss + notFoundCss + adminUsersCss + adminSecurityCss + historyCss + helpCss + wrappedCss + tourCss + scrollCss + homeCss + mobileCss;
