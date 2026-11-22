export const forgotJs = String.raw`
import { $, api, submit, click, show, countdown } from '/assets/common.js';
let identifier = '';
async function requestCode() {
  await api('/api/reset/request', { identifier });
  show('verify');
  countdown($('#resend'));
}
submit('#request', async () => { identifier = $('#identifier').value.trim(); await requestCode(); });
click('#resend', requestCode);
click('#reset-back', () => show('request'));
submit('#verify', async () => {
  if ($('#newPassword').value !== $('#confirmPassword').value) {
    $('#confirmPassword').focus();
    throw new Error('The passwords do not match. Please check them.');
  }
  await api('/api/reset/verify', { identifier, code: $('#code').value, newPassword: $('#newPassword').value });
  $('#newPassword').value = $('#confirmPassword').value = $('#code').value = '';
  show('done');
});
`;
