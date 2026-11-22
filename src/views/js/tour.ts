// Guided tour: highlights real parts of the site and walks the member through them, page by page.
// Starts with /?tour=1 (first sign-in and "Replay the tour"); progress lives in sessionStorage so it survives page changes.
export const tourJs = String.raw`
const KEY = 'jp-tour';
const adminPresent = () => !!document.querySelector('#sidebar a[href="/admin/users"]');
const buildSteps = (admin, phone) => {
  const s = [
    phone
      ? { path: '/', target: '.tabbar', title: 'Your shortcuts', body: 'The bar along the bottom jumps between Home, Discover, History and Devices. Tap More for everything else, including Help and Settings.' }
      : { path: '/', target: '#sidebar', title: 'Your menu', body: 'Every page is in this menu, and the Help page has quick answers if you get stuck. On a narrow window it shrinks to icons.' },
    { path: '/', target: '#shelf', title: 'Your Home shelf', body: 'Pick up what you were watching on any device. Recently added films and shows appear below it.' },
    { path: '/', nav: '/discover', title: 'Find things and ask for them', body: 'Discover and request is your search box for the whole film and TV world.' },
    { path: '/discover', target: '#search', title: 'Search, then press Request', body: 'Type a title. If it is not in the library yet, press Request and Seerr emails you when it is ready. Press / to jump here from anywhere.' },
    { path: '/discover', target: '.requests-card', title: 'Follow your requests', body: 'Everything you have asked for is listed here with its progress.' },
    { path: '/history', target: '.history-periods', title: 'Your watching over time', body: 'Switch between the last week, month, 90 days or year to see what you watched and for how long.' },
    { path: '/history', nav: '/wrapped', title: 'Your year, Wrapped', body: 'A story of your year in watching, with fun comparisons you can share.' },
    { path: '/wrapped', target: '#wrapped', title: 'Tap through your story', body: 'Tap or use the arrow keys. At the end you can share it as a picture.' },
    { path: '/devices', target: '#signins', title: 'See where you are signed in', body: 'Every device and place appears here. If something looks wrong, press "This wasn’t me" and we sign it out.' },
    { path: '/account', target: '#account-checklist', title: 'Keep your account safe', body: 'Check your email is verified, change your password and sign out of other browsers.' },
    { path: '/help', target: '#help-quickconnect', title: 'Sign a TV in with a code', body: 'Open Jellyfin on the TV, choose Quick Connect, then type the 6 digit code it shows right here.' },
    { path: '/help', target: '.help-quick', title: 'Stuck? Start here', body: 'Tap what is going wrong for an instant answer with steps and a button that takes you to the fix. Most problems are sorted in a minute, before you need to message anyone.' },
    { path: '/help', target: '#clients', title: 'Official apps for every device', body: 'Pick your device for the right app, with set-up steps and our server address.' },
    { path: '/settings', target: '.theme-choices', title: 'Make it yours', body: 'Choose Auto, Light, Dark or pure black OLED, decide which emails you get, and opt in to comparing watch history with friends.' },
    { path: '/status', target: '#service-summary', title: 'Is something down?', body: 'If anything is slow, check here first. It shows the last 90 days.' },
  ];
  if (admin) s.push(
    { path: '/admin/users', target: '#user-search', title: 'Admin: members', body: 'Search members, set access levels and end dates, or give someone no end date.' },
    { path: '/admin/security', target: '.admin-security', title: 'Admin: security centre', body: 'Sessions, lockouts, emergency sign-out and a checklist of what to keep an eye on.' });
  s.push({ path: '/', title: 'You are all set', body: 'That is the tour. You can replay it any time from Help. Enjoy the watching!', last: true });
  return s;
};
const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; } };
const save = st => { try { sessionStorage.setItem(KEY, JSON.stringify(st)); } catch {} };
const clear = () => { try { sessionStorage.removeItem(KEY); } catch {} };
const motion = () => matchMedia('(prefers-reduced-motion: no-preference)').matches && document.documentElement.dataset.motion !== 'reduce';
let ui = null;
function end() {
  clear(); ui?.remove(); ui = null;
  window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); document.removeEventListener('keydown', onKey, true);
  const u = new URL(location.href); if (u.searchParams.has('tour')) { u.searchParams.delete('tour'); history.replaceState(null, '', u.pathname + u.search + u.hash); }
}
let state = null, steps = [], current = null, targetEl = null;
const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
const reveal = el => { for (let n = el && el.closest('details'); n; n = n.parentElement && n.parentElement.closest('details')) n.open = true; };
function resolve(step) {
  if (step.nav) {
    for (const sel of ['#sidebar a.nav[href="' + step.nav + '"]', '.tabbar a[href="' + step.nav + '"]']) { const a = document.querySelector(sel); if (a && visible(a)) return { el: a, note: '' }; }
    const m = document.getElementById('nav-open'); if (m && visible(m)) return { el: m, note: ' (Tap More to find it.)' };
    return { el: null, note: '' };
  }
  if (!step.target) return { el: null, note: '' };
  const el = document.querySelector(step.target); reveal(el); return { el: el && visible(el) ? el : null, note: '' };
}
function build() {
  const root = document.createElement('div'); root.className = 'jp-tour';
  const dim = document.createElement('div'); dim.className = 'jp-tour-dim'; dim.setAttribute('aria-hidden', 'true');
  const spot = document.createElement('div'); spot.className = 'jp-tour-spot'; spot.setAttribute('aria-hidden', 'true');
  const pop = document.createElement('div'); pop.className = 'jp-tour-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-labelledby', 'jp-tour-title'); pop.setAttribute('aria-describedby', 'jp-tour-body');
  const count = document.createElement('p'); count.className = 'jp-tour-count';
  const h = document.createElement('h2'); h.id = 'jp-tour-title';
  const body = document.createElement('p'); body.id = 'jp-tour-body'; body.className = 'jp-tour-body';
  const acts = document.createElement('div'); acts.className = 'jp-tour-actions';
  const mk = (label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + cls; b.textContent = label; b.addEventListener('click', fn); return b; };
  const back = mk('Back', '', () => go(state.i - 1)), next = mk('Next', 'pri', () => go(state.i + 1)), skip = mk('Skip tour', 'ghost jp-tour-skip', end);
  acts.append(back, next); pop.append(count, h, body, acts, skip);
  root.append(dim, spot, pop); document.body.append(root);
  ui = { remove: () => root.remove(), dim, spot, pop, count, h, body, back, next, skip };
}
function place() {
  if (!ui || !current) return;
  const pop = ui.pop, vw = innerWidth, vh = innerHeight, pad = 12;
  if (!targetEl || !visible(targetEl)) {
    ui.spot.hidden = true; ui.dim.classList.add('solid');
    pop.style.left = Math.max(pad, (vw - pop.offsetWidth) / 2) + 'px'; pop.style.top = Math.max(pad, (vh - pop.offsetHeight) / 2) + 'px'; return;
  }
  ui.dim.classList.remove('solid'); ui.spot.hidden = false;
  const r = targetEl.getBoundingClientRect(), m = 6;
  Object.assign(ui.spot.style, { left: r.left - m + 'px', top: r.top - m + 'px', width: r.width + m * 2 + 'px', height: r.height + m * 2 + 'px' });
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  if (vw <= 700) { // phones: a card clear of the top bar and the tab bar, on the side away from the highlighted part
    const bar = document.querySelector('.tabbar'), top0 = document.querySelector('.mobilebar'), barTop = bar && visible(bar) ? bar.getBoundingClientRect().top : vh;
    const upper = top0 && visible(top0) ? top0.getBoundingClientRect().bottom + pad : pad;
    const mid = r.top + r.height / 2, y = mid < barTop / 2 ? barTop - ph - pad : upper;
    pop.style.left = Math.round((vw - pw) / 2) + 'px'; pop.style.top = Math.round(Math.max(pad, y)) + 'px'; return;
  }
  if (targetEl.closest('#sidebar') && vw > 700) { pop.style.left = Math.round(r.right + m + 18) + 'px'; pop.style.top = Math.round(Math.max(pad, Math.min(vh - ph - pad, r.top - 12))) + 'px'; return; } // beside the sidebar, not over the other menu items
  let top = r.bottom + m + 14;
  if (top + ph > vh - pad) top = r.top - m - 14 - ph;
  if (top < pad) top = Math.min(vh - ph - pad, Math.max(pad, r.bottom + m + 14)); // neither side fits: overlap rather than leave the screen
  if (r.left > vw * 0.55 && r.width < vw * 0.4 && top + ph > r.top - m && top < r.bottom + m) { top = Math.max(pad, Math.min(vh - ph - pad, r.top)); }
  let left = Math.min(vw - pw - pad, Math.max(pad, r.left + r.width / 2 - pw / 2));
  if (top < r.bottom + m && top + ph > r.top - m && left < r.right + m && left + pw > r.left - m) { // would cover the target: move beside it
    left = r.left > pw + pad * 2 ? r.left - m - 14 - pw : Math.min(vw - pw - pad, r.right + m + 14);
  }
  pop.style.left = Math.round(left) + 'px'; pop.style.top = Math.round(top) + 'px';
}
function go(i) {
  if (i < 0) i = 0;
  if (i >= steps.length) { end(); return; }
  const target = steps[i];
  state.i = i; save(state);
  if (target.path !== location.pathname) { location.assign(target.path); return; }
  show();
}
async function show() {
  const step = steps[state.i]; current = step;
  if (!ui) { build(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true); document.addEventListener('keydown', onKey, true); }
  ui.count.textContent = step.last ? '' : 'Step ' + (state.i + 1) + ' of ' + (steps.length - 1);
  ui.h.textContent = step.title;
  ui.back.hidden = state.i === 0; ui.next.textContent = step.last ? 'Finish' : 'Next'; ui.skip.hidden = !!step.last;
  ui.pop.classList.toggle('is-last', !!step.last);
  const mine = state.i;
  let found = { el: null, note: '' };
  for (let t = 0; t < 30; t++) { found = resolve(step); if (found.el || (!step.target && !step.nav)) break; await new Promise(r => setTimeout(r, 120)); if (!ui || state.i !== mine) return; }
  ui.body.textContent = step.body + found.note;
  targetEl = found.el;
  if (targetEl) { targetEl.scrollIntoView({ block: 'center', behavior: motion() ? 'smooth' : 'auto' }); await new Promise(r => setTimeout(r, motion() ? 380 : 60)); }
  if (!ui || state.i !== mine) return;
  place(); ui.next.focus({ preventScroll: true });
}
function onKey(e) {
  if (!ui) return;
  if (e.key === 'Escape') { e.preventDefault(); end(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); ui.next.click(); }
  else if (e.key === 'ArrowLeft' && !ui.back.hidden) { e.preventDefault(); ui.back.click(); }
  else if (e.key === 'Tab') { const f = [...ui.pop.querySelectorAll('button:not([hidden])')]; if (!f.length) return; const first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } else if (!ui.pop.contains(document.activeElement)) { e.preventDefault(); first.focus(); } }
}
function start() {
  const params = new URLSearchParams(location.search);
  if (params.get('tour') === '1') { state = { i: 0, admin: adminPresent(), phone: matchMedia('(max-width:700px)').matches }; steps = buildSteps(state.admin, state.phone); save(state); if (steps[0].path !== location.pathname) { location.assign(steps[0].path); return; } show(); return; }
  state = load(); if (!state) return;
  steps = buildSteps(!!state.admin, !!state.phone);
  if (!steps[state.i] || steps[state.i].path !== location.pathname) { clear(); return; } // the member went elsewhere on their own: let them
  show();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
`;
