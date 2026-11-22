// Phone navigation (≤700px): bottom tab bar, slide-in drawer, safe areas. Loaded last so it wins.
export const mobileCss = String.raw`
body{padding-inline:env(safe-area-inset-left) env(safe-area-inset-right)}
.nav,.tab,.btn,a,button,summary{-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.tabbar,.mb-title{display:none}
.main{padding-bottom:96px} /* room to scroll the last item clear of the scroll-to-top button */
@media(max-width:700px){
 .mobilebar{display:flex;gap:12px;justify-content:flex-start;padding:10px 16px;padding-top:calc(10px + env(safe-area-inset-top));min-height:52px}
 .mb-title{display:block;margin-left:auto;color:var(--text2);font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
 .tabbar{display:grid;grid-template-columns:repeat(5,1fr);position:fixed;left:0;right:0;bottom:0;z-index:55;padding:6px 8px calc(6px + env(safe-area-inset-bottom));background:var(--side);border-top:1px solid var(--line);box-shadow:0 -6px 20px rgba(0,0,0,.08)}
 .tab{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:52px;padding:4px 2px;border:0;border-radius:12px;background:none;color:var(--text2);font:inherit;font-size:11px;font-weight:500;text-decoration:none;cursor:pointer}
 .tab .i{width:22px;height:22px}
 .tab[aria-current=page],.tab.on{color:var(--accent);background:var(--soft)}
 .tab:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
 .main{padding-bottom:calc(150px + env(safe-area-inset-bottom))}
 /* Keep floating actions above the tab bar; hide the bar while typing so the keyboard has room. */
 .scroll-top{bottom:calc(84px + env(safe-area-inset-bottom))}
 .toast{bottom:calc(84px + env(safe-area-inset-bottom))}
 .inline-confirm-bar{bottom:calc(76px + env(safe-area-inset-bottom))}
 html[data-kbd] .tabbar{display:none} /* only while the on-screen keyboard is really open (shell.js sets data-kbd); a focused box alone no longer hides the bar */
 /* Drawer: slides in, full-height rows, sign-out and identity stay reachable. */
 .member-app>.side.open{width:min(320px,88vw);padding:calc(16px + env(safe-area-inset-top)) 12px calc(16px + env(safe-area-inset-bottom));overscroll-behavior:contain;animation:drawer-in .22s cubic-bezier(.2,.8,.2,1)}
 .side.open .nav{min-height:48px;font-size:15px}
 .side.open .mobile-close{position:sticky;top:0;margin-bottom:8px}
 .side.open .me{margin-top:auto}
 @keyframes drawer-in{from{transform:translateX(-24px);opacity:0}}
}
/* Watch history on phones: poster and title on top, progress under, then the stars and buttons in a tidy grid that never overflows. */
@media(max-width:700px){
 .main,.history-layout,.history-main,.history-group,.history-group .card{min-width:0;max-width:100%}
 .history-row{display:grid;grid-template-columns:48px minmax(0,1fr);align-items:start;gap:10px 12px;padding:14px}
 .history-row .grow{min-width:0}
 .history-progress{grid-column:1/-1;margin-left:0;white-space:normal}
 .history-actions{grid-column:1/-1;margin-left:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:8px}
 .history-actions .stars{grid-column:1/-1;display:flex;justify-content:space-between}
 .history-actions .star{flex:1;min-width:0;min-height:44px;font-size:26px}
 .history-actions .btn{min-height:44px;justify-content:center;padding-inline:10px;white-space:nowrap}
}
@media(max-width:700px) and (prefers-reduced-motion:reduce){.member-app>.side.open{animation:none}}
/* Beta copy: a small pill next to the name (theme.js sets data-env from the hostname). */
html[data-env=beta] .brandline b::after{content:'BETA';margin-left:8px;padding:2px 6px;border-radius:6px;background:var(--accent);color:var(--ink);font-size:10px;font-weight:700;letter-spacing:.06em;vertical-align:middle}
/* Notification bell and its panel. */
.bell{position:relative;display:inline-flex;align-items:center;justify-content:center;min-width:40px;min-height:40px;border:0;border-radius:10px;background:none;color:var(--text2);cursor:pointer}
.bell:hover{background:var(--line);color:var(--text)}.bell:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.bell-count{position:absolute;top:2px;right:2px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--accent);color:var(--ink);font-size:10px;font-weight:700;line-height:16px;text-align:center}
.bell-panel{position:fixed;z-index:70;top:64px;left:16px;width:min(400px,calc(100vw - 32px));max-height:min(70vh,640px);overflow:auto;padding:10px;border:1px solid var(--line2);border-radius:14px;background:var(--side);box-shadow:0 12px 32px rgba(0,0,0,.35)}
.bell-panel[hidden]{display:none}
#bell-list{display:flex;flex-direction:column;gap:10px}
.bell-item{display:flex;flex-direction:column;gap:10px;padding:12px 14px;border:1px solid var(--line2);border-left:3px solid var(--accent);border-radius:12px;background:var(--surface)}
.bell-body>b:first-child{display:block;margin-bottom:4px;font-size:15px}
.bell-item .bell-x{align-self:flex-end}
.bell-body{flex:1;min-width:0}.bell-body a{font-weight:500}.bell-list-items{margin:6px 0 0;padding-left:18px;color:var(--text2);display:flex;flex-direction:column;gap:2px}
.bell-x{min-height:32px;padding:4px 12px;font-size:13px;background:transparent;border:1px solid var(--line2);color:var(--text2)}.bell-empty{padding:16px;margin:0}
.mobilebar .bell{margin-left:4px}
@media(max-width:900px){.top-bell{display:none}}
.top-bell{margin-left:8px;flex:none}
@media(min-width:901px){.bell-panel{top:72px;left:auto;right:24px}}
@media(max-width:700px){.bell-panel{top:calc(56px + env(safe-area-inset-top));left:12px;right:12px;width:auto}}
@media(min-width:901px){.mobilebar .bell{display:none}.bell-panel{top:72px}}
@media print{.tabbar{display:none!important}}
`;
