import { Hono } from 'hono';
import { requireAdmin, requireSession, type AppEnv } from '../auth';

/** Only plain raster images are ever served from the app origin; the type comes from us, not from Jellyfin's header. */
const SAFE = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export const avatarRoutes = new Hono<AppEnv>();
avatarRoutes.get('/api/avatar/:id', requireSession, async (c) => {
  const id = c.req.param('id') === 'me' ? c.var.session.jellyfinId : c.req.param('id');
  if (!/^[0-9a-f]{32}$/i.test(id)) return c.json({ error: 'invalid user id' }, 400);
  if (id.toLowerCase() !== c.var.session.jellyfinId.toLowerCase()) {
    const denied = await requireAdmin(c, async () => {});
    if (denied) return denied;
  }
  const picture = await c.var.jf.avatar(id);
  if (!picture) return c.json({ error: 'no profile picture' }, 404);
  const type = (picture.contentType.split(';')[0] || '').trim().toLowerCase();
  if (!SAFE.has(type)) return c.json({ error: 'unsupported image type' }, 415);
  return c.body(picture.body, 200, {
    'Content-Type': type,
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Content-Disposition': 'inline; filename="avatar"',
    'Cache-Control': 'private, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
});
