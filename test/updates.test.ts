import { describe, expect, test } from "vitest";
import changelogMd from "../CHANGELOG.md?raw";
import packageJson from "../package.json?raw";
import { isNewer, parseChangelog, parseVersion } from "../selfhost/updates";

describe("versions", () => {
  test("parse tags with or without v and ignore anything else", () => {
    expect(parseVersion("v1.2.3")).toEqual([1, 2, 3]);
    expect(parseVersion("1.2.3-beta.1")).toEqual([1, 2, 3]);
    expect(parseVersion("dev")).toBeNull();
    expect(parseVersion("1.2")).toBeNull();
  });
  test("newer means strictly newer, compared as numbers not text", () => {
    expect(isNewer("1.10.0", "1.9.9")).toBe(true);
    expect(isNewer("v2.0.0", "1.99.99")).toBe(true);
    expect(isNewer("1.0.0", "1.0.0")).toBe(false);
    expect(isNewer("1.0.0", "1.0.1")).toBe(false);
  });
  test("a dev build or an odd tag is never reported as outdated", () => {
    expect(isNewer("1.0.0", "dev")).toBe(false);
    expect(isNewer("nightly", "1.0.0")).toBe(false);
  });
});

describe("changelog", () => {
  const md = "# Changelog\n\nIntro text\n\n## [Unreleased]\n- later\n\n## [1.1.0] - 2026-12-01\n### Added\n- B\n\n## [1.0.0] - 2026-11-22\n- A\n\n## [0.9.0]\n- old\n";
  test("reads released versions newest first, skips Unreleased and the intro", () => {
    expect(parseChangelog(md).map((e) => [e.version, e.date])).toEqual([["1.1.0", "2026-12-01"], ["1.0.0", "2026-11-22"], ["0.9.0", null]]);
    expect(parseChangelog(md)[0].body).toContain("### Added");
  });
  test("honours the limit and survives empty or odd input", () => {
    expect(parseChangelog(md, 1)).toHaveLength(1);
    expect(parseChangelog("")).toEqual([]);
    expect(parseChangelog("## not a version\n- x")).toEqual([]);
  });
  test("the real CHANGELOG.md starts with the version in package.json", () => {
    expect(parseChangelog(changelogMd)[0].version).toBe(JSON.parse(packageJson).version);
  });
});
