import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations, SESSION_SECRET: "test-secret", JELLYFIN_URL: "https://jf.test", JELLYFIN_ADMIN_KEY: "test-key", SEERR_URL: "https://seerr.test" } },
      }),
    ],
    test: { setupFiles: ["./test/setup.ts"] },
  };
});
