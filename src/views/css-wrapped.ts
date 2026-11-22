// Styles for the yearly Wrapped story and the Help page Quick Connect box. Appended to the shared stylesheet by css.ts.
export const wrappedCss = String.raw`
.help-qc{margin-top:8px;padding-top:12px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:8px}
.help-qc-row{display:flex;flex-wrap:wrap;gap:8px}.help-qc-row .field{flex:1 1 130px;min-width:0;letter-spacing:.2em;font-variant-numeric:tabular-nums;font-size:16px}
.help-qc-result:empty{display:none}
.wrapped-top{margin-bottom:16px}.wrapped-year{display:flex;align-items:center;gap:8px;color:var(--text2)}.wrapped-year .field{min-height:36px;padding-block:4px}
.wrapped{position:relative;width:min(100%,440px);aspect-ratio:9/16;max-height:calc(100svh - 200px);min-height:520px;margin:0 auto 12px;border-radius:24px;overflow:hidden;color:#fff;background:#10201f;box-shadow:0 20px 60px rgba(0,0,0,.35);outline-offset:4px;isolation:isolate}
.wrapped:focus-visible{outline:2px solid var(--accent)}
.wrapped.is-empty{aspect-ratio:auto;min-height:0;max-height:none;background:var(--surface);color:var(--text);border:1px solid var(--line);box-shadow:none}
.wrapped-loading{padding:32px;color:rgba(255,255,255,.8)}.w-empty{padding:32px;display:flex;flex-direction:column;gap:8px}
.wrapped-note{text-align:center;margin-bottom:24px}
.w-slide{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;gap:16px;padding:56px 28px 40px;overflow:hidden}
.w-a{background:linear-gradient(160deg,#0f766e,#312e81)}.w-b{background:linear-gradient(160deg,#be185d,#f59e0b)}.w-c{background:linear-gradient(160deg,#5b21b6,#2563eb)}
.w-d{background:linear-gradient(160deg,#047857,#0e7490)}.w-e{background:linear-gradient(160deg,#b91c1c,#7c2d12)}.w-f{background:linear-gradient(160deg,#1d4ed8,#0891b2)}
.w-g{background:linear-gradient(160deg,#7e22ce,#be185d)}.w-i{background:linear-gradient(160deg,#0369a1,#4338ca)}.w-j{background:linear-gradient(160deg,#c2410c,#9d174d)}.w-k{background:linear-gradient(160deg,#15803d,#0f766e)}.w-h{background:linear-gradient(160deg,#134e4a,#0f172a)}
.w-kicker{font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.85}
.wrapped .w-title{font-size:clamp(30px,9vw,44px);font-weight:800;line-height:1.08;letter-spacing:-.02em;overflow-wrap:anywhere}.wrapped .w-title.w-xl{font-size:clamp(40px,12vw,60px)}
.w-lead{font-size:18px;line-height:1.4;opacity:.92}
.w-big{font-size:clamp(72px,24vw,120px);font-weight:800;line-height:1;letter-spacing:-.04em;font-variant-numeric:tabular-nums}.w-big.w-sm{font-size:clamp(48px,14vw,72px)}
.w-poster{width:min(46%,170px);aspect-ratio:2/3;object-fit:cover;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.45);background:rgba(0,0,0,.25)}
.w-list{list-style:none;padding:0;display:flex;flex-direction:column;gap:8px;margin:4px 0 0;font-size:15px}
.w-list li{display:flex;gap:10px;align-items:baseline;padding:8px 12px;border-radius:10px;background:rgba(255,255,255,.14)}
.w-rank{font-weight:800;opacity:.75;width:1.2em}.w-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.w-val{font-variant-numeric:tabular-nums;font-weight:700}
.w-split{height:18px;border-radius:999px;background:rgba(255,255,255,.28);overflow:hidden}.w-split i{display:block;height:100%;width:var(--w,50%);background:#fff;border-radius:999px}
.w-months{display:flex;align-items:flex-end;gap:4px;height:150px;margin-top:8px}.w-month{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;font-size:11px;opacity:.9}
.w-month i{display:block;width:100%;height:var(--h,0);min-height:0;border-radius:4px 4px 2px 2px;background:rgba(255,255,255,.6)}.w-month.is-top i{background:#fff}
.w-facts{list-style:none;padding:0;display:flex;flex-direction:column;gap:12px}.w-facts li{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.14)}.w-facts b{font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.85}.w-facts span{font-size:17px}
.w-final{display:flex;flex-direction:column;gap:8px}.w-final-line{font-size:17px;font-weight:600}
.w-actions{display:flex;flex-wrap:wrap;gap:10px;position:relative;z-index:6;margin-top:8px}.w-actions .btn{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.4);color:#fff}.w-actions .btn.pri{background:#fff;color:#0f172a;border-color:#fff}
.w-progress{position:absolute;top:14px;left:14px;right:14px;display:flex;gap:4px;z-index:5}.w-bar{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.3);overflow:hidden}.w-bar i{display:block;height:100%;width:0;background:#fff}.w-bar.is-done i{width:100%}.w-bar.is-current i{width:100%}
.w-tap{position:absolute;top:30px;bottom:0;width:34%;z-index:4;border:0;background:transparent;padding:0;pointer-events:none}.w-prev{left:0}.w-next{right:0;width:66%}.w-tap:disabled{cursor:default}.w-tap:focus-visible{outline:2px solid #fff;outline-offset:-4px}
@media(prefers-reduced-motion:no-preference){
:root:not([data-motion=reduce]) .w-bar.is-current i{width:0;animation:w-fill 7s linear forwards}
:root:not([data-motion=reduce]) .wrapped:hover .w-bar.is-current i,:root:not([data-motion=reduce]) .wrapped:focus-within .w-bar.is-current i{animation-play-state:paused}
:root:not([data-motion=reduce]) .w-slide.is-active .w-in{animation:w-rise .6s var(--ease) both;animation-delay:calc(var(--d,0)*120ms)}
:root:not([data-motion=reduce]) .w-slide.is-active .w-month i{animation:w-grow .8s var(--ease) both;animation-delay:calc(var(--i,0)*45ms + 300ms)}
:root:not([data-motion=reduce]) .w-slide.is-active .w-split i{animation:w-wide .9s var(--ease) both .3s}
:root:not([data-motion=reduce]) .w-slide.is-active .w-poster{animation:w-pop .7s var(--ease) both}
@keyframes w-fill{to{width:100%}}@keyframes w-rise{from{opacity:0;transform:translateY(18px)}}@keyframes w-grow{from{height:0}}@keyframes w-wide{from{width:0}}@keyframes w-pop{from{opacity:0;transform:scale(.8) rotate(-4deg)}}
}
@media(max-width:600px){.wrapped{width:100%;max-height:none;min-height:0;aspect-ratio:9/15;border-radius:20px}.w-slide{padding:52px 20px 32px}.wrapped-top .wrapped-year{font-size:13px}}

/* Wrapped: posters, confetti, tilt, comparisons and the share card */
.w-slide>*{position:relative;z-index:1}.w-slide .w-actions{z-index:6}.w-slide>.w-collage,.w-slide>.w-confetti,.w-slide>.w-rings{position:absolute;z-index:0}
.w-collage{inset:-14%;display:flex;gap:10px;transform:rotate(-9deg);opacity:.34;pointer-events:none}
.w-col{flex:1;display:flex;flex-direction:column;gap:10px}.w-col:nth-child(even){margin-top:-60px}
.w-col img{display:block;width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:10px;background:rgba(0,0,0,.25)}
.w-slide.has-collage::after{content:"";position:absolute;inset:0;z-index:0;background:linear-gradient(180deg,rgba(15,23,42,.15),rgba(15,23,42,.55));pointer-events:none}
.w-confetti{inset:0;overflow:hidden;pointer-events:none}.w-confetti i{position:absolute;top:-12px;left:var(--x);width:8px;height:14px;border-radius:2px;opacity:0;transform:rotate(var(--r))}
.w-rings{inset:0;display:grid;place-items:center;pointer-events:none}.w-rings i{position:absolute;width:60%;aspect-ratio:1;border-radius:50%;border:2px solid rgba(255,255,255,.35);opacity:0}
.w-tilt{position:relative;width:min(46%,170px);perspective:600px;transform-style:preserve-3d}.w-tilt .w-poster{width:100%;transform:rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transition:transform .15s ease-out}
.w-shine{position:absolute;inset:0;border-radius:12px;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.45) 48%,transparent 66%);background-size:250% 100%;background-position:150% 0;pointer-events:none}
.w-gbars{display:flex;flex-direction:column;gap:12px;margin-top:6px}.w-gbar{display:grid;grid-template-columns:minmax(70px,28%) 1fr auto;gap:10px;align-items:center;font-size:15px}.w-gbar i{display:block;height:14px;border-radius:7px;background:#fff;width:var(--w);justify-self:start}.w-gname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.w-factcards{list-style:none;padding:0;display:flex;flex-direction:column;gap:10px;margin:0}.w-factcards li{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.16);border-left:4px solid #fff}.w-factcards b{font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.85}.w-factcards span{font-size:16px;line-height:1.35}
.w-icon{width:84px;height:84px;fill:none;stroke:#fff;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.w-sharecard{display:block;width:min(52%,200px);aspect-ratio:9/16;height:auto;border-radius:14px;box-shadow:0 14px 36px rgba(0,0,0,.45);margin:0 auto}
.w-final .w-actions,.w-slide.w-h .w-actions{justify-content:center}
@media(prefers-reduced-motion:no-preference){
:root:not([data-motion=reduce]) .w-slide.is-active{animation:w-slide-in .5s var(--ease)}
:root:not([data-motion=reduce]) .w-slide.is-active .w-col{animation:w-colmove 22s ease-in-out infinite alternate}:root:not([data-motion=reduce]) .w-slide.is-active .w-col:nth-child(even){animation-direction:alternate-reverse}
:root:not([data-motion=reduce]) .w-slide.is-active .w-confetti i{animation:w-fall var(--t,4s) linear var(--d,0s) infinite}
:root:not([data-motion=reduce]) .w-slide.is-active .w-rings i{animation:w-ring 3.2s ease-out infinite}:root:not([data-motion=reduce]) .w-slide.is-active .w-rings i:nth-child(2){animation-delay:1s}:root:not([data-motion=reduce]) .w-slide.is-active .w-rings i:nth-child(3){animation-delay:2s}
:root:not([data-motion=reduce]) .w-slide.is-active .w-shine{animation:w-shine 1.6s ease .6s 1 both}
:root:not([data-motion=reduce]) .w-slide.is-active .w-gbar i{animation:w-wide2 .9s var(--ease) both;animation-delay:calc(var(--i,0)*120ms + 250ms)}
:root:not([data-motion=reduce]) .w-slide.is-active .w-factcards li{animation:w-rise .55s var(--ease) both;animation-delay:calc(var(--i,0)*180ms + 250ms)}
:root:not([data-motion=reduce]) .w-slide.is-active .w-icon{animation:w-float 3s ease-in-out infinite}
:root:not([data-motion=reduce]) .w-slide.is-active .w-sharecard{animation:w-pop .8s var(--ease) both}
@keyframes w-slide-in{from{opacity:0;transform:scale(1.04)}}@keyframes w-colmove{from{transform:translateY(-4%)}to{transform:translateY(4%)}}
@keyframes w-fall{0%{opacity:0;transform:translateY(0) rotate(var(--r))}10%{opacity:1}100%{opacity:0;transform:translateY(560px) rotate(calc(var(--r) + 540deg))}}
@keyframes w-ring{0%{opacity:.7;transform:scale(.3)}100%{opacity:0;transform:scale(1.4)}}@keyframes w-shine{to{background-position:-60% 0}}@keyframes w-wide2{from{width:0}}@keyframes w-float{50%{transform:translateY(-8px) rotate(4deg)}}
}

/* Wrapped v2: controls, backdrops, new slides, share card chooser */
.w-bar{border:0;padding:6px 0;height:15px;background:transparent;cursor:pointer;position:relative}.w-bar::before{content:"";position:absolute;left:0;right:0;top:6px;height:3px;border-radius:2px;background:rgba(255,255,255,.3)}.w-bar i{position:absolute;left:0;top:6px;height:3px;border-radius:2px}.w-bar:focus-visible{outline:2px solid #fff;outline-offset:1px}
.w-progress{align-items:flex-start;top:8px}
.w-bar.is-done i{width:100%}
.w-pause{position:absolute;top:26px;right:14px;z-index:6;min-width:34px;height:34px;border-radius:17px;border:1px solid rgba(255,255,255,.45);background:rgba(15,23,42,.35);color:#fff;font-size:12px;cursor:pointer;backdrop-filter:blur(6px)}.w-pause:focus-visible{outline:2px solid #fff;outline-offset:2px}
.w-sound{position:absolute;top:26px;right:56px;z-index:6;min-width:34px;height:34px;border-radius:17px;border:1px solid rgba(255,255,255,.45);background:rgba(15,23,42,.35);color:#fff;font-size:16px;cursor:pointer;backdrop-filter:blur(6px);overflow:hidden}.w-sound.is-off{opacity:.8}.w-sound.is-off::after{content:"";position:absolute;left:6px;right:6px;top:50%;height:2px;background:#fff;transform:rotate(-45deg)}.w-sound:focus-visible{outline:2px solid #fff;outline-offset:2px}
.wrapped.is-paused .w-bar.is-current i{animation-play-state:paused!important}
.w-backdrop{position:absolute!important;inset:-10%;width:120%;height:120%;object-fit:cover;filter:blur(28px) saturate(1.2);opacity:.38;z-index:0;pointer-events:none;transform:scale(1.1)}
.w-dayparts{list-style:none;padding:0;margin:4px 0 0;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.w-dayparts li{display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 4px;border-radius:12px;background:rgba(255,255,255,.16)}.w-dayparts b{font-size:20px}.w-dayparts span{font-size:12px;opacity:.9}
.w-bookends{display:flex;flex-direction:column;gap:14px}.w-bookend{display:flex;gap:14px;align-items:center;padding:12px;border-radius:14px;background:rgba(255,255,255,.14)}.w-bookend .w-poster{width:64px;flex:none}.w-bookend>div{display:flex;flex-direction:column;gap:2px;min-width:0}.w-bookend b{font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.85}.w-bookend span{font-size:18px;font-weight:700;overflow-wrap:anywhere}.w-bookend small{opacity:.85}
.w-cardtabs{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;position:relative;z-index:6}.w-cardtab{border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.12);color:#fff;border-radius:999px;padding:6px 14px;font-size:13px;cursor:pointer}.w-cardtab[aria-pressed=true]{background:#fff;color:#0f172a;border-color:#fff}.w-cardtab:focus-visible{outline:2px solid #fff;outline-offset:2px}
.w-previewbox{display:grid;place-items:center;min-height:0;flex:1}.w-previewbox .w-sharecard{width:auto;height:min(100%,52svh);max-height:420px;aspect-ratio:9/16}
@media(min-width:900px){.wrapped{width:min(100%,500px)}}
@media(prefers-reduced-motion:no-preference){
:root:not([data-motion=reduce]) .wrapped[data-dir=next] .w-slide.is-active{animation:w-slide-next .45s var(--ease)}
:root:not([data-motion=reduce]) .wrapped[data-dir=prev] .w-slide.is-active{animation:w-slide-prev .45s var(--ease)}
@keyframes w-slide-next{from{opacity:0;transform:translateX(5%)}}@keyframes w-slide-prev{from{opacity:0;transform:translateX(-5%)}}
}
`;
