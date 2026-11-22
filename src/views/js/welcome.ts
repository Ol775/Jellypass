export const welcomeJs = String.raw`
import { $, api, act, submit, click, session, countdown } from '/assets/common.js';
let skipped = [], ready = false;
function requireReady() { if (!ready) throw new Error('Your details are still loading. Please refresh the page and try again.'); }
// The tour itself now runs on the real site (see tour.js): finishing setup sends the member there.
async function finish() { requireReady(); await api('/api/onboarding', { step: 'done', skipped }, 'PUT').catch(() => {}); await api('/api/onboarding/complete'); location.assign('/?tour=1'); }
submit('#email', async () => {
  requireReady();
  await api('/api/email/send-code', { email: $('#email-address').value.trim(), password: $('#current-password').value });
  $('#current-password').value = '';
  $('#confirm-email').hidden = false;
  $('#email-status').textContent = 'Check your email. The code works for 10 minutes.';
  $('#email-code').focus();
  countdown($('#send-email-code'));
});
submit('#confirm-email', async () => {
  requireReady();
  await api('/api/email/confirm', { code: $('#email-code').value });
  $('#email-status').textContent = 'Email verified.';
  $('#confirm-email').hidden = true;
  $('#email-code').value = '';
});
click('#welcome-next', async () => { requireReady(); await api('/api/me/reminders', { on: $('#reminders').checked }, 'PUT'); await finish(); });
click('#welcome-skip', async () => { skipped = ['email', 'reminders']; await finish(); });
act(async () => {
  try {
    const data = await session();
    if (!data.needsOnboarding) { location.replace('/'); return; }
    if (data.state.kind === 'new') { location.replace('/join/continue'); return; }
    $('#email-address').value = data.contactEmail || '';
    $('#reminders').checked = data.remindersOn;
    $('#email-status').textContent = data.emailVerified ? 'Email verified.' : '';
    skipped = data.state.skipped || [];
    ready = true;
  } catch (error) { if (error.status === 401) location.replace('/signin'); else throw error; }
});
`;
