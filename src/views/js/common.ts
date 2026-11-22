/** Browser ES module, served verbatim; no build step or inline execution. */
export const commonJs = String.raw`
export const $ = (selector) => document.querySelector(selector);
export let csrf = '';
export function setCsrf(value) { csrf = value; }
export async function api(path, body, method = 'POST') {
  const response = await fetch(path, { method, credentials: 'same-origin', headers: { 'content-type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) }, ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Something went wrong. Please try again.');
    error.status = response.status;
    throw error;
  }
  return data;
}
export async function session() {
  const me = await api('/api/me', null, 'GET');
  setCsrf(me.csrf);
  return api('/api/onboarding', null, 'GET');
}
export function show(step) {
  document.querySelectorAll('[data-step]').forEach(el => { el.hidden = el.dataset.step !== step; });
  $('#error').textContent = '';
  $('[data-step="' + step + '"] h1')?.focus();
}
let busy = false;
export async function act(fn, target) {
  if (busy) return;
  busy = true;
  const controls = [...document.querySelectorAll('button')].filter(el => !el.disabled);
  controls.forEach(el => { el.disabled = true; });
  $('#error').textContent = '';
  target?.setAttribute('aria-busy', 'true');
  try { await fn(); }
  catch (error) {
    $('#error').textContent = error instanceof TypeError ? 'We could not connect. Check your connection and try again.' : error.message;
    $('#error').focus();
  } finally {
    busy = false;
    controls.forEach(el => { el.disabled = false; });
    target?.removeAttribute('aria-busy');
  }
}
export function submit(id, fn) { $(id).addEventListener('submit', event => { event.preventDefault(); act(fn, event.currentTarget); }); }
export function click(id, fn) { $(id).addEventListener('click', event => act(fn, event.currentTarget)); }
export function token() { return $('[name="cf-turnstile-response"]')?.value || undefined; }
export function resetTurnstile() { window.turnstile?.reset(); }
export function countdown(button, seconds = 30) {
  const until = Date.now() + seconds * 1000;
  const tick = () => { const left = Math.max(0, Math.ceil((until - Date.now()) / 1000)); button.disabled = left > 0; button.textContent = left ? 'Resend in ' + left + 's' : 'Resend code'; if (left) setTimeout(tick, 250); };
  // Run after act restores buttons.
  setTimeout(tick, 0);
}
document.querySelectorAll('[data-password]').forEach(button => button.addEventListener('click', () => {
  const input = document.getElementById(button.dataset.password);
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  button.textContent = reveal ? 'Hide' : 'Show';
  button.setAttribute('aria-label', (reveal ? 'Hide ' : 'Show ') + document.querySelector('label[for="' + input.id + '"]').textContent.toLowerCase());
}));
document.querySelectorAll('input[autocomplete="new-password"]').forEach(input => input.addEventListener('input', () => {
  const hint = document.getElementById(input.id + '-hint');
  if (hint) hint.textContent = input.value.length < 8 ? 'At least 8 characters. A long phrase works well.' : input.value.length < 12 ? 'Okay. A few more words would help.' : 'Good. Long phrases work well.';
}));
`;
