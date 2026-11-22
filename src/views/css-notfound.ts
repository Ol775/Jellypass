// A static abduction tableau is the fallback; motion only enhances it.
export const notFoundCss = String.raw`
.err-page.nf-page{background:var(--bg)}
.nf-page .authcard{max-width:560px}
.nf-scene{margin:0 -32px;overflow:hidden;background:#080f22;border-block:1px solid var(--line2);isolation:isolate}
.nf-scene svg{display:block;width:100%;height:auto;aspect-ratio:5/3}
.nf-scene svg g,.nf-scene svg ellipse,.nf-scene svg path{transform-box:view-box}
.nf-document{transform-origin:300px 260px;transform:translateY(-24px) rotate(-8deg) scale(.9)}
.nf-ship{transform-origin:300px 120px}
.nf-engine{transform-origin:190px 116px;opacity:.8}
.nf-beam{transform-origin:300px 140px;opacity:.8}
.nf-particles{opacity:.6}
.nf-warp{transform-origin:300px 160px;opacity:0}
.nf-trail{transform-origin:190px 116px;opacity:0}
.nf-flash{transform-origin:300px 140px;opacity:0}
.nf-page .scene-copy h1{max-width:17ch;text-wrap:balance}
.nf-page .scene-label{color:var(--accent)}
@media(max-width:420px){.nf-scene{margin-inline:-24px}}
/* 11s storyboard: drift 0–18%, approach 18–32%, lift 36–58%,
   charge 60–70%, jump 70–78%, empty space 78–96%, reset 96–100%. */
@media(prefers-reduced-motion:no-preference){
  :root:not([data-motion=reduce]) .nf-stars-far{animation:nf-drift-far 22s ease-in-out infinite alternate}
  :root:not([data-motion=reduce]) .nf-stars-near{animation:nf-drift-near 16s ease-in-out infinite alternate}
  :root:not([data-motion=reduce]) .nf-ship{animation:nf-flight 11s ease-in-out infinite}
  :root:not([data-motion=reduce]) .nf-document{animation:nf-lift 11s ease-in-out infinite}
  :root:not([data-motion=reduce]) .nf-beam{animation:nf-tractor 11s ease-in-out infinite}
  :root:not([data-motion=reduce]) .nf-particles{animation:nf-dust 2s ease-in-out infinite}
  :root:not([data-motion=reduce]) .nf-engine{animation:nf-charge 11s ease-in-out infinite}
  :root:not([data-motion=reduce]) .nf-warp{animation:nf-warp 11s ease-in infinite}
  :root:not([data-motion=reduce]) .nf-trail{animation:nf-trail 11s ease-in infinite}
  :root:not([data-motion=reduce]) .nf-flash{animation:nf-flash 11s ease-out infinite}
  @keyframes nf-drift-far{from{transform:translate(-3px,0)}to{transform:translate(5px,5px)}}
  @keyframes nf-drift-near{from{transform:translate(5px,-4px)}to{transform:translate(-9px,8px)}}
  @keyframes nf-flight{
    0%,18%{opacity:0;transform:translate(-400px,-170px) rotate(22deg)}
    19%{opacity:1;transform:translate(-400px,-170px) rotate(22deg)}
    29%{opacity:1;transform:translate(12px,6px) rotate(-3deg)}
    34%,58%{opacity:1;transform:translate(0,0) rotate(0)}
    64%{transform:translate(-4px,2px) rotate(-2deg)}
    70%{opacity:1;transform:translate(-10px,0) rotate(-3deg) scaleX(1)}
    74%{opacity:1;transform:translate(470px,-65px) rotate(-8deg) scaleX(1.7)}
    76%,100%{opacity:0;transform:translate(800px,-110px) rotate(-8deg) scaleX(1.7)}
  }
  @keyframes nf-lift{
    0%{opacity:1;transform:translateY(0) rotate(-7deg)}
    16%{opacity:1;transform:translateY(-8px) rotate(3deg)}
    32%{opacity:1;transform:translateY(0) rotate(-4deg)}
    40%{opacity:1;transform:translateY(-16px) rotate(-9deg) scale(.95)}
    53%{opacity:1;transform:translateY(-85px) rotate(12deg) scale(.45)}
    58%,96%{opacity:0;transform:translateY(-120px) rotate(20deg) scale(.06)}
    97%{opacity:0;transform:translateY(4px) rotate(-7deg) scale(1)}
    100%{opacity:1;transform:translateY(0) rotate(-7deg) scale(1)}
  }
  @keyframes nf-tractor{
    0%,32%{opacity:0;transform:scaleX(.25)}
    37%,53%{opacity:.85;transform:scaleX(1)}
    59%,100%{opacity:0;transform:scaleX(.2)}
  }
  @keyframes nf-dust{0%{opacity:0;transform:translateY(16px)}30%,65%{opacity:.6}100%{opacity:0;transform:translateY(-55px)}}
  @keyframes nf-charge{
    0%,58%,100%{opacity:.65;transform:scale(1)}
    62%,67%{opacity:1;transform:scale(1.6)}
    64%,69%{opacity:.5;transform:scale(1.1)}
    71%,76%{opacity:1;transform:scale(2.3,1.4)}
  }
  @keyframes nf-warp{
    0%,68%{opacity:0;transform:scale(.2)}
    71%{opacity:.15;transform:scale(.45)}
    75%{opacity:.8;transform:scale(1.6)}
    80%,100%{opacity:0;transform:scale(2.5)}
  }
  @keyframes nf-trail{0%,69%,78%,100%{opacity:0;transform:scaleX(.1)}72%,75%{opacity:.8;transform:scaleX(1.5)}}
  @keyframes nf-flash{0%,70%,79%,100%{opacity:0;transform:scale(.3)}73%{opacity:.65;transform:scale(1.3)}77%{opacity:0;transform:scale(2)}}
}
`;
