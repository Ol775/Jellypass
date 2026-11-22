import type { Env } from "../env";
import type { Jellyfin } from "../jellyfin";
import type { Mailer } from "../mail";
import type { Seerr } from "../seerr";

export interface CronDeps { env: Env; db: D1Database; jf: Jellyfin; seerr: Seerr; mailer: Mailer; baseUrl: string; fetch?: typeof fetch }
