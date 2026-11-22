export const joinJs = String.raw`
import { $, api, act, submit, click, show, session, setCsrf, token, resetTurnstile } from '/assets/common.js';
const resuming = $('#join').dataset.resume === 'true';
const inviteToken = decodeURIComponent(location.pathname.split('/').pop());
const storageKey = 'jellypass-join:' + inviteToken;
let experience = 'new', skipped = [], signedIn = false, redeemed = false, current = 'welcome';
function remember() {
  if (signedIn) return;
  try { sessionStorage.setItem(storageKey, JSON.stringify({ experience, step: current, username: $('#username').value, contactEmail: $('#contactEmail').value })); } catch {}
}
function render(step) {
  current = step;
  show(step);
  const steps = experience === 'new' ? ['welcome', 'account', 'device', 'done'] : ['welcome', 'account', 'done'];
  $('#progress').textContent = 'Step ' + (steps.indexOf(step) + 1) + ' of ' + steps.length + ' · ' + ({welcome:'Welcome',account:'Create your account',device:'Device setup',done:'Ready to watch'})[step];
  $('#done-back').hidden = experience !== 'new';
  remember();
}
async function move(step) {
  if (signedIn) await api('/api/onboarding', { step, experience, skipped }, 'PUT');
  render(step);
}
function checkUsername() {
  const name = $('#username').value.trim();
  const valid = /^[\p{L}\p{N} _.'-]{1,64}$/u.test(name);
  const message = valid ? '' : "Use 1–64 characters: letters, numbers, spaces and _ . ' - only. No @.";
  $('#username').setCustomValidity(message);
  $('#username-hint').textContent = message || 'That format looks good. We will check availability when you continue.';
}
$('#username').addEventListener('input', () => { checkUsername(); remember(); });
$('#contactEmail').addEventListener('input', remember);
document.querySelectorAll('[name="experience"]').forEach(input => input.addEventListener('change', () => { experience = input.value; render('welcome'); }));
click('#start', () => move('account'));
click('#account-back', () => move('welcome'));
submit('#account', async () => {
  if (signedIn) { await move(experience === 'new' ? 'device' : 'done'); return; }
  checkUsername();
  if (!$('#account').reportValidity()) return;
  const username = $('#username').value.trim(), password = $('#password').value;
  if (!redeemed) {
    await api('/api/invites/redeem', { token: inviteToken, username, password, contactEmail: $('#contactEmail').value.trim() || undefined });
    redeemed = true;
    $('#username').readOnly = true;
    $('#contactEmail').readOnly = true;
    $('#create-account').textContent = 'Sign in and continue';
    $('#signin-recovery').hidden = false;
    $('#account-back').hidden = true;
  }
  try {
    const result = await api('/api/signin', { username, password, turnstile: token() });
    setCsrf(result.csrf);
    signedIn = true;
    $('#password').value = '';
    $('#password').required = false;
    $('#create-account').textContent = 'Continue setup';
    try { sessionStorage.removeItem(storageKey); } catch {}
    // Replace the consumed invite URL only after the session exists.
    history.replaceState(null, '', '/join/continue');
    await move(experience === 'new' ? 'device' : 'done');
  } catch (error) {
    resetTurnstile();
    error.message = 'Your account is ready. ' + error.message + ' You can also sign in to continue setup.';
    throw error;
  }
});
submit('#quickconnect', async () => {
  try { await api('/api/onboarding/quickconnect', { code: $('#device-code').value }); }
  catch (error) {
    if (error.status === 400) error.message = 'Enter the 6-digit code shown on your TV.';
    if (error.status === 422) error.message = 'That code did not work. Check the code on your TV and try again.';
    if (error.status === 429) error.message = 'Too many tries. Wait a few minutes, then try again.';
    throw error;
  }
  $('#connected').textContent = 'Your device is connected.';
  $('#device-next').hidden = false;
});
click('#device-next', () => { skipped = skipped.filter(step => step !== 'device'); return move('done'); });
click('#skip-device', () => { skipped = [...new Set([...skipped, 'device'])]; return move('done'); });
click('#done-back', () => move('device'));
click('#finish', async () => {
  await api('/api/onboarding/complete');
  $('#finish').hidden = $('#done-back').hidden = true;
  $('#portal').hidden = false;
  $('#portal').focus();
  $('#status').textContent = 'All set. Welcome to Jellypass.';
});
act(async () => {
  if (resuming) {
    try {
      const data = await session(); signedIn = true;
      if (!data.needsOnboarding) { location.replace('/'); return; }
      if (data.state.kind !== 'new') { location.replace('/welcome'); return; }
      experience = data.state.experience || 'new'; skipped = data.state.skipped || [];
      await move(experience === 'knows-jellyfin' || data.state.step === 'done' ? 'done' : 'device');
    } catch (error) { if (error.status === 401) location.replace('/signin'); else throw error; }
    return;
  }
  // Revalidate the invitation before collecting account details.
  await api('/api/invites/' + encodeURIComponent(inviteToken), null, 'GET');
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || '{}');
    experience = saved.experience === 'knows-jellyfin' ? saved.experience : 'new';
    $('[name="experience"][value="' + experience + '"]').checked = true;
    if (typeof saved.username === 'string') $('#username').value = saved.username;
    if (typeof saved.contactEmail === 'string') $('#contactEmail').value = saved.contactEmail;
    render(saved.step === 'account' ? 'account' : 'welcome');
  } catch { render('welcome'); }
});
`;
