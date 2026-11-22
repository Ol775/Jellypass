// Styles for the animated sign-in, 404 and maintenance pages. Owned by the auth-pages redesign; appended by css.ts.
export const authPagesCss = String.raw`
:is(.auth-anim,.err-page,.maint-page){isolation:isolate;min-width:0}
:is(.auth-anim,.err-page,.maint-page) .center{grid-template-columns:minmax(0,1fr);padding:32px 16px;min-height:100svh}
:is(.auth-anim,.err-page,.maint-page) .authcard{position:relative;min-width:0;background:var(--surface);border-color:var(--line2);box-shadow:var(--sh),0 24px 64px var(--line);gap:20px}
:is(.auth-anim,.err-page,.maint-page) h1{line-height:1.2;margin-bottom:10px}
:is(.auth-anim,.err-page,.maint-page) .poster-wall{background:var(--bg)}
:is(.auth-anim,.err-page,.maint-page) .poster-wall img{filter:saturate(1.15);opacity:.56;animation:none}
:is(.auth-anim,.err-page,.maint-page) .poster-wall::after{background:radial-gradient(ellipse at center,transparent,var(--bg)),linear-gradient(transparent,var(--bg))}
:is(.auth-anim,.err-page,.maint-page) .btn{transition:none;transform:none}
:is(.auth-anim,.err-page,.maint-page) :focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.auth-anim .brandline .mark{position:relative;overflow:hidden}
.auth-anim .brandline .mark::after{content:"";position:absolute;inset:-50%;background:linear-gradient(110deg,transparent 40%,var(--surface) 50%,transparent 60%);opacity:0;transform:translateX(-100%);pointer-events:none}
.auth-anim .field:focus{border-color:var(--accent);box-shadow:0 0 0 4px var(--soft)}
.auth-anim #signin>.btn.pri{position:relative;overflow:hidden}
.auth-anim #signin>.btn.pri::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(100deg,transparent,var(--soft),var(--surface),transparent);opacity:0;transform:translateX(-100%)}
.auth-anim #signin[aria-busy=true]>.btn.pri{opacity:.8;cursor:wait;border-style:dashed;border-color:var(--text)}
@media(prefers-reduced-motion:no-preference){
  :is(.auth-anim,.err-page,.maint-page) .authcard{animation:auth-card-in .4s var(--ease) both}
  .auth-anim #signin>div:first-child,.auth-anim #signin>div:nth-child(2){animation:auth-field-in .28s var(--ease) both;animation-delay:.08s}
  .auth-anim #signin>div:nth-child(2){animation-delay:.14s}
  .auth-anim #signin:focus-within>div{animation:none}
  .auth-anim .brandline .mark::after{animation:auth-glint 1.4s var(--ease) .4s}
  .auth-anim .field{transition:border-color .12s var(--ease),box-shadow .12s var(--ease)}
  :is(.auth-anim,.err-page,.maint-page) .btn{transition:background .1s var(--ease),transform .1s var(--ease)}
  :is(.auth-anim,.err-page,.maint-page) .btn:active:not(:disabled){transform:translateY(1px) scale(.99)}
  .auth-anim #signin[aria-busy=true]>.btn.pri::after{animation:auth-loading 1.8s ease-in-out infinite}
  :is(.auth-anim,.err-page,.maint-page) .poster-wall img{animation:auth-poster-drift 48s ease-in-out infinite alternate}
  :is(.auth-anim,.err-page,.maint-page) .poster-wall img:nth-child(2n){animation-direction:alternate-reverse}
  @keyframes auth-card-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  @keyframes auth-field-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes auth-glint{0%{opacity:0;transform:translateX(-100%)}30%{opacity:.35}100%{opacity:0;transform:translateX(100%)}}
  @keyframes auth-loading{0%{opacity:0;transform:translateX(-100%)}50%{opacity:.2}100%{opacity:0;transform:translateX(100%)}}
  @keyframes auth-poster-drift{from{transform:translate(-8px,-48px) rotate(-3deg)}to{transform:translate(8px,16px) rotate(-3deg)}}
  @keyframes auth-cog-turn{to{transform:rotate(360deg)}}
  /* Three-column mobile rows need the same direction in each column. */
  @media(max-width:600px){
    :is(.auth-anim,.err-page,.maint-page) .poster-wall img:nth-child(n){animation-direction:alternate}
    :is(.auth-anim,.err-page,.maint-page) .poster-wall img:nth-child(3n+2){animation-direction:alternate-reverse}
  }
}
@media(max-width:420px){
  :is(.auth-anim,.err-page,.maint-page) .authcard{padding:22px 20px}
}

/* Cinema scenes share the existing theme tokens, but leave sign-in layout alone. */
:is(.err-page,.maint-page) .authcard{max-width:512px;padding:32px;gap:24px;border-radius:12px;overflow:hidden;isolation:isolate}
:is(.err-page,.maint-page) .authcard>.brandline{font-size:14px}
:is(.err-page,.maint-page) h1{font-size:clamp(26px,6vw,32px);letter-spacing:-.035em;line-height:1.25;margin:0 0 8px}
:is(.err-page,.maint-page) .muted{line-height:1.6;max-width:40ch}
:is(.err-page,.maint-page) .actions{gap:8px;align-items:stretch}
:is(.err-page,.maint-page) .actions .btn{flex:1 1 144px}
:is(.err-page,.maint-page) .btn:hover{border-color:var(--accent)}
.scene-label{font-size:12px;letter-spacing:.06em;color:var(--text2);margin-bottom:8px}
.cinema-scene{position:relative;display:grid;place-items:center;min-width:0;height:224px;margin:0 -32px;overflow:hidden;background:radial-gradient(ellipse at 50% 55%,var(--soft),transparent 70%);border-block:1px solid var(--line);color:var(--accent)}
.maintenance-status{display:grid;gap:16px}.maintenance-status p{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2)}
.status-dot{width:8px;height:8px;flex:none;border-radius:50%;background:var(--warn);box-shadow:0 0 0 4px color-mix(in srgb,var(--warn) 12%,transparent)}
.maintenance-progress{height:4px;overflow:hidden;background:var(--line);border-radius:2px}.maintenance-progress span{display:block;width:40%;height:100%;background:var(--accent);position:relative;overflow:hidden}.maintenance-progress span::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,var(--surface),transparent);opacity:0}
.maintenance-message{padding:16px;border-left:2px solid var(--accent);background:var(--soft);color:var(--text);font-size:13px;line-height:1.6;overflow-wrap:anywhere}.maintenance-message b{display:block;margin-bottom:8px}.maintenance-message p{white-space:pre-wrap}
.retry-actions{display:grid;gap:16px;min-height:80px;align-content:start}.retry-countdown{min-height:20px;text-align:center;font-size:12px;color:var(--text2);line-height:20px}.retry-countdown span{display:inline-block;min-width:2ch;font-variant-numeric:tabular-nums}
:is(.auth-anim,.err-page,.maint-page) .poster-wall::before{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;opacity:0;background:radial-gradient(circle 320px at var(--spot-x,50%) var(--spot-y,50%),color-mix(in srgb,var(--surface) 30%,transparent),transparent)}
:is(.auth-anim,.err-page,.maint-page) .poster-wall::after{z-index:2;background:radial-gradient(ellipse at center,transparent 20%,color-mix(in srgb,var(--bg) 80%,transparent) 100%),linear-gradient(transparent 65%,var(--bg))}
@media(prefers-reduced-motion:no-preference){
  .reel-a{animation:pj-spin 5s linear infinite}.reel-b{animation:pj-spin 5s linear infinite reverse}.pj-arm{animation:pj-tinker 1.3s ease-in-out infinite alternate}.pj-tool{animation:pj-twist .45s ease-in-out infinite alternate}.pj-sparks{animation:pj-spark 1.3s steps(2,end) infinite}.pj-beam{animation:pj-flicker 2.4s ease-in-out infinite}.pj-led{animation:pj-pulse 1.6s ease-in-out infinite}
  @keyframes pj-spin{to{transform:rotate(360deg)}}
  @keyframes pj-tinker{from{transform:rotate(-1.5deg)}to{transform:rotate(1.5deg)}}
  @keyframes pj-twist{from{transform:rotate(-4deg)}to{transform:rotate(4deg)}}
  @keyframes pj-spark{0%,100%{opacity:0}50%{opacity:1}}
  @keyframes pj-flicker{0%,100%{opacity:.85}45%{opacity:.65}55%{opacity:.95}}
  @keyframes pj-pulse{50%{opacity:.55;transform:scale(.9)}}
  .status-dot{animation:cinema-pulse 3s ease-in-out infinite}
  .maintenance-progress span{animation:cinema-progress 2.8s ease-in-out infinite}.maintenance-progress span::after{animation:auth-loading 1.4s ease-in-out infinite}
  @media(hover:hover) and (pointer:fine){:root:not([data-motion=reduce]) .poster-wall[data-spotlight]::before{opacity:1}}
  @keyframes cinema-clap{0%,65%,85%,100%{transform:rotate(0)}72%{transform:rotate(-10deg)}}
  @keyframes cinema-pulse{50%{opacity:.5;transform:scale(.85)}}
  @keyframes cinema-progress{from{transform:translateX(-110%)}to{transform:translateX(360%)}}
}
@media(max-width:420px){
  :is(.err-page,.maint-page) .authcard{padding:24px;gap:24px}
  .cinema-scene{margin-inline:-24px;height:192px}
}
.maint-page .admin-link{margin-top:4px;font-size:12px;text-align:center}.maint-page .admin-link a{color:var(--text3);text-decoration:none}.maint-page .admin-link a:hover,.maint-page .admin-link a:focus-visible{color:var(--accent);text-decoration:underline}
/* Poster wall v2: evenly spaced columns inside one rotated field, so posters always line up and cover every screen size. */
.poster-wall{display:block}
.poster-wall .poster-field{position:absolute;left:50%;top:50%;display:flex;align-items:flex-start;gap:12px;transform:translate(-50%,-50%) rotate(-8deg)}
.poster-wall .poster-col{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:12px}
.poster-wall .poster-field .poster-col img{display:block;width:100%;height:auto;aspect-ratio:2/3;object-fit:cover;margin:0;border-radius:10px;opacity:.5;filter:saturate(1.1);transform:none;animation:none}
@media(prefers-reduced-motion:no-preference){
  :root:not([data-motion=reduce]) .poster-wall .poster-col{animation:wall-drift var(--wall-dur,64s) ease-in-out infinite alternate}
  :root:not([data-motion=reduce]) .poster-wall .poster-col:nth-child(even){animation-direction:alternate-reverse}
  @keyframes wall-drift{from{transform:translateY(-2.5%)}to{transform:translateY(2.5%)}}
}
.service-scene{display:grid;place-items:center}
.maint-services{display:grid;gap:8px}.maint-services h2{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text3);margin:0}
.maint-services ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.maint-services li{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);font-size:14px}
.svc-dot{width:10px;height:10px;flex:none;border-radius:50%;background:var(--idle)}.svc-dot.up{background:var(--ok);box-shadow:0 0 0 4px color-mix(in srgb,var(--ok) 16%,transparent)}.svc-dot.down{background:var(--bad);box-shadow:0 0 0 4px color-mix(in srgb,var(--bad) 16%,transparent)}
.svc-name{font-weight:600}.svc-state{color:var(--text2);font-size:13px;margin-right:auto}
.svc-link{color:var(--accent);font-weight:600;font-size:13px;text-decoration:none;padding:6px 4px;min-height:32px;display:inline-flex;align-items:center}.svc-link:hover{text-decoration:underline}
.pj-scene{width:min(340px,92%);height:auto;overflow:visible}
.pj-scene *{transform-box:fill-box}.pj-reel,.pj-led{transform-origin:center}.pj-scene .pj-arm{transform-box:view-box;transform-origin:159px 105px}.pj-tool{transform-origin:right center}
.pj-shadow{fill:url(#pj-ground)}.pj-beam{opacity:.85}.pj-glow{fill:url(#pj-glow)}
.pj-screen-frame{fill:url(#pj-dark)}.pj-screen{fill:color-mix(in srgb,var(--surface) 92%,var(--accent))}
.pj-leg,.pj-dark,.pj-pants,.pj-cap{fill:url(#pj-dark)}.pj-body,.pj-reel-rim,.pj-reel-face{fill:url(#pj-metal)}
.pj-highlight{fill:#fff;opacity:.28}.pj-shade{fill:#102924;opacity:.18}
.pj-lens,.pj-shirt,.pj-sleeve,.pj-box{fill:url(#pj-teal)}.pj-glass{fill:url(#pj-glass)}
.pj-panel{fill:var(--bg)}.pj-led{fill:var(--ok)}.pj-film{fill:color-mix(in srgb,var(--text3) 30%,#162723)}
.pj-reel-slots{fill:url(#pj-dark)}.pj-hub{fill:var(--text3)}.pj-perfs{fill:var(--surface);opacity:.65}
.pj-screw{fill:var(--text2)}.pj-vents{fill:var(--bg);opacity:.65}
.pj-shoe{fill:url(#pj-shoe)}.pj-sole{fill:var(--text3)}.pj-skin{fill:url(#pj-skin)}
.pj-collar,.pj-cuff,.pj-box-lid{fill:color-mix(in srgb,var(--accent) 70%,#123b37)}.pj-cap-brim,.pj-handle{fill:url(#pj-shoe)}
.pj-eye{fill:#3c3028}.pj-detail{fill:none;stroke:var(--text2);stroke-width:1;stroke-linecap:round}
.pj-tool-grip{fill:var(--warn)}.pj-sparks{opacity:.65}.pj-sparks path{fill:none;stroke:var(--warn);stroke-width:1.5;stroke-linecap:round}

`;
