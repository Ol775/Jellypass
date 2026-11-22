/** Shared, optional poster backdrop. All images stay on the public same-origin proxy. */
export const wallJs = String.raw`
const wall = document.getElementById('poster-wall');
const posterUrls = [];
// A rotated, evenly spaced grid of columns that always covers the screen, whatever its size or orientation.
function buildWall() {
  if (!wall || !posterUrls.length) return;
  const vw = window.innerWidth, vh = window.innerHeight, gap = 12;
  const span = Math.ceil(Math.max(vw, vh) * 1.7);
  const target = Math.max(96, Math.min(170, vw / 5.5));
  const cols = Math.max(4, Math.round(span / (target + gap)));
  const colWidth = (span - (cols - 1) * gap) / cols, cell = colWidth * 1.5;
  const rows = Math.ceil(span / (cell + gap)) + 1;
  const key = cols + 'x' + rows;
  if (wall.dataset.built === key) return;
  wall.dataset.built = key;
  const field = document.createElement('div');
  field.className = 'poster-field';
  field.style.width = span + 'px';
  for (let c = 0; c < cols; c++) {
    const col = document.createElement('div');
    col.className = 'poster-col';
    col.style.setProperty('--wall-dur', (56 + (c % 4) * 14) + 's');
    if (c % 2) col.style.marginTop = Math.round(-cell / 2) + 'px';
    for (let r = 0; r < rows; r++) {
      const img = document.createElement('img');
      img.setAttribute('alt', '');
      img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');
      img.setAttribute('src', posterUrls[(c * 7 + r * 3) % posterUrls.length]);
      col.appendChild(img);
    }
    field.appendChild(col);
  }
  wall.replaceChildren(field);
}
if (wall) {
  fetch('/api/signin-posters')
    .then(response => response.ok ? response.json() : null)
    .then(data => {
      if (!Array.isArray(data?.posters)) return;
      for (const poster of data.posters.slice(0, 24)) {
        if (typeof poster?.url === 'string' && /^\/api\/signin-posters\/img\?path=%2F[A-Za-z0-9_-]{1,60}\.(jpg|png)$/.test(poster.url)) posterUrls.push(poster.url);
      }
      buildWall();
    })
    .catch(() => {});
  let resizeTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(buildWall, 200); }, { passive: true });
}

// Decorative interaction is optional, including when motion settings change live.
const motionQuery = window.matchMedia('(prefers-reduced-motion: no-preference)');
const pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
const motionAllowed = () => motionQuery.matches && document.documentElement.dataset.motion !== 'reduce';
let spotlightFrame = 0;
let pointerX = 0;
let pointerY = 0;
if (wall) {
  document.addEventListener('pointermove', event => {
    if (!motionAllowed() || !pointerQuery.matches || event.pointerType === 'touch') return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (spotlightFrame) return;
    spotlightFrame = requestAnimationFrame(() => {
      spotlightFrame = 0;
      if (!motionAllowed() || !pointerQuery.matches) return;
      wall.style.setProperty('--spot-x', pointerX + 'px');
      wall.style.setProperty('--spot-y', pointerY + 'px');
      wall.setAttribute('data-spotlight', '');
    });
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => wall.removeAttribute('data-spotlight'));
}

const countdown = document.getElementById('maintenance-countdown');
const seconds = document.getElementById('retry-seconds');
if (countdown && seconds) {
  let nextCheck = Date.now() + 30000;
  let checking = false;
  const renderCountdown = () => {
    if (!motionAllowed()) {
      if (countdown.textContent !== 'Checking automatically every 30 seconds') countdown.textContent = 'Checking automatically every 30 seconds';
    } else {
      if (!seconds.isConnected) countdown.replaceChildren(document.createTextNode('Checking again in '), seconds, document.createTextNode(' seconds'));
      const value = String(Math.max(0, Math.ceil((nextCheck - Date.now()) / 1000)));
      if (seconds.textContent !== value) seconds.textContent = value;
    }
    countdown.hidden = false;
  };
  const check = async () => {
    checking = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(location.href, { cache: 'no-store', signal: controller.signal });
      // Only the current page reflects maintenance; /health always returns 200.
      if (response.status !== 503) location.reload();
      if (response.body) await response.body.cancel();
    } catch {
      // Offline or timed out: retain the page and try again next minute.
    } finally {
      clearTimeout(timeout);
      nextCheck = Date.now() + 30000;
      checking = false;
      renderCountdown();
    }
  };
  renderCountdown();
  motionQuery.addEventListener('change', renderCountdown);
  new MutationObserver(renderCountdown).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  setInterval(() => {
    if (!checking && Date.now() >= nextCheck) void check();
    renderCountdown();
  }, 1000);
}
`;
