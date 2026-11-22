// Styles for the Help page: hero, steps, device cards and official-docs links. Appended to the shared stylesheet by css.ts.
export const helpCss = String.raw`
.help-hero{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:24px;align-items:center;padding:32px;margin-bottom:24px;overflow:hidden;background:linear-gradient(135deg,var(--surface),color-mix(in srgb,var(--accent) 8%,var(--surface)))}
.help-hero h2{font-size:clamp(22px,3vw,30px);line-height:1.2;letter-spacing:-.02em;margin:4px 0 12px}
.help-kicker{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.help-cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}
.help-art{display:block;width:100%;height:auto;max-height:260px}
/* The SVG's presentation attributes provide the complete static illustration. */
@media(prefers-reduced-motion:no-preference){
  :root:not([data-motion=reduce]) .help-art :is(.help-art-glow,.help-art-scene,.help-art-posters,.help-art-play,.help-art-selection,.help-art-progress,.help-art-spark){transform-box:fill-box;transform-origin:center}
  :root:not([data-motion=reduce]) .help-art .help-art-glow{animation:help-art-breathe 8s ease-in-out infinite;animation-delay:-2s}
  :root:not([data-motion=reduce]) .help-art .help-art-scene{animation:help-art-float 9s ease-in-out infinite;animation-delay:-3s}
  :root:not([data-motion=reduce]) .help-art .help-art-posters{animation:help-art-carousel 8s ease-in-out infinite;animation-delay:-1s}
  :root:not([data-motion=reduce]) .help-art .help-art-selection{animation:help-art-select 8s ease-in-out infinite;animation-delay:-1s}
  :root:not([data-motion=reduce]) .help-art .help-art-highlight{animation:help-art-highlight 8s ease-in-out infinite;animation-delay:-1s}
  :root:not([data-motion=reduce]) .help-art .help-art-play{animation:help-art-play 4s ease-in-out infinite}
  :root:not([data-motion=reduce]) .help-art .help-art-tv-play{animation-delay:-1s}
  :root:not([data-motion=reduce]) .help-art .help-art-phone-play{animation-delay:-2.5s}
  :root:not([data-motion=reduce]) .help-art .help-art-progress{transform-origin:left center;animation:help-art-progress 8s linear infinite;animation-delay:-2s}
  :root:not([data-motion=reduce]) .help-art .help-art-spark{animation:help-art-drift 7s ease-in-out infinite}
  :root:not([data-motion=reduce]) .help-art .help-art-spark-one{animation-delay:-1s}
  :root:not([data-motion=reduce]) .help-art .help-art-spark-two{animation-delay:-4.5s}
  @keyframes help-art-breathe{0%,100%{transform:scale(.97);opacity:.7}50%{transform:scale(1.025);opacity:1}}
  @keyframes help-art-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
  @keyframes help-art-carousel{0%,20%,100%{transform:translateX(0)}45%,65%{transform:translateX(-8px)}}
  @keyframes help-art-select{0%,20%,100%{transform:translateX(0);opacity:.65}45%,65%{transform:translateX(70px);opacity:.45}}
  @keyframes help-art-highlight{0%,20%,100%{opacity:.12}45%,65%{opacity:.03}}
  @keyframes help-art-play{0%,100%{transform:scale(1);opacity:.8}50%{transform:scale(1.06);opacity:1}}
  @keyframes help-art-progress{0%{transform:scaleX(.18);opacity:.8}75%,85%{transform:scaleX(1);opacity:.8}93%{transform:scaleX(1);opacity:0}94%{transform:scaleX(.18);opacity:0}100%{transform:scaleX(.18);opacity:.8}}
  @keyframes help-art-drift{0%,100%{transform:translateY(4px);opacity:0}20%{opacity:.35}75%{opacity:.25}90%{transform:translateY(-10px);opacity:0}}
}
.help-steps{margin-bottom:24px}.help-steps>h2,.help-docs>h2{font-size:18px;margin-bottom:12px}
.help-step-list{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px;counter-reset:none}
.help-step-list li{position:relative;padding:20px;display:flex;flex-direction:column;gap:8px}
.help-step-icon{width:28px;height:28px;color:var(--accent)}
.help-step-num{position:absolute;top:16px;right:16px;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:600;background:var(--soft);color:var(--accent)}
.help-step-list h3{font-size:15px}
.help-url{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.help-url code{padding:4px 8px;border-radius:6px;background:var(--bg);border:1px solid var(--line2);overflow-wrap:anywhere;font-size:13px}
.help-url .btn{min-height:32px;padding:4px 10px}
.help-clients{margin-bottom:24px}.help-clients>.top{margin-bottom:12px}.help-clients h2{font-size:18px}
.help-filter{margin-bottom:16px;flex-wrap:wrap}
.help-client-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,290px),1fr));gap:16px}
.help-client{padding:20px;display:flex;flex-direction:column;gap:12px;background:var(--bg)}.help-client[hidden]{display:none}
.help-client-head{display:flex;gap:12px;align-items:center}
.help-device-icon{width:40px;height:40px;padding:8px;flex:none;border-radius:10px;background:var(--soft);color:var(--accent);fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.help-client h3{font-size:15px}
.help-badges{display:flex;gap:6px;margin-top:4px}
.help-badge{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;border:1px solid var(--line2);color:var(--text2)}.help-badge.is-rec{border-color:var(--accent);color:var(--accent);background:var(--soft)}
.help-platforms{display:flex;flex-wrap:wrap;gap:6px}.help-chip{font-size:12px;padding:2px 8px;border-radius:6px;background:var(--side);border:1px solid var(--line);color:var(--text2)}
.help-client .actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto}
.help-client details{border:0;padding:0}.help-client summary{cursor:pointer;color:var(--accent);font-weight:500}
.help-client ol{margin:8px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--text2)}
.help-more{font-size:12px}
.help-docs{margin-bottom:24px}
.help-docs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:12px}
.help-doc{display:flex;flex-direction:column;gap:6px;padding:16px 20px;text-decoration:none;color:var(--text);transition:border-color .15s,transform .15s}
.help-doc:hover,.help-doc:focus-visible{border-color:var(--accent)}.help-doc:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.help-doc-go{margin-top:auto;font-size:13px;color:var(--accent)}
.help-sec{padding:0;border:0;margin-bottom:24px}.help-sec>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;list-style:none;cursor:pointer;min-height:48px;padding:4px 0}.help-sec>summary::-webkit-details-marker{display:none}.help-sec>summary h2{display:inline;font-size:18px;margin:0}.help-sec>summary::after{content:"";flex:none;width:10px;height:10px;margin-left:auto;border-right:2px solid var(--text2);border-bottom:2px solid var(--text2);transform:rotate(45deg);transition:transform .2s}.help-sec[open]>summary::after{transform:rotate(-135deg)}.help-sec-sub{order:3;flex-basis:100%;font-size:13px;color:var(--text2);margin-top:-4px}
.help-sec.card{padding:16px 20px}.help-sec.card>summary{padding:0}.help-sec-body{margin-top:12px}.help-sec>.help-step-list,.help-sec>.help-docs-grid{margin-top:12px}
.help-quick{margin-bottom:24px}.help-quick h2{font-size:18px;margin-bottom:12px}.help-quick-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:10px}.help-quick-btn{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:52px;padding:10px 16px;text-align:left;cursor:pointer;color:var(--text);background:var(--surface);border:1px solid var(--line2);border-radius:12px;transition:border-color .15s,background .15s}.help-quick-btn:hover{border-color:var(--accent);background:var(--soft)}.help-quick-btn span{color:var(--accent)}
.help-expand{display:flex;gap:8px}.help-howto{margin:8px 0 0;padding-left:22px;display:flex;flex-direction:column;gap:6px;color:var(--text2)}.help-article-cta{margin-top:12px;display:inline-flex;align-items:center;gap:6px}
.help-qr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:16px;margin-bottom:12px}.help-qr{margin:0;padding:16px;display:flex;align-items:center;gap:16px;background:var(--bg)}.help-qr-code{flex:none;width:132px;height:132px;border-radius:8px;background:#fff}.help-qr figcaption{display:flex;flex-direction:column;gap:6px;align-items:flex-start;min-width:0}
@media(max-width:900px){.help-qr-code{display:none}.help-qr{padding:14px}.help-qr figcaption{width:100%}.help-qr .btn{width:100%}}
.help-tv-list{display:flex;flex-direction:column;gap:8px}.help-tv{border:1px solid var(--line2);border-radius:12px;padding:0 16px;background:var(--bg)}.help-tv>summary{min-height:48px;display:flex;align-items:center}.help-tv[open]>summary{color:var(--accent)}.help-tv .help-howto{margin-top:0}.help-tv .actions{margin:12px 0 16px}.help-tv code,.help-sec code{padding:2px 6px;border-radius:6px;background:var(--surface);border:1px solid var(--line2);overflow-wrap:anywhere;font-size:13px}
@media(prefers-reduced-motion:no-preference){.help-doc:hover{transform:translateY(-2px)}}
@media(max-width:800px){.help-hero{grid-template-columns:1fr;padding:24px}.help-hero-art{order:-1;max-width:300px;margin-inline:auto}}
@media(max-width:600px){.help-step-list{grid-template-columns:1fr}.help-step-list li{display:grid;grid-template-columns:28px minmax(0,1fr);column-gap:14px;row-gap:6px;padding:16px 48px 16px 16px;align-items:start}.help-step-list li>:not(.help-step-icon):not(.help-step-num){grid-column:2}.help-step-list li>.help-step-icon{grid-column:1;grid-row:1}.help-step-list li>h3{align-self:center;min-height:28px;display:flex;align-items:center}.help-step-list .help-qc{margin-top:4px}}
@media(max-width:480px){.help-hero{padding:20px 16px}.help-cta .btn{flex:1 1 100%;justify-content:center}.help-client{padding:16px}}
`;
