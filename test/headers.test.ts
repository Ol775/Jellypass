import { env } from "cloudflare:workers";
import { expect, test } from "vitest";
import { createApp } from "../src/index";

const app = createApp();
test("API responses are never cached and never sniffed, including errors", async () => {
  for (const path of ["/api/me", "/api/onboarding", "/api/nope"]) {
    const res = await app.request(path, {}, env);
    expect(res.headers.get("cache-control"), path).toBe("no-store");
    expect(res.headers.get("x-content-type-options"), path).toBe("nosniff");
  }
});
test("the poster and tile routes opt back in to private caching on their own", async () => {
  const res = await app.request("/api/discover/poster?path=%2Fx.jpg", {}, env); // 401 here, but still not publicly cacheable
  expect(res.headers.get("cache-control")).not.toMatch(/public/);
});
