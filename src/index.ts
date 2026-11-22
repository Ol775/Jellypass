import { Hono } from "hono";
import { requireAdmin, requireSession, type AppEnv } from "./auth";
import type { Env } from "./env";
import { makeAsn, makeGeo, type Asn, type Geo } from "./geoip";
import { effectiveEnv } from "./keys";
import { setEmailBase } from "./emails";
import { testIntegration, type IntegrationTester } from "./integrations";
import { keyRoutes } from "./routes/keys";
import { selfhostRoutes } from "./routes/selfhost";
import { runScheduled } from "./cron";
import { makeJellyfin, type Jellyfin } from "./jellyfin";
import { cloudflareMailer, type Mailer } from "./mail";
import { makeTracearr, type Tracearr } from "./tracearr";
import { makeSeerr, type Seerr } from "./seerr";
import { inviteRoutes } from "./routes/invites";
import { authRoutes } from "./routes/auth";
import { mfaRoutes } from "./routes/mfa";
import { emailVerifyRoutes } from "./routes/email-verify";
import { onboardingRoutes } from "./routes/onboarding";
import { pageRoutes } from "./routes/pages";
import { signinRoutes } from "./routes/signins";
import { signinPosterRoutes } from "./routes/signin-posters";
import { accountRoutes } from "./routes/account";
import { historyRoutes } from "./routes/history";
import { compareRoutes } from "./routes/compare";
import { discoverRoutes } from "./routes/discover";
import { adminRoutes } from "./routes/admin";
import { statusRoutes } from "./routes/status";
import { homeRoutes } from "./routes/home";
import { presetRoutes } from "./routes/presets";
import { avatarRoutes } from "./routes/avatar";
import { resetRoutes } from "./routes/reset";
import { securityRoutes } from "./routes/security";
import { helpRoutes } from "./routes/help";
import { pushRoutes } from "./routes/push";
import { noticeRoutes } from "./routes/notices";
import { maintenanceGate } from "./maintenance";
import { notFoundPage } from "./views/error-pages";

export type Deps = { geo?: (env: Env) => Geo; asn?: (env: Env) => Asn; jellyfin?: (env: Env) => Jellyfin; mailer?: (env: Env) => Mailer; seerr?: (env: Env) => Seerr; fetch?: typeof fetch; tracearr?: (env: Env) => Tracearr; testIntegration?: IntegrationTester };

export function createApp(deps: Deps = {}) {
  const app = new Hono<AppEnv>();
  let defaultGeo: Geo | undefined, defaultAsn: Asn | undefined;
  app.use("*", async (c, next) => {
    // Keys an admin stored from the app override the Worker secrets. Static assets never need them.
    const e = c.req.path.startsWith("/assets/") ? c.env : await effectiveEnv(c.env);
    c.set("jf", (deps.jellyfin ?? makeJellyfin)(e));
    c.set("tracearr", (deps.tracearr ?? makeTracearr)(e));
    c.set("testIntegration", deps.testIntegration ?? testIntegration);
    c.set("fetch", deps.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))); // a bare `fetch` stored on c.var throws "Illegal invocation" in Workers when called as c.var.fetch(...)
    c.set("seerr", (deps.seerr ?? makeSeerr)(e));
    setEmailBase(c.env.PUBLIC_URL);
    c.set("mailer", (deps.mailer ?? cloudflareMailer)(c.env));
    c.set("geo", (deps.geo ?? ((e: Env) => defaultGeo ??= makeGeo(e.TILES)))(c.env));
    c.set("asn", (deps.asn ?? ((e: Env) => defaultAsn ??= makeAsn(e.TILES)))(c.env));
    await next();
  });
  // JSON answers are personal: never cached, never sniffed. Routes that serve images/tiles set their own private caching.
  app.use("/api/*", async (c, next) => {
    await next();
    if (!c.res.headers.has("cache-control")) c.res.headers.set("cache-control", "no-store");
    c.res.headers.set("x-content-type-options", "nosniff");
  });
  app.use("*", async (c, next) => { await next(); c.res.headers.set("x-robots-tag", "noindex, nofollow, noarchive"); }); // nothing here is for search engines
  app.use("*", maintenanceGate);
  app.notFound((c) => (c.req.path.startsWith("/api/") ? c.json({ error: "not found" }, 404) : c.html(notFoundPage(), 404)));
  app.get("/health", (c) => c.json({ ok: true, env: c.env.ENVIRONMENT }));
  // Every /api/admin/* route, from any module, needs a session and a fresh admin check.
  app.use("/api/admin/*", requireSession, requireAdmin);
  app.route("/", avatarRoutes);
  app.route("/", authRoutes);
  app.route("/", mfaRoutes);
  app.route("/", presetRoutes);
  app.route("/", pageRoutes);
  app.route("/", inviteRoutes);
  app.route("/", onboardingRoutes);
  app.route("/", signinRoutes);
  app.route("/", signinPosterRoutes);
  app.route("/", historyRoutes);
  app.route("/", compareRoutes);
  app.route("/", homeRoutes);
  app.route("/", discoverRoutes);
  app.route("/", adminRoutes);
  app.route("/", securityRoutes);
  app.route("/", helpRoutes);
  app.route("/", keyRoutes);
  app.route("/", selfhostRoutes);
  app.route("/", statusRoutes);
  app.route("/", accountRoutes);
  app.route("/", pushRoutes);
  app.route("/", noticeRoutes);
  app.route("/", resetRoutes);
  app.route("/", emailVerifyRoutes);
  return app;
}

export const app = createApp();

export default {
  fetch: app.fetch,
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    setEmailBase(env.PUBLIC_URL);
    ctx.waitUntil((async () => { const e = await effectiveEnv(env); await runScheduled({ env: e, db: env.DB, jf: makeJellyfin(e), seerr: makeSeerr(e), mailer: cloudflareMailer(env), baseUrl: env.PUBLIC_URL }, new Date(controller.scheduledTime)); })());
  },
};
