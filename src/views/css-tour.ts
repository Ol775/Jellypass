// The guided tour overlay (spotlight and coach card). Appended to the shared stylesheet by css.ts.
export const tourCss = String.raw`
.jp-tour{position:fixed;inset:0;z-index:200;pointer-events:none}
.jp-tour-dim{position:absolute;inset:0;pointer-events:auto}.jp-tour-dim.solid{background:rgba(8,10,12,.66)}
.jp-tour-spot{position:fixed;border-radius:12px;box-shadow:0 0 0 100vmax rgba(8,10,12,.66);outline:2px solid var(--accent);outline-offset:0;pointer-events:none}
.jp-tour-spot[hidden]{display:none}
.jp-tour-pop{position:fixed;max-height:calc(100svh - 24px);overflow:auto;overscroll-behavior:contain;width:min(360px,calc(100vw - 24px));padding:18px 18px 14px;border-radius:14px;background:var(--surface);color:var(--text);border:1px solid var(--line2);box-shadow:0 18px 50px rgba(0,0,0,.45);pointer-events:auto;display:flex;flex-direction:column;gap:8px}
.jp-tour-count{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)}.jp-tour-count:empty{display:none}
.jp-tour-pop h2{font-size:17px;line-height:1.25}.jp-tour-body{font-size:14px;line-height:1.5;color:var(--text2)}
.jp-tour-actions{display:flex;gap:8px;margin-top:6px}.jp-tour-actions .btn{flex:1;justify-content:center;min-height:40px}
.jp-tour-skip{align-self:center;border:0;background:none;color:var(--text3);font-size:13px;min-height:32px}.jp-tour-skip:hover{color:var(--text)}
.jp-tour-pop.is-last{text-align:center}
@media(max-width:900px){.jp-tour-actions .btn,.jp-tour-skip{min-height:44px}.jp-tour-pop{padding-bottom:calc(14px + env(safe-area-inset-bottom))}}
@media(prefers-reduced-motion:no-preference){:root:not([data-motion=reduce]) .jp-tour-spot{transition:left .3s var(--ease),top .3s var(--ease),width .3s var(--ease),height .3s var(--ease)}:root:not([data-motion=reduce]) .jp-tour-pop{transition:left .3s var(--ease),top .3s var(--ease);animation:jp-tour-in .3s var(--ease)}@keyframes jp-tour-in{from{opacity:0;transform:translateY(8px)}}:root:not([data-motion=reduce]) .jp-tour-spot{animation:jp-tour-pulse 2.4s ease-in-out infinite}@keyframes jp-tour-pulse{50%{outline-offset:4px}}}
`;
