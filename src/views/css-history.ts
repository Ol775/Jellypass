// Styles for the Watch history page: period switcher, bar chart and pager. Appended to the shared stylesheet by css.ts.
export const historyCss = String.raw`
.history-periods{display:flex;gap:4px;flex-wrap:wrap;margin:0 0 16px;padding:4px;background:var(--side);border:1px solid var(--line);border-radius:12px;width:max-content;max-width:100%}
.history-periods .btn{border:0;background:transparent;min-height:36px;padding:6px 14px;border-radius:8px;color:var(--text2);font-weight:500}
.history-periods .btn:hover{background:var(--line);color:var(--text)}
.history-periods .btn.pri{background:var(--accent);color:var(--ink)}
.history-periods .btn:focus-visible,.history-pages .btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.history-bars{display:block;width:100%;height:auto;margin:12px 0 4px;overflow:visible}
.history-bar{fill:var(--accent)}.history-bar.is-empty{fill:var(--line2)}
.history-axis{font-size:8px;fill:var(--text3);font-family:inherit}
@media(prefers-reduced-motion:no-preference){.history-bar{transform-box:fill-box;transform-origin:bottom;animation:history-bar-in .45s var(--ease) both;animation-delay:calc(var(--i,0)*14ms)}@keyframes history-bar-in{from{transform:scaleY(0)}}}
.stars{display:inline-flex;gap:0;align-items:center}
.star{border:0;background:none;color:var(--line2);font-size:20px;line-height:1;min-width:32px;min-height:36px;padding:0;cursor:pointer;border-radius:8px}
.star.on{color:var(--accent)}
.star:hover{color:var(--accent)}
.star:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
#history-list[aria-busy=true]{opacity:.6;transition:opacity .15s}
.history-pager{display:flex;flex-direction:column;gap:12px;align-items:center;margin-top:8px}
.history-pager[hidden]{display:none}
.history-pages{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center}
.history-numbers{display:inline-flex;gap:6px;align-items:center}
.history-pages .btn{min-width:40px;justify-content:center}
.history-gap{color:var(--text3);padding:0 2px}
.history-mobile-count{display:none}
@media(max-width:900px){.history-layout .history-side{order:-1;max-width:none;width:100%}.history-layout .history-main{min-width:0}}
@media(max-width:600px){
.history-periods{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));width:100%}
.history-periods .btn{padding:6px 2px;font-size:13px;justify-content:center}
.history-numbers{display:none}.history-mobile-count{display:inline}
.history-pages{justify-content:space-between;width:100%}
}
`;
