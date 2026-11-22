import { html } from "hono/html";
import { layout, brand, script } from "./layout";

export function notFoundPage() {
  return layout({ title: "Page not found", body: html`
    <div class="err-page nf-page">
      <div class="poster-wall" id="poster-wall" aria-hidden="true"></div>
      <main class="center">
        <div class="card authcard">
          ${brand}
          <div class="nf-scene">
            <svg viewBox="0 0 600 360" aria-hidden="true" focusable="false">
              <defs>
                <radialGradient id="nf-nebula"><stop stop-color="#16434e" stop-opacity=".65"/><stop offset="1" stop-color="#080f22" stop-opacity="0"/></radialGradient>
                <linearGradient id="nf-hull" x2=".3" y2="1"><stop stop-color="#e4f4f6"/><stop offset=".4" stop-color="#8caebf"/><stop offset="1" stop-color="#263e59"/></linearGradient>
                <linearGradient id="nf-wing" x2=".2" y2="1"><stop stop-color="#7893aa"/><stop offset="1" stop-color="#1b2c45"/></linearGradient>
                <linearGradient id="nf-glass" x2=".6" y2="1"><stop stop-color="#b7fff1"/><stop offset=".35" stop-color="#36cbbd"/><stop offset="1" stop-color="#124d64"/></linearGradient>
                <linearGradient id="nf-beam" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#9effe9" stop-opacity=".65"/><stop offset=".5" stop-color="#4be0ca" stop-opacity=".18"/><stop offset="1" stop-color="#4be0ca" stop-opacity="0"/></linearGradient>
                <linearGradient id="nf-paper" x2=".7" y2="1"><stop stop-color="#f1fffc"/><stop offset="1" stop-color="#a6c9d5"/></linearGradient>
                <radialGradient id="nf-glow"><stop stop-color="#eaffff"/><stop offset=".2" stop-color="#72ffe3" stop-opacity=".8"/><stop offset="1" stop-color="#2dd4bf" stop-opacity="0"/></radialGradient>
                <linearGradient id="nf-tail"><stop stop-color="#4be0ca" stop-opacity="0"/><stop offset="1" stop-color="#d7fff8"/></linearGradient>
              </defs>
              <ellipse cx="325" cy="175" rx="320" ry="210" fill="url(#nf-nebula)"/>
              <g class="nf-stars nf-stars-far" fill="#7d9bb9">
                <path d="M34 48h2v2h-2zM98 180h2v2h-2zM153 76h2v2h-2zM213 310h2v2h-2zM279 24h2v2h-2zM357 283h2v2h-2zM411 66h2v2h-2zM482 203h2v2h-2zM566 39h2v2h-2zM541 310h2v2h-2zM72 319h2v2h-2zM388 340h2v2h-2zM241 133h2v2h-2zM510 104h2v2h-2zM26 245h2v2h-2z"/>
              </g>
              <g class="nf-stars nf-stars-near" fill="#d9f7f6">
                <circle cx="75" cy="95" r="1.8"/><circle cx="160" cy="265" r="1.5"/><circle cx="330" cy="49" r="1.4"/><circle cx="446" cy="286" r="1.8"/><circle cx="540" cy="155" r="1.5"/><circle cx="370" cy="202" r="1"/><path d="m466 81 1.5 4.5 4.5 1.5-4.5 1.5-1.5 4.5-1.5-4.5-4.5-1.5 4.5-1.5z"/>
              </g>
              <g class="nf-warp" stroke="#a3fff0" stroke-linecap="round" fill="none">
                <path d="m252 136-170-90m184 115L15 140m246 48L59 284m228-88-74 159m103-160 62 161m-30-174 236 126m-229-150 242-17m-254-9L512 12M301 119l-6-113" stroke-width="2"/>
                <ellipse cx="300" cy="160" rx="100" ry="65" stroke-width="12" opacity=".12"/>
              </g>
              <g class="nf-beam">
                <path d="m288 137-88 175q100 34 200 0l-88-175z" fill="url(#nf-beam)"/>
                <path d="m296 140-40 165q44 12 88 0l-40-165z" fill="url(#nf-beam)" opacity=".55"/>
                <g class="nf-particles" fill="#b5ffef"><circle cx="269" cy="236" r="2"/><circle cx="324" cy="209" r="1.5"/><circle cx="287" cy="281" r="1.5"/><circle cx="345" cy="274" r="2"/><circle cx="305" cy="176" r="1"/></g>
              </g>
              <g class="nf-document">
                <path d="M262 208h57l19 20v77q0 6-6 6h-70q-6 0-6-6v-91q0-6 6-6z" fill="#000a" transform="translate(3 5)"/>
                <path d="M262 208h57l19 20v77q0 6-6 6h-70q-6 0-6-6v-91q0-6 6-6z" fill="url(#nf-paper)"/>
                <path d="M319 208v15q0 5 5 5h14z" fill="#6a98ac"/>
                <text x="297" y="265" text-anchor="middle" fill="#173e50" font-size="31" font-weight="800">404</text>
                <path d="M271 279h51v3h-51zm0 9h51v3h-51zm0 9h31v3h-31z" fill="#527f90" opacity=".65"/>
              </g>
              <g class="nf-ship">
                <path class="nf-trail" d="m176 113-390-17v36z" fill="url(#nf-tail)"/>
                <ellipse class="nf-engine" cx="190" cy="116" rx="53" ry="26" fill="url(#nf-glow)"/>
                <path d="m216 111-27-49 73 31 59 14-58 22z" fill="url(#nf-wing)"/>
                <path d="m194 114 65-23q45-15 84 5l69 26-64 22-114-7z" fill="url(#nf-hull)"/>
                <path d="m194 114 54 12 100 7 64-11-64 22-114-7z" fill="#213850"/>
                <path d="m247 110 30-23q29-7 49 5l24 17z" fill="url(#nf-glass)"/>
                <path d="m263 104 18-13q21-4 35 1l-32 3z" fill="#effffb" opacity=".65"/>
                <path d="m268 120-38 49 84-31 30-13z" fill="url(#nf-wing)"/>
                <path d="m268 120-38 49 47-38 67-6z" fill="#b6ced8" opacity=".7"/>
                <path d="m190 109 12 3v13l-12-3z" fill="#a8fff0"/>
                <path d="m351 116 36 6-37 3z" fill="#e3fff8" opacity=".7"/>
                <ellipse cx="300" cy="140" rx="18" ry="4" fill="#7fffe1"/>
              </g>
              <ellipse class="nf-flash" cx="300" cy="140" rx="220" ry="160" fill="url(#nf-glow)"/>
            </svg>
          </div>
          <div class="scene-copy"><p class="scene-label">404 · Page abducted</p><h1>A spaceship has stolen this page</h1><p class="muted">A passing ship made off with it. Let's get you back to familiar space.</p></div>
          <div class="actions"><a class="btn pri" href="/">Back to home</a><a class="btn" href="/signin">Sign in</a></div>
        </div>
      </main>
    </div>${script("wall")}` });
}

export type ServiceStatus = { name: string; url?: string; state: "up" | "down" | "unknown" };
const stateText = { up: "Working", down: "Not responding", unknown: "Status unknown" } as const;

export function maintenancePage(message?: string, services: ServiceStatus[] = []) {
  return layout({ title: "Maintenance", body: html`
    <div class="maint-page">
      <div class="poster-wall" id="poster-wall" aria-hidden="true"></div>
      <main class="center">
        <div class="card authcard">
          ${brand}
          <div class="cinema-scene service-scene" aria-hidden="true">
            <svg class="pj-scene" viewBox="0 0 340 190" focusable="false">
              <defs>
                <linearGradient id="pj-metal" x1="0" y1="0" x2=".8" y2="1">
                  <stop stop-color="var(--surface)"/><stop offset=".45" stop-color="color-mix(in srgb,var(--surface) 78%,var(--text3))"/><stop offset="1" stop-color="color-mix(in srgb,var(--surface) 48%,var(--text3))"/>
                </linearGradient>
                <linearGradient id="pj-dark" x1="0" y1="0" x2="1" y2="1">
                  <stop stop-color="var(--text3)"/><stop offset="1" stop-color="color-mix(in srgb,var(--text3) 30%,var(--bg))"/>
                </linearGradient>
                <linearGradient id="pj-teal" x1="0" y1="0" x2="1" y2="1">
                  <stop stop-color="color-mix(in srgb,var(--accent) 75%,white)"/><stop offset=".45" stop-color="var(--accent)"/><stop offset="1" stop-color="color-mix(in srgb,var(--accent) 65%,#123b37)"/>
                </linearGradient>
                <linearGradient id="pj-skin" x1="0" y1="0" x2="1" y2="1">
                  <stop stop-color="#f4c9a2"/><stop offset=".55" stop-color="#dfa67d"/><stop offset="1" stop-color="#b97854"/>
                </linearGradient>
                <linearGradient id="pj-shoe" x1="0" y1="0" x2="0" y2="1">
                  <stop stop-color="color-mix(in srgb,var(--text2) 65%,#20332f)"/><stop offset="1" stop-color="#182623"/>
                </linearGradient>
                <radialGradient id="pj-glass" cx=".3" cy=".25" r=".8">
                  <stop stop-color="#e0fff4"/><stop offset=".3" stop-color="var(--accent)"/><stop offset="1" stop-color="#123b37"/>
                </radialGradient>
                <linearGradient id="pj-light" x1="0" y1=".5" x2="1" y2=".5">
                  <stop stop-color="var(--accent)" stop-opacity=".34"/><stop offset=".55" stop-color="var(--accent)" stop-opacity=".13"/><stop offset="1" stop-color="var(--accent)" stop-opacity=".03"/>
                </linearGradient>
                <radialGradient id="pj-glow">
                  <stop stop-color="var(--accent)" stop-opacity=".32"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>
                </radialGradient>
                <radialGradient id="pj-ground">
                  <stop stop-color="var(--text)" stop-opacity=".19"/><stop offset=".55" stop-color="var(--text)" stop-opacity=".08"/><stop offset="1" stop-color="var(--text)" stop-opacity="0"/>
                </radialGradient>
              </defs>
              <ellipse class="pj-shadow" cx="178" cy="174" rx="151" ry="13"/>
              <path class="pj-leg" d="M319 144h4v25l9 4v3h-24v-3l11-4z"/>
              <rect class="pj-screen-frame" x="305" y="39" width="25" height="114" rx="5"/>
              <rect class="pj-screen" x="307" y="42" width="19" height="107" rx="3"/>
              <ellipse class="pj-glow" cx="313" cy="96" rx="16" ry="55"/>
              <g class="pj-beam">
                <path fill="url(#pj-light)" d="M247 94 307 44v104l-60-44z"/>
                <path fill="url(#pj-light)" d="M247 96 307 57v78l-60-33z"/>
              </g>
              <g class="pj-projector">
                <path class="pj-leg" d="M163 126h10l-5 42h-10zm48 0h9l8 42h-10z"/>
                <path class="pj-shoe" d="M156 167h15v5h-17q-2-3 2-5m60 0h14q4 2 2 5h-16z"/>
                <path class="pj-dark" d="m170 68 5-2 16 31h-9zm45-2 5 2-13 29h-9z"/>
                <path class="pj-film" d="M170 78h4v14h43V78h4v18h-51z"/>
                <path class="pj-perfs" d="M171 81h2v3h-2zm0 6h2v3h-2zm47-6h2v3h-2zm0 6h2v3h-2z"/>
                <rect class="pj-dark" x="149" y="86" width="92" height="45" rx="9"/>
                <rect class="pj-body" x="146" y="82" width="91" height="45" rx="9"/>
                <path class="pj-highlight" d="M155 83h73q7 0 8 7h-89q1-7 8-7"/>
                <path class="pj-shade" d="M147 117h89v3q-1 7-9 7h-71q-9 0-9-10"/>
                <rect class="pj-panel" x="156" y="95" width="32" height="23" rx="4"/>
                <rect class="pj-dark" x="159" y="97" width="26" height="18" rx="2"/>
                <path class="pj-vents" d="M164 100h16v2h-16zm0 5h16v2h-16zm0 5h11v2h-11z"/>
                <circle class="pj-screw" cx="159" cy="106" r="2"/>
                <path class="pj-detail" d="m158 106h2"/>
                <rect class="pj-dark" x="196" y="98" width="18" height="4" rx="2"/>
                <circle class="pj-panel" cx="204" cy="112" r="5"/>
                <g class="pj-led"><circle cx="204" cy="112" r="3"/><circle class="pj-highlight" cx="203" cy="111" r="1"/></g>
                <path class="pj-vents" d="M220 99h3v15h-3zm5 0h3v15h-3z"/>
                <rect class="pj-dark" x="234" y="91" width="14" height="19" rx="4"/>
                <rect class="pj-lens" x="242" y="90" width="8" height="21" rx="3"/>
                <ellipse class="pj-glass" cx="250" cy="100.5" rx="4" ry="8.5"/>
                <ellipse class="pj-highlight" cx="249" cy="97" rx="1.5" ry="3"/>
                <circle class="pj-dark" cx="173" cy="63" r="23"/>
                <g class="pj-reel reel-a">
                  <circle class="pj-reel-rim" cx="171" cy="60" r="23"/>
                  <circle class="pj-film" cx="171" cy="60" r="20"/>
                  <circle class="pj-reel-face" cx="171" cy="60" r="17.5"/>
                  <path class="pj-reel-slots" d="M167 46q4-2 8 0l-1 7h-6zM183 53q4 4 2 8l-8-1-1-3zM181 70q-3 4-7 4l-1-8 3-2zM161 70q3 4 7 4l1-8-3-2zM159 53q-4 4-2 8l8-1 1-3z"/>
                  <circle class="pj-hub" cx="171" cy="60" r="5"/>
                  <circle class="pj-screw" cx="171" cy="60" r="2"/>
                  <path class="pj-perfs" d="M170 39h2v2h-2zm0 40h2v2h-2zm-20-20h2v2h-2zm40 0h2v2h-2z"/>
                </g>
                <circle class="pj-dark" cx="221" cy="63" r="23"/>
                <g class="pj-reel reel-b">
                  <circle class="pj-reel-rim" cx="219" cy="60" r="23"/>
                  <circle class="pj-film" cx="219" cy="60" r="20"/>
                  <circle class="pj-reel-face" cx="219" cy="60" r="17.5"/>
                  <path class="pj-reel-slots" d="M215 46q4-2 8 0l-1 7h-6zM231 53q4 4 2 8l-8-1-1-3zM229 70q-3 4-7 4l-1-8 3-2zM209 70q3 4 7 4l1-8-3-2zM207 53q-4 4-2 8l8-1 1-3z"/>
                  <circle class="pj-hub" cx="219" cy="60" r="5"/>
                  <circle class="pj-screw" cx="219" cy="60" r="2"/>
                  <path class="pj-perfs" d="M218 39h2v2h-2zm0 40h2v2h-2zm-20-20h2v2h-2zm40 0h2v2h-2z"/>
                </g>
              </g>
              <g class="pj-person">
                <path class="pj-pants" d="m71 116 30 1-2 23 5 26H92l-9-32-3 32H68l1-27z"/>
                <path class="pj-shade" d="m82 124 6 7 8 34h-4l-9-31-3 31h-4z"/>
                <path class="pj-shoe" d="M68 163h12l4 5q4 1 4 5H65q-1-6 3-10m24 0h11l5 5q6 1 6 5H91z"/>
                <path class="pj-sole" d="M65 171h23v3H65zm26 0h23v3H91z"/>
                <path class="pj-skin" d="M65 90q-6 11-3 23l9 10 5-5-7-9 5-17z"/>
                <path class="pj-shirt" d="M78 72q-12 0-16 16l-1 9 13 4-5 21q14 6 33-1l-1-30q-2-17-13-19z"/>
                <path class="pj-shade" d="m76 85-3 28q10 7 28 3l1 5q-18 6-33 1z"/>
                <path class="pj-highlight" d="M77 76q-9 3-10 14l5 1q0-10 8-13z"/>
                <path class="pj-skin" d="m80 63-2 12q6 7 13 0l-2-13z"/>
                <path class="pj-collar" d="m77 72 8 7 7-6 4 5-10 7-12-9z"/>
                <path class="pj-skin" d="M72 48q2-12 15-10 12 1 12 14l4 8-5 2q-1 10-10 11-13-1-16-14z"/>
                <path class="pj-shade" d="M72 50h8v10q0 8 9 10-12 2-16-10z"/>
                <ellipse class="pj-skin" cx="77" cy="57" rx="4" ry="5"/>
                <circle class="pj-eye" cx="95" cy="55" r="1.2"/>
                <path class="pj-detail" d="M94 65h3"/>
                <path class="pj-cap" d="M69 51q-1-17 16-18 15 0 16 16l-16 4z"/>
                <path class="pj-highlight" d="M73 45q3-9 12-9l4 1q-10 0-12 9z"/>
                <path class="pj-cap-brim" d="M82 48h22q7 0 5 4-12 4-26 1z"/>
                <g class="pj-arm">
                  <path class="pj-sleeve" d="M91 81q7-2 13 7l12 11-7 10-18-13q-8-8 0-15"/>
                  <path class="pj-cuff" d="m110 96 7 4-7 10-6-5z"/>
                  <path class="pj-skin" d="m116 100 22 2 5-3q5-1 8 3l-1 6q-3 3-8 0l-27 3-5-3z"/>
                  <g class="pj-tool">
                    <path class="pj-screw" d="M149 104h11v2h-11z"/>
                    <rect class="pj-tool-grip" x="138" y="102" width="14" height="6" rx="3"/>
                    <path class="pj-highlight" d="M141 103h8v1h-8z"/>
                  </g>
                  <path class="pj-skin" d="M141 101q2-3 5-1l1 6q-2 3-4 0z"/>
                </g>
                <g class="pj-sparks"><path d="m157 94-2-5m8 7 3-4m-1 10 5-1"/></g>
              </g>
              <path class="pj-handle" fill-rule="evenodd" d="M119 153v-6q0-3 3-3h11q3 0 3 3v6h-4v-5h-9v5z"/>
              <rect class="pj-box" x="110" y="151" width="35" height="21" rx="4"/>
              <path class="pj-shade" d="M137 152h4q4 0 4 4v12q0 4-4 4h-4z"/>
              <path class="pj-box-lid" d="M114 151h27q4 0 4 4v3h-35v-3q0-4 4-4"/>
              <rect class="pj-screw" x="125" y="156" width="5" height="6" rx="1"/>
            </svg>
          </div>
          <div class="scene-copy"><h1>We'll be right back</h1><p class="muted">A little work behind the scenes. We're getting Jellypass ready for your next watch.</p></div>
          <div class="maintenance-status"><p><span class="status-dot" aria-hidden="true"></span>Maintenance in progress</p><div class="maintenance-progress" aria-hidden="true"><span></span></div></div>
          ${message ? html`<aside class="maintenance-message" aria-label="Maintenance update"><b>A note from the team</b><p>${message}</p></aside>` : ""}
          ${services.length ? html`<section class="maint-services" aria-label="Service status"><h2>Still available</h2><ul>${services.map(sv => html`<li><span class="svc-dot ${sv.state}" aria-hidden="true"></span><span class="svc-name">${sv.name}</span><span class="svc-state">${stateText[sv.state]}</span>${sv.url ? html`<a class="svc-link" href="${sv.url}" rel="noopener">Open</a>` : ""}</li>`)}</ul></section>` : ""}
          <div class="retry-actions"><a class="btn pri" href="">Try again</a><p class="retry-countdown" id="maintenance-countdown" hidden aria-live="off">Checking again in <span id="retry-seconds">30</span> seconds</p></div>
        </div>
      </main>
    </div>${script("wall")}` });
}
