import { Hono } from "hono";
import type { AppEnv } from "../auth";
import type { Seerr } from "../seerr";

type Poster = { path: string; kind: "movie" | "tv" };
const posterPath = /^\/[A-Za-z0-9_-]{1,60}\.(jpg|png)$/;
// ponytail: per-isolate memory cache; move to the Cache API if Seerr load matters
let cache: { posters: Poster[]; expires: number } | undefined;
export function resetSigninPosterCache() { cache = undefined; }

async function currentPosters(seerr: Seerr): Promise<Poster[]> {
  if (cache && cache.expires > Date.now()) return cache.posters;
  try {
    const results = await seerr.trending();
    const films: Poster[] = [], tv: Poster[] = [];
    const seen = new Set<string>();
    for (const item of results) {
      if (!item || (item.mediaType !== "movie" && item.mediaType !== "tv") ||
          typeof item.posterPath !== "string" || !posterPath.test(item.posterPath) || seen.has(item.posterPath)) continue;
      seen.add(item.posterPath);
      (item.mediaType === "movie" ? films : tv).push({ path: item.posterPath, kind: item.mediaType });
    }
    const posters: Poster[] = [];
    for (let i = 0; i < Math.max(films.length, tv.length) && posters.length < 24; i++) {
      if (films[i]) posters.push(films[i]);
      if (tv[i] && posters.length < 24) posters.push(tv[i]);
    }
    cache = { posters, expires: Date.now() + 3600000 };
    return posters;
  } catch { return []; }
}

export const signinPosterRoutes = new Hono<AppEnv>();
signinPosterRoutes.get("/api/signin-posters", async (c) => {
  const posters = await currentPosters(c.var.seerr);
  return c.json({ posters: posters.map(({ path, kind }) => ({ url: `/api/signin-posters/img?path=${encodeURIComponent(path)}`, kind })) });
});

signinPosterRoutes.get("/api/signin-posters/img", async (c) => {
  const path = c.req.query("path") ?? "";
  if (!posterPath.test(path) || !(await currentPosters(c.var.seerr)).some(poster => poster.path === path)) {
    return c.json({ error: "not found" }, 404);
  }
  let res: Response;
  try { res = await c.var.fetch(`https://image.tmdb.org/t/p/w342${path}`, { redirect: "manual" }); }
  catch { return c.json({ error: "image unavailable" }, 502); }
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !contentType.startsWith("image/")) return c.json({ error: "not found" }, 404);
  return new Response(res.body, { headers: { "content-type": contentType, "cache-control": "public, max-age=86400" } });
});

// Login page layout, so the Jellypass card (from the branding "login disclaimer") sits under the profile icons where it is seen, not under four buttons
// below the fold. display:contents lets the page's own pieces be reordered; the card is the paragraph that holds .jp-card (needs :has, so
// older browsers just keep the card at the bottom). Specificity beats the branding CSS's own display rules. Not applied on TVs (html.layout-tv):
// Jellyfin's remote focus follows page order, a TV cannot open the link anyway, and the backdrop drift would only slow it down.
const LOGIN_LAYOUT = `html:not(.layout-tv) body #loginPage>.margin-auto-y{display:flex!important;flex-direction:column;align-items:center}
html:not(.layout-tv) body #loginPage .readOnlyContent,html:not(.layout-tv) body #loginPage .loginDisclaimerContainer,html:not(.layout-tv) body #loginPage .loginDisclaimer{display:contents!important}
html:not(.layout-tv) body #loginPage .visualLoginForm{order:1;width:100%}
html:not(.layout-tv) body #loginPage .readOnlyContent>button{order:3;width:min(380px,calc(100% - 32px))!important}
html:not(.layout-tv) body #loginPage .loginDisclaimer>p{order:4;margin:12px 16px 0;max-width:380px;text-align:center;color:var(--jp-muted,#a7a59c);font-size:13px;line-height:1.5}
html:not(.layout-tv) body #loginPage .loginDisclaimer>p:has(.jp-card){order:2;width:min(380px,calc(100% - 32px));margin:14px 0 4px}
html:not(.layout-tv) body #loginPage .loginDisclaimer>p:has(.support-btn){order:5}
html:not(.layout-tv) body #loginPage .loginDisclaimer>.jp-card{order:2;width:min(380px,calc(100% - 32px));margin:14px 0 4px;box-sizing:border-box} /* card not wrapped in a paragraph */
html:not(.layout-tv) body #loginPage .jp-card{margin:0}
@media(max-width:600px){html body #loginPage .jp-card small{display:none}}
html.layout-tv body #loginPage .jp-card{display:none!important}
html.layout-tv body #loginPage::before{animation:none!important}
`;

// Poster backdrop for Jellyfin's own login page: it @imports this stylesheet from branding CSS.
signinPosterRoutes.get("/api/signin-posters/jellyfin.css", async (c) => {
  const posters = await currentPosters(c.var.seerr);
  const origin = new URL(c.env.PUBLIC_URL).origin;
  const cols = 8, rows = 6, layers: string[] = [], pos: string[] = [];
  if (posters.length) for (let i = 0; i < cols * rows; i++) {
    const x = i % cols, y = Math.floor(i / cols);
    layers.push(`url("${origin}/api/signin-posters/img?path=${encodeURIComponent(posters[(x * 7 + y * 3) % posters.length].path)}")`);
    pos.push(`calc(${x} * 13vmax) calc(${y} * 19vmax)`);
  }
  const css = (layers.length ? `#loginPage::before{content:"";position:fixed;z-index:-1;pointer-events:none;left:50%;top:50%;width:104vmax;height:114vmax;margin:-57vmax 0 0 -52vmax;transform:rotate(-8deg);opacity:.34;background-image:${layers.join(",")};background-position:${pos.join(",")};background-size:12vmax 18vmax;background-repeat:no-repeat;animation:jp-drift 90s ease-in-out infinite alternate}@keyframes jp-drift{to{transform:rotate(-8deg) translateY(-6vmax)}}@media (prefers-reduced-motion:reduce){#loginPage::before{animation:none}}\n` : "") + LOGIN_LAYOUT;
  return new Response(css, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=300" } });
});
