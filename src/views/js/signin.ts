export const signinJs = String.raw`
import { $, api, click, submit, token, resetTurnstile } from '/assets/common.js';
const u8 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
let pending = '';
// Password right but two-step sign-in is on: swap the form for the second step.
function secondStep(mfa) {
  pending = mfa.token;
  for (const id of ['#signin-head', '#signin', '#magic-open', '#magic', '#magic-note']) $(id).hidden = true;
  $('#twostep').hidden = false;
  $('#use-passkey').hidden = !(mfa.passkey && window.PublicKeyCredential);
  $('#twostep-code').hidden = false; // recovery codes work for everyone, so the code box is always there
  if (!mfa.totp) $('#twostep-code label').textContent = 'Recovery code';
  $('#twostep h1').focus();
  if (mfa.totp) $('#twostep-input').focus();
}
submit('#signin', async () => {
  try {
    const r = await api('/api/signin', { username: $('#username').value.trim(), password: $('#password').value, turnstile: token() });
    $('#password').value = '';
    if (r.mfa) return secondStep(r.mfa);
    location.assign('/');
  } catch (error) {
    resetTurnstile();
    if (error.status === 429) error.message = 'Too many attempts. Take a moment and try again later.';
    throw error;
  }
});

submit('#twostep-code', async () => {
  try { await api('/api/signin/2fa', { token: pending, code: $('#twostep-input').value }); location.assign('/'); }
  catch (error) { if (error.status === 401 && /timed out|again/.test(error.message)) setTimeout(() => location.reload(), 1500); throw error; }
});
click('#use-passkey', async () => {
  const o = await api('/api/signin/passkey/options', { token: pending });
  let cred;
  try { cred = await navigator.credentials.get({ publicKey: { ...o, challenge: u8(o.challenge), allowCredentials: o.allowCredentials.map(c => ({ ...c, id: u8(c.id) })) } }); }
  catch { throw new Error('The passkey was not used. Try again, or use a code instead.'); }
  const r = cred.response;
  await api('/api/signin/passkey', { token: pending, id: cred.id, clientDataJSON: b64u(r.clientDataJSON), authenticatorData: b64u(r.authenticatorData), signature: b64u(r.signature) });
  location.assign('/');
});
$('#twostep-back').addEventListener('click', () => location.reload());
$('#magic-open').addEventListener('click', e => { const f = $('#magic'); f.hidden = !f.hidden; e.currentTarget.setAttribute('aria-expanded', String(!f.hidden)); if (!f.hidden) $('#magic-id').focus(); });
submit('#magic', async () => {
  $('#magic-note').textContent = '';
  const r = await api('/api/magic/request', { identifier: $('#magic-id').value.trim() });
  $('#magic-note').textContent = r.message;
});
`;
