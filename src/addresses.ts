import type { Env } from "./env";

const trim = (u: string | undefined) => (u ?? "").replace(/\/$/, "");

/**
 * The Jellyfin address members' browsers and emails should use. Jellypass itself may reach Jellyfin by an address that only works
 * inside the server's network, so an optional separate address can be set. Without one, the connection address is used, which is
 * right whenever it is already the public one.
 */
export const jellyfinForMembers = (env: Pick<Env, "JELLYFIN_URL" | "JELLYFIN_PUBLIC_URL">) => trim(env.JELLYFIN_PUBLIC_URL || env.JELLYFIN_URL);

/** The same for Seerr (the "Open Seerr" buttons). Empty when Seerr is not set up. */
export const seerrForMembers = (env: Pick<Env, "SEERR_URL" | "SEERR_PUBLIC_URL">) => trim(env.SEERR_PUBLIC_URL || env.SEERR_URL);
