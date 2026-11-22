import { run } from '../db';
import { emailOn } from '../mail';
import { Hono } from "hono";
import { LOGO_PNG_BASE64 } from "../emails/logo";
import { html } from "hono/html";
import { loadSession, type AppEnv } from "../auth";
import { getMember } from "../members";
import type { OnboardingState } from "../onboarding";
import { inviteRoutes } from "./invites";
import { secureRoutes } from "./secure";
import { css } from "../views/css";
import { layout } from "../views/layout";
import { forgot, invalidInvite, join, signin, welcome, type InviteView } from "../views/pages";
import { commonJs } from "../views/js/common";
import { signinJs } from "../views/js/signin";
import { forgotJs } from "../views/js/forgot";
import { joinJs } from "../views/js/join";
import { welcomeJs } from "../views/js/welcome";

import { adminPageRoutes } from './admin-pages';
import { adminJs } from '../views/js/admin';
import { memberPageRoutes } from './member-pages';
import { themeJs } from '../views/js/theme';
import { wallJs } from '../views/js/wall';
import { tourJs } from '../views/js/tour';
import { shellJs } from '../views/js/shell';
import { scrollJs } from '../views/js/scroll';
import { memberJs } from '../views/js/member';
import { magicRoutes } from './magic';
import { swJs } from '../views/js/sw';
import { ICON_PNG, ICON_SVG } from '../views/icons';
import { devicesMapJs } from '../views/js/devices-map';
import { vendorAssets } from '../views/vendor/assets';
import { glyphs } from '../views/vendor/glyphs';
import { jellyfinForMembers } from "../addresses";
export const pageRoutes = new Hono<AppEnv>();
const csp = "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
pageRoutes.use('*', async (c, next) => {
  await next();
  if (!c.res.headers.get('content-type')?.startsWith('text/html') || c.req.path.startsWith('/api/')) return; // API responses (the invite email preview) set their own policy
  let policy = csp;
  if (c.req.path === '/' || c.req.path === '/history' || c.req.path === '/admin/streams' || c.req.path === '/wrapped' || c.req.path === '/compare') policy = policy.replace("img-src 'self' data:", "img-src 'self' data: " + new URL(jellyfinForMembers(c.env)).origin);
  if (c.req.path === '/admin/invites') policy = policy.replace('frame-src https://challenges.cloudflare.com', "frame-src 'self'"); // the real invite email preview
  if (c.req.path === '/admin/streams') policy = policy.replace("frame-src", "worker-src blob:; child-src blob:; frame-src").replace("data: " + new URL(jellyfinForMembers(c.env)).origin, "data: blob: " + new URL(jellyfinForMembers(c.env)).origin); // the live streams map
  if (c.req.path === '/devices') policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src blob:; child-src blob:; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
  c.header('Content-Security-Policy', policy);
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', c.req.path.startsWith('/join/') ? 'no-referrer' : 'same-origin');
  c.header('Cache-Control', 'no-store');
});
const assets: Record<string, string> = { 'admin.js': adminJs, 'shell.js': shellJs, 'scroll.js': scrollJs, 'member.js': memberJs, 'devices-map.js': devicesMapJs, 'common.js': commonJs, 'signin.js': signinJs, 'forgot.js': forgotJs, 'join.js': joinJs, 'welcome.js': welcomeJs, 'app.css': css, 'theme.js': themeJs, 'wall.js': wallJs, 'tour.js': tourJs };
pageRoutes.get('/assets/email-logo.png', c => c.body(Uint8Array.from(atob(LOGO_PNG_BASE64), ch => ch.charCodeAt(0)), 200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' }));
// Icons: tab (SVG, with a PNG fallback), Home Screen and notifications.
const png = (b64: string) => (c: any) => c.body(Uint8Array.from(atob(b64), ch => ch.charCodeAt(0)), 200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
pageRoutes.get('/favicon.svg', c => c.body(ICON_SVG, 200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' }));
pageRoutes.get('/favicon.ico', png(ICON_PNG[32]));
pageRoutes.get('/apple-touch-icon.png', png(ICON_PNG[180]));
pageRoutes.get('/assets/icon-192.png', png(ICON_PNG[192]));
pageRoutes.get('/assets/icon-512.png', png(ICON_PNG[512]));
// Not for search engines: nothing here should be indexed. The sitemap is a hidden page map (no link to it anywhere, not in robots.txt, admin pages left out).
pageRoutes.get('/robots.txt', c => c.text('User-agent: *\nDisallow: /\n', 200, { 'Cache-Control': 'public, max-age=86400' }));
pageRoutes.get('/sitemap.xml', c => c.body(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['/', '/signin', '/forgot', '/discover', '/history', '/wrapped', '/devices', '/account', '/settings', '/status', '/help'].map(p => `<url><loc>${c.env.PUBLIC_URL}${p === '/' ? '/' : p}</loc></url>`).join('\n')}\n</urlset>\n`, 200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }));
// Lets phones install Jellypass to the Home Screen, which iPhones require before they offer push notices.
pageRoutes.get('/manifest.webmanifest', c => c.body(JSON.stringify({ name: 'Jellypass', short_name: 'Jellypass', start_url: '/', scope: '/', display: 'standalone', background_color: '#111111', theme_color: '#2dd4bf', icons: [{ src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }] }), 200, { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' }));
// The push service worker must live at the root so its scope covers the whole site. It only shows notices and opens a link when one is tapped.
pageRoutes.get('/sw.js', c => c.body(swJs, 200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Service-Worker-Allowed': '/' }));
pageRoutes.get('/assets/:name', c => {
  const name = c.req.param('name');
  if (!Object.hasOwn(assets, name)) return c.notFound();
  return c.body(assets[name], 200, { 'Content-Type': name.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }); // always revalidate: HTML is never cached, so a stale script would not match new markup
});
async function onboarding(db: D1Database, id: string): Promise<OnboardingState> {
  const member = await getMember(db, id);
  try { return JSON.parse(member?.onboarding_state ?? '{}') ?? {}; } catch { return {}; }
}
pageRoutes.get('/signin', c => c.html(signin(c.env.ENVIRONMENT === 'prod' && !!c.env.TURNSTILE_SITEKEY, c.env.TURNSTILE_SITEKEY, emailOn(c.env))));
pageRoutes.get('/forgot', c => c.html(forgot(emailOn(c.env))));
pageRoutes.route('/', secureRoutes);
pageRoutes.route('/', magicRoutes);
pageRoutes.route('/', memberPageRoutes);
pageRoutes.route('/', adminPageRoutes);
pageRoutes.get('/welcome', async c => {
  c.header('Cache-Control', 'no-store');
  const session = await loadSession(c);
  if (!session) return c.redirect('/signin', 302);
  const state = await onboarding(c.env.DB, session.jellyfinId);
  if (c.req.query('replay') === '1') return c.redirect('/?tour=1', 302); // older links: the tour runs on the real site now
  if (state.done) return c.redirect('/', 302);
  if (!emailOn(c.env) && state.kind !== 'new') { await run(c.env.DB, 'UPDATE members SET onboarding_state = ? WHERE jellyfin_id = ?', JSON.stringify({ ...state, done: true }), session.jellyfinId); return c.redirect('/', 302); } // email off: the welcome has nothing to ask
  if (state.kind === 'new') return c.redirect('/join/continue', 302);
  return c.html(welcome(session.username));
});
pageRoutes.get('/join/continue', async c => {
  c.header('Cache-Control', 'no-store');
  c.header('Referrer-Policy', 'no-referrer');
  const session = await loadSession(c);
  if (!session) return c.redirect('/signin', 302);
  const state = await onboarding(c.env.DB, session.jellyfinId);
  if (state.done) return c.redirect('/', 302);
  if (state.kind !== 'new') return c.redirect('/welcome', 302);
  return c.html(join(null, false, undefined, jellyfinForMembers(c.env), state.step === "done" || state.experience === "knows-jellyfin" ? "done" : "device", emailOn(c.env)));
});
pageRoutes.get('/join/:token', async c => {
  // Use the same public API contract for the first server-rendered view and client revalidation.
  const response = await inviteRoutes.request(`/api/invites/${encodeURIComponent(c.req.param('token'))}`, {}, c.env);
  if (response.status === 404) return c.html(invalidInvite(), 404);
  if (!response.ok) return c.html(layout({ title: 'Invite unavailable', body: html`<main class="center"><div class="card authcard"><h1>We could not load your invite</h1><p>Please try again in a moment.</p></div></main>` }), 503);
  return c.html(join(await response.json() as InviteView, c.env.ENVIRONMENT === 'prod' && !!c.env.TURNSTILE_SITEKEY, c.env.TURNSTILE_SITEKEY, jellyfinForMembers(c.env), undefined, emailOn(c.env)));
});

// Map label fonts, served from the Worker. Only the one bundled font and the ranges we ship.
pageRoutes.get('/assets/glyphs/:font/:range', c => {
 const data = c.req.param('font') === 'Noto Sans Regular' ? glyphs[c.req.param('range').replace(/\.pbf$/, '')] : undefined;
 if (!data) return c.body(null, 404);
 return c.body(Uint8Array.from(atob(data), ch => ch.charCodeAt(0)), 200, { 'Content-Type': 'application/x-protobuf', 'Cache-Control': 'public, max-age=31536000', 'X-Content-Type-Options': 'nosniff' });
});
pageRoutes.get('/assets/vendor/:name', c => {
 const name=c.req.param('name');
 if(!['maplibre.js','maplibre.css','pmtiles.js','qrcode.js'].includes(name))return c.notFound();
 if(!Object.hasOwn(vendorAssets,name))return c.text('Map assets unavailable. Install maplibre-gl and pmtiles, then run node scripts/vendor.mjs.',503);
 return c.body(vendorAssets[name],200,{'Content-Type':name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'public, max-age=31536000','X-Content-Type-Options':'nosniff'});
});
