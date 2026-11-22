import { env } from "cloudflare:workers";
import { expect, test } from "vitest";
import { app } from "../src/index";

test("GET /health reports ok and the environment", async () => {
  const res = await app.request("/health", {}, env);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, env: "beta" });
});
