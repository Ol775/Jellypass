import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/index";
import { run } from "../src/db";
import { createInvite, hashToken } from "../src/invites";
import { createPreset } from "../src/presets";

const app = createApp({ jellyfin: (() => ({
  authenticate: async () => ({ id: 'pages-user', name: 'maya', isAdmin: false }),
  getUser: async () => ({ id: 'pages-user', name: 'maya', isAdmin: false, isDisabled: false }),
})) as never });
const get = (path: string, cookie?: string) => app.request(path, { headers: cookie ? { cookie } : {} }, env);
async function login() {
  const res = await app.request('/api/signin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'maya', password: 'password' }) }, env);
  expect(res.status).toBe(200);
  return res.headers.get('set-cookie')!.split(';')[0];
}
async function invite(name = 'Standard') {
  const preset = await createPreset(env.DB, { name, libraries: 'all', bitrateLimit: 0, remoteAccess: true, requestRights: 'request', membershipDays: null });
  const result = await createInvite(env.DB, { presetId: preset.id, email: 'jo@example.com', maxUses: 1, expiresInDays: 7, createdBy: 'Admin' });
  // createInvite persists only the SHA-256 hash, never the URL token.
  const row = await env.DB.prepare('SELECT token_hash FROM invites WHERE id = ?').bind(result.id).first<{token_hash:string}>();
  expect(row?.token_hash).toBe(await hashToken(result.token));
  return result.token;
}
function secure(response: Response, body: string) {
  expect(response.headers.get('content-security-policy')).toContain("script-src 'self' https://challenges.cloudflare.com");
  expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.get('cache-control')).toBe('no-store');
  const scripts = [...body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) { expect(script[1]).toMatch(/\bsrc=/); expect(script[2].trim()).toBe(''); }
  expect(body).not.toMatch(/\son(?:click|submit|load|error)=/i);
}
beforeEach(async () => {
  for (const table of ['invites', 'members', 'sessions', 'rate_limits']) await run(env.DB, `DELETE FROM ${table}`);
});
describe('HTML pages', () => {
  test.each([
    ['/signin', 'Sign in', 'Use your Jellyfin username and password.'],
    ['/forgot', 'Reset your password', 'Username or email'],
  ])('%s renders accessible forms and security headers', async (path, title, copy) => {
    const response = await get(path); const body = await response.text();
    expect(response.status).toBe(200); expect(body).toContain(`<title>${title} · Jellypass</title>`);
    expect(body).toContain(copy); expect(body).toContain('aria-live="polite"'); expect(body).toContain('<label'); secure(response, body);
  });
  test('sign in links to password reset', async () => {
    expect(await (await get('/signin')).text()).toContain('id="poster-wall"');
    expect(await (await get('/signin')).text()).toContain('<a href="/forgot">Forgot password?</a>');
  });
  test('production renders Turnstile with an escaped sitekey; beta does not', async () => {
    const response = await app.request('/signin', {}, { ...env, ENVIRONMENT: 'prod', TURNSTILE_SITEKEY: 'test-key"<b>' });
    const body = await response.text(); secure(response, body);
    expect(body).toContain('cf-turnstile'); expect(body).toContain('test-key&quot;&lt;b&gt;');
    expect(body).toContain('https://challenges.cloudflare.com/turnstile/v0/api.js');
    expect(await (await get('/signin')).text()).not.toContain('class="cf-turnstile"');
  });
  test('a valid invite renders its access and optional email', async () => {
    const response = await get('/join/' + await invite()); const body = await response.text();
    expect(response.status).toBe(200); expect(body).toContain('<title>Join Jellypass · Jellypass</title>');
    for (const copy of ['Standard', 'Every library', 'Watch away from home', 'Can request films and TV', 'jo@example.com', 'Get it on your screen']) expect(body).toContain(copy);
    expect(body).not.toMatch(/make it yours/i); expect(response.headers.get('referrer-policy')).toBe('no-referrer'); secure(response, body);
  });
  test('invalid invites have a friendly 404 without referrer leakage', async () => {
    const response = await get('/join/invalid'); const body = await response.text();
    expect(response.status).toBe(404); expect(body).toContain('This invite is not valid any more');
    expect(body).toContain('Ask an admin'); expect(response.headers.get('referrer-policy')).toBe('no-referrer'); secure(response, body);
  });
  test('invite preset HTML is escaped', async () => {
    const body = await (await get('/join/' + await invite('<b>Family</b>'))).text();
    expect(body).toContain('&lt;b&gt;Family&lt;/b&gt;'); expect(body).not.toContain('<b>Family</b>');
  });
  test.each(['/', '/welcome', '/join/continue'])('%s redirects an anonymous member to sign in', async path => {
    const response = await get(path); expect(response.status).toBe(302); expect(response.headers.get('location')).toBe('/signin');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  test('a forged session cannot open Home', async () => {
    expect((await get('/', 'jp_session=forged.signature')).headers.get('location')).toBe('/signin');
  });
  test('fresh existing members are welcomed', async () => {
    const cookie = await login(); const home = await get('/', cookie);
    expect(home.status).toBe(302); expect(home.headers.get('location')).toBe('/welcome');
    const response = await get('/welcome', cookie); const body = await response.text();
    expect(response.status).toBe(200); expect(body).toContain('<title>Welcome · Jellypass</title>');
    expect(body).toContain('Hi maya, welcome to the portal'); expect(body).toContain('Current Jellyfin password'); secure(response, body);
  });
  test('new members resume setup and completed members see Home', async () => {
    const cookie = await login();
    await run(env.DB, 'UPDATE members SET onboarding_state = ? WHERE jellyfin_id = ?', '{"kind":"new","step":"done"}', 'pages-user');
    expect((await get('/', cookie)).headers.get('location')).toBe('/join/continue');
    const continuation = await get('/join/continue', cookie); const body = await continuation.text();
    expect(continuation.status).toBe(200); expect(body).toContain('data-resume="true"'); expect(body).not.toMatch(/make it yours/i); secure(continuation, body);
    await run(env.DB, 'UPDATE members SET onboarding_state = ? WHERE jellyfin_id = ?', '{"kind":"new","done":true}', 'pages-user');
    const home = await get('/', cookie); const homeBody = await home.text();
    expect(home.status).toBe(200); expect(homeBody).toContain('<title>Home · Jellypass</title>'); secure(home, homeBody);
  });
});
describe('static assets', () => {
  test.each(['common.js', 'signin.js', 'forgot.js', 'join.js', 'welcome.js', 'app.css'])('%s has the right type and cache policy', async name => {
    const response = await get('/assets/' + name);
    expect(response.status).toBe(200); expect(response.headers.get('content-type')).toContain(name.endsWith('.css') ? 'text/css' : 'text/javascript');
    expect(response.headers.get('cache-control')).toBe('no-cache'); expect(response.headers.get('content-security-policy')).toBeNull();
    expect((await response.text()).length).toBeGreaterThan(100);
  });
  test('styles include mobile, dark and reduced-motion preferences', async () => {
    const body = await (await get('/assets/app.css')).text();
    for (const value of ['#0f766e', 'prefers-color-scheme:dark', 'prefers-reduced-motion:reduce', ':focus-visible', 'max-width:420px']) expect(body).toContain(value);
  });
  test('unknown assets are not served', async () => { expect((await get('/assets/missing.js')).status).toBe(404); });
});
