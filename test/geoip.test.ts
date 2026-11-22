import { describe, expect, test } from "vitest";
import { env } from "cloudflare:workers";
import { makeGeo } from "../src/geoip";
import { CITY_TEST_MMDB_B64 } from "./fixtures/city-test-mmdb";

const bytes = () => Uint8Array.from(atob(CITY_TEST_MMDB_B64), (c) => c.charCodeAt(0));
let n = 0;
async function geo() { const key = `geo-test-${n++}.mmdb`; await env.TILES.put(key, bytes()); return makeGeo(env.TILES, key); }

describe("local IP geolocation (MMDB in R2)", () => {
  test("finds city, country and coordinates for known IPv4 addresses", async () => {
    const g = await geo();
    expect(await g.lookup("81.2.69.142")).toMatchObject({ city: "London", country: "United Kingdom", countryCode: "GB" });
    const box = await g.lookup("2.125.160.216");
    expect(box?.city).toBe("Boxford");
    expect(box?.lat).toBeCloseTo(51.75, 1);
    expect(box?.lng).toBeCloseTo(-1.25, 1);
  });
  test("finds IPv6 addresses", async () => {
    const g = await geo();
    const r = await g.lookup("2a02:ff80::1");
    expect(r?.countryCode).toBe("DE"); // the test database maps this range to Germany
    expect(await g.lookup("2001:218::1")).toMatchObject({ countryCode: "JP" });
  });
  test("returns null for private, unknown and malformed input", async () => {
    const g = await geo();
    for (const ip of ["10.0.0.1", "192.168.1.5", "1.1.1.1", "", "not-an-ip", "999.1.1.1", "1.2.3", "::zz"]) expect(await g.lookup(ip), ip).toBeNull();
  });
  test("returns null, never throws, when the database is missing or corrupt", async () => {
    expect(await makeGeo(env.TILES, "absent.mmdb").lookup("81.2.69.142")).toBeNull();
    await env.TILES.put("junk.mmdb", new Uint8Array([1, 2, 3]));
    expect(await makeGeo(env.TILES, "junk.mmdb").lookup("81.2.69.142")).toBeNull();
  });
});
