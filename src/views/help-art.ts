import { html } from "hono/html";

// Self-drawn illustrations (no third-party images, so nothing is loaded from outside and no member address leaves the Worker).
export const helpHeroArt = html`<svg class="help-art" viewBox="0 0 360 240" role="img" aria-label="A TV and a phone both showing the Jellyfin app" focusable="false">
  <defs>
    <linearGradient id="help-art-glow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient>
    <clipPath id="help-art-posters-clip"><rect x="68" y="60" width="188" height="100" rx="6"/></clipPath>
  </defs>
  <ellipse cx="180" cy="214" rx="150" ry="12" fill="var(--line)"/>
  <circle class="help-art-glow" cx="180" cy="110" r="104" fill="url(#help-art-glow)"/>
  <g class="help-art-scene">
  <rect x="48" y="40" width="228" height="140" rx="12" fill="var(--surface)" stroke="var(--line2)" stroke-width="3"/>
  <rect x="60" y="52" width="204" height="116" rx="6" fill="var(--bg)"/>
  <g clip-path="url(#help-art-posters-clip)">
    <g class="help-art-posters">
      <rect x="72" y="64" width="62" height="92" rx="5" fill="var(--soft)"/><rect x="142" y="64" width="62" height="92" rx="5" fill="var(--line)"/><rect x="212" y="64" width="62" height="92" rx="5" fill="var(--line)"/>
      <rect class="help-art-highlight" x="72" y="64" width="62" height="92" rx="5" fill="var(--accent)" opacity=".08"/>
      <path class="help-art-play help-art-tv-play" d="M96 100l22 12-22 12z" fill="var(--accent)"/>
      <rect class="help-art-selection" x="72" y="64" width="62" height="92" rx="5" fill="none" stroke="var(--accent)" stroke-width="1.5" opacity=".65"/>
    </g>
  </g>
  <path d="M138 180h92v10H138z" fill="var(--line2)"/><rect x="114" y="190" width="140" height="8" rx="4" fill="var(--line2)"/>
  <rect x="244" y="92" width="86" height="128" rx="14" fill="var(--surface)" stroke="var(--line2)" stroke-width="3"/>
  <rect x="254" y="108" width="66" height="96" rx="6" fill="var(--bg)"/>
  <rect x="262" y="116" width="50" height="62" rx="4" fill="var(--soft)"/><path class="help-art-play help-art-phone-play" d="M280 140l14 8-14 8z" fill="var(--accent)"/>
  <rect x="262" y="184" width="50" height="6" rx="3" fill="var(--line2)"/><rect x="262" y="194" width="32" height="6" rx="3" fill="var(--line)"/>
  <rect class="help-art-progress" x="262" y="184" width="50" height="6" rx="3" fill="var(--accent)" transform="translate(262 0) scale(.56 1) translate(-262 0)"/>
  <circle cx="287" cy="100" r="2.5" fill="var(--line2)"/>
  </g>
  <g fill="var(--accent)">
    <circle class="help-art-spark help-art-spark-one" cx="36" cy="124" r="2" opacity=".35"/>
    <circle class="help-art-spark help-art-spark-two" cx="302" cy="66" r="2.5" opacity=".3"/>
  </g>
</svg>`;

const ico = (inner: string) => `<svg class="help-step-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
/** Icons for the four getting-started steps (static, trusted markup). */
export const stepIcons = {
  app: ico('<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19h14"/>'),
  server: ico('<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.6 2.5 13.4 0 16M12 4c-2.5 2.6-2.5 13.4 0 16"/>'),
  signin: ico('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>'),
  watch: ico('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M10 9l4 2-4 2zM8 20h8"/>'),
};
