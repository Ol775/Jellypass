// Activated only by the signed-in shell; Wrapped returns before activation.
export const scrollCss = String.raw`
:root[data-scroll-app]{--scroll-bar:0px;--scroll-tools:0px;scroll-padding-top:calc(var(--scroll-bar) + var(--scroll-tools) + 16px);scrollbar-gutter:stable;scrollbar-width:thin;scrollbar-color:var(--text3) var(--bg)}
:root[data-scroll-app] .member-app :is([id],a,button,input,select,textarea,summary,[tabindex]):not(#map,#map *){scroll-margin-block:16px}
:root[data-scroll-app] :is(.side,dialog,#user-panel,.cat article>p,.settings-tabs,.recent-shelf){overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--text3) var(--surface)}
:root[data-scroll-app] :is(dialog,#user-panel){scrollbar-gutter:stable;scroll-padding-block:16px}
:root[data-scroll-app] :is(.recent-shelf,.settings-tabs){scroll-snap-type:x proximity;scroll-padding-inline:4px;-webkit-overflow-scrolling:touch}
:root[data-scroll-app] :is(.recent-shelf,.settings-tabs)>*{scroll-snap-align:start}
/* The shelves are already inset by the page gutter; retain their 4px focus space. */
@supports (mask-image:linear-gradient(to right,transparent,#000)){
 :root[data-scroll-app] [data-scroll-row]{--edge-start:0px;--edge-end:0px;mask-image:linear-gradient(to right,transparent,#000 var(--edge-start),#000 calc(100% - var(--edge-end)),transparent)}
 :root[data-scroll-app] [data-scroll-row][data-left]{--edge-start:16px}
 :root[data-scroll-app] [data-scroll-row][data-right]{--edge-end:16px}
 :root[data-scroll-app] [data-scroll-row]:focus-within{mask-image:none}
}
:root[data-scroll-app] .discover-toolbar{top:var(--scroll-bar)}
:root[data-scroll-app] .admin-users .users-table th{top:var(--scroll-bar)}
:root[data-scroll-app][data-scrolled] :is(.mobilebar,.discover-toolbar,.admin-users .users-table th){box-shadow:0 4px 12px var(--line);border-bottom-color:var(--line2)}
.scroll-top{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:calc(24px + env(safe-area-inset-bottom));z-index:65;display:grid;place-items:center;width:44px;height:44px;padding:0;border:1px solid var(--line2);border-radius:12px;background:var(--surface);color:var(--text);box-shadow:0 2px 8px var(--line);cursor:pointer}
.scroll-top svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.scroll-top:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
/* Existing floating actions own this space while active, including on narrow phones. */
body:has(:is(.users-bulk,.inline-confirm-bar):not([hidden]),dialog[open],.side.open,.jp-tour,.toast.on) .scroll-top{display:none}
@media(prefers-reduced-motion:no-preference){
 :root[data-scroll-app]:not([data-motion=reduce]){scroll-behavior:smooth}
 :root[data-scroll-app]:not([data-motion=reduce]) [data-scroll-enter]:not([data-in]){opacity:0;transform:translateY(64px) scale(.9)}
 :root[data-scroll-app]:not([data-motion=reduce]) [data-scroll-enter]{transition:opacity .7s cubic-bezier(.2,.8,.2,1),transform .8s cubic-bezier(.2,.8,.2,1);transition-delay:calc(var(--i,0)*90ms);will-change:opacity,transform}
 :root[data-scroll-app]:not([data-motion=reduce]) [data-scroll-enter][data-in]{will-change:auto}
 @supports(animation-timeline:view()){
  :root[data-scroll-app] [data-scroll-enter]:focus-within{opacity:1;transform:none}
 }
}
:root[data-scroll-app][data-motion=reduce]{scroll-behavior:auto}
:root[data-scroll-app][data-motion=reduce] :is(.recent-shelf,.settings-tabs){scroll-snap-type:none;scroll-behavior:auto}
@media(prefers-reduced-motion:reduce){
 :root[data-scroll-app],:root[data-scroll-app] :is(.recent-shelf,.settings-tabs){scroll-behavior:auto;scroll-snap-type:none}
}
@media(prefers-reduced-motion:no-preference){
 :root:not([data-motion=reduce]) #content[data-page=home]{--spring:cubic-bezier(.34,1.56,.64,1)}
 :root:not([data-motion=reduce]) #content[data-page=home] .avatar-slot{animation:home-pop .7s var(--spring) both}
 :root:not([data-motion=reduce]) #content[data-page=home] .top h1{animation:home-slide .6s var(--ease) .12s both}
 :root:not([data-motion=reduce]) #content[data-page=home] .top .btn.pri{animation:home-rise .6s var(--ease) .25s both,home-glow 4s ease-in-out 1.2s infinite}
 :root:not([data-motion=reduce]) #content[data-page=home] .home>.card{animation:home-rise .7s var(--ease) .2s both}
 :root:not([data-motion=reduce]) #content[data-page=home] .shelf>.poster{animation:home-pop .65s var(--spring) both}
 :root:not([data-motion=reduce]) #content[data-page=home] .shelf>.poster:nth-child(2){animation-delay:.1s}
 :root:not([data-motion=reduce]) #content[data-page=home] .shelf>.poster:nth-child(3){animation-delay:.2s}
 :root:not([data-motion=reduce]) #content[data-page=home] .shelf>.poster:nth-child(4){animation-delay:.3s}
 :root:not([data-motion=reduce]) #content[data-page=home] .shelf>.poster::after{animation:home-fill 1.1s var(--ease) .5s both}
 :root:not([data-motion=reduce]) #content[data-page=home] .home>.stack>.card:is(:not([data-scroll-enter]),[data-in]) .list>li{animation:home-slide .5s var(--ease) both}
 :root:not([data-motion=reduce]) #content[data-page=home] .home>.stack>.card:is(:not([data-scroll-enter]),[data-in]) .list>li:nth-child(2){animation-delay:.07s}
 :root:not([data-motion=reduce]) #content[data-page=home] .home>.stack>.card:is(:not([data-scroll-enter]),[data-in]) .list>li:nth-child(3){animation-delay:.14s}
 :root:not([data-motion=reduce]) #content[data-page=home] .home>.stack>.card:is(:not([data-scroll-enter]),[data-in]) .list>li:nth-child(4){animation-delay:.21s}
 :root:not([data-motion=reduce]) #content[data-page=home] .home>.stack>.card:is(:not([data-scroll-enter]),[data-in]) .list>li:nth-child(5){animation-delay:.28s}
 :root:not([data-motion=reduce]) #content[data-page=home] .home>.stack>.card:is(:not([data-scroll-enter]),[data-in]) .list .dot{animation:home-ping 1.4s ease-out .6s 2 both}
 :root:not([data-motion=reduce]) #content[data-page=home] .shelf>.poster,:root:not([data-motion=reduce]) #content[data-page=home] .recent-tile .poster{transition:transform .35s var(--spring),box-shadow .35s var(--ease)}
 :root:not([data-motion=reduce]) #content[data-page=home] .shelf>.poster img,:root:not([data-motion=reduce]) #content[data-page=home] .recent-tile .poster img{transition:transform .6s var(--ease)}
 :root:not([data-motion=reduce]) #content[data-page=home] :is(.shelf>.poster,.recent-tile):active{transform:scale(.97)}
 @media(hover:hover) and (pointer:fine){
  :root:not([data-motion=reduce]) #content[data-page=home] .shelf>.poster:hover,:root:not([data-motion=reduce]) #content[data-page=home] .recent-tile:hover .poster{transform:translateY(-6px) scale(1.035);box-shadow:0 14px 30px rgba(0,0,0,.35),0 0 0 1px color-mix(in srgb,var(--accent) 45%,transparent)}
  :root:not([data-motion=reduce]) #content[data-page=home] .shelf>.poster:hover img,:root:not([data-motion=reduce]) #content[data-page=home] .recent-tile:hover .poster img{transform:scale(1.07)}
 }
}
@keyframes home-pop{from{opacity:0;transform:translateY(24px) scale(.82)}to{opacity:1;transform:none}}
@keyframes home-slide{from{opacity:0;transform:translateX(-22px)}to{opacity:1;transform:none}}
@keyframes home-rise{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
@keyframes home-fill{from{width:0}}
@keyframes home-glow{50%{box-shadow:0 0 0 7px color-mix(in srgb,var(--accent) 16%,transparent)}}
@keyframes home-ping{0%{box-shadow:0 0 0 0 color-mix(in srgb,currentColor 0%,transparent),0 0 0 0 var(--ok)}70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}
@media(prefers-reduced-motion:no-preference){
 @supports(animation-timeline:view(inline)){
  :root[data-scroll-app]:not([data-motion=reduce]) .recent-shelf[data-scroll-row]{mask-image:none}
  :root[data-scroll-app]:not([data-motion=reduce]) .recent-shelf>*{animation:shelf-in linear both,shelf-out linear both;animation-timeline:view(inline),view(inline);animation-range:entry 0% entry 100%,exit 0% exit 100%}
 }
}
@keyframes shelf-in{from{opacity:.3;transform:translateY(22px) scale(.84)}to{opacity:1;transform:none}}
@keyframes shelf-out{from{opacity:1;transform:none}to{opacity:.3;transform:translateY(22px) scale(.84)}}

.help-credits{font-size:12px;line-height:1.5;margin:24px 0 0;max-width:62ch}.help-credits a{color:var(--text2)}
@media print{.scroll-top{display:none!important}:root[data-scroll-app] [data-scroll-enter]{opacity:1!important;transform:none!important;transition:none!important}}
`;
