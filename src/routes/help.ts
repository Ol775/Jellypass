import { Hono } from "hono";
import { requireSession, type AppEnv } from "../auth";
import { CLIENTS_SEED } from "../clients-seed";
import { loadClients, type JfClient } from "../jellyfin-clients";
import { OFFICIAL_DOCS } from "../official-docs";

export const helpRoutes = new Hono<AppEnv>();
helpRoutes.use("/api/help/clients", requireSession);

/** The app we recommend on Apple devices. It is third-party, so the daily jellyfin.org refresh never carries it: add it here. The official Apple apps keep their own recommendation. */
export const JELLYTV: JfClient = {
  id: "jellytv", name: "JellyTV", beta: false, recommended: true,
  description: "Our recommended app for iPhone, iPad and Apple TV. It is made by a third party rather than the Jellyfin project, and works with our server.",
  deviceTypes: ["Mobile", "TV"], platforms: ["iOS", "iPadOS", "tvOS"],
  links: [{ name: "App Store", url: "https://apps.apple.com/gb/app/jellytv/id6752357290" }], moreLinks: [],
};
export const withHouseClients = (clients: JfClient[]): JfClient[] => [JELLYTV, ...clients.filter((x) => x.id !== JELLYTV.id)];

helpRoutes.get("/api/help/clients", async (c) => {
  const data = await loadClients(c.env.DB, CLIENTS_SEED);
  return c.json({ updatedAt: data.updatedAt, source: data.source, clients: withHouseClients(data.clients.filter((x) => x.platforms.length)), docs: OFFICIAL_DOCS }, 200, { "cache-control": "private, max-age=300" });
});
