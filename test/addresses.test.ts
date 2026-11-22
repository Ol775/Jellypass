import { describe, expect, test } from "vitest";
import { jellyfinForMembers, seerrForMembers } from "../src/addresses";

describe("addresses for members", () => {
  test("a separate public address wins; otherwise the connection address is used; trailing slashes go", () => {
    expect(jellyfinForMembers({ JELLYFIN_URL: "http://192.168.1.10:8096" })).toBe("http://192.168.1.10:8096");
    expect(jellyfinForMembers({ JELLYFIN_URL: "http://192.168.1.10:8096/", JELLYFIN_PUBLIC_URL: "https://watch.example.com/" })).toBe("https://watch.example.com");
    expect(jellyfinForMembers({ JELLYFIN_URL: "http://jf:8096", JELLYFIN_PUBLIC_URL: "" })).toBe("http://jf:8096");
    expect(seerrForMembers({ SEERR_URL: "http://seerr:5055", SEERR_PUBLIC_URL: "https://requests.example.com" })).toBe("https://requests.example.com");
  });
  test("Seerr stays empty when it is not set up, so its buttons stay hidden", () => {
    expect(seerrForMembers({ SEERR_URL: "" })).toBe("");
    expect(seerrForMembers({ SEERR_URL: undefined as never })).toBe("");
  });
});
