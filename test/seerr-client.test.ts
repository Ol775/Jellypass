import { expect, test } from "vitest";
import { makeSeerr } from "../src/seerr";
import type { Env } from "../src/env";

test("the upstream key header is sent to Seerr when configured, and not otherwise", async () => {
  const seen: Array<string | null> = [];
  const f = (async (_u: string, init: RequestInit) => { seen.push(new Headers(init?.headers).get("x-jellypass-key")); return new Response(JSON.stringify({ results: [] })); }) as never;
  await makeSeerr({ SEERR_URL: "https://s.test", SEERR_API_KEY: "k", UPSTREAM_KEY: "k-123" } as Env, f).findUserByJellyfinId("x");
  await makeSeerr({ SEERR_URL: "https://s.test", SEERR_API_KEY: "k" } as Env, f).findUserByJellyfinId("x");
  await makeSeerr({ SEERR_URL: "https://s.test", SEERR_API_KEY: "k", UPSTREAM_KEY: "k-123" } as Env, f).status();
  expect(seen).toEqual(["k-123", null, "k-123"]);
});
