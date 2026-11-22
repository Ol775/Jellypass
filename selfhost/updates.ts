/** "v1.2.3" or "1.2.3-beta.1" -> [1,2,3]. Anything that is not a version gives null. */
export function parseVersion(v: string): number[] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** True only when `latest` is a real version newer than `current`. A dev build (not a version) never counts as outdated. */
export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest), b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

export type ChangelogEntry = { version: string; date: string | null; body: string };

/** Reads a Keep a Changelog file: "## [1.2.0] - 2026-11-22" headings, newest first. "Unreleased" is skipped. */
export function parseChangelog(md: string, limit = 10): ChangelogEntry[] {
  const out: ChangelogEntry[] = [];
  const parts = md.split(/^## /m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const head = (nl < 0 ? part : part.slice(0, nl)).trim();
    const m = /^\[?v?([0-9][^\]\s]*)\]?(?:\s*[-–]\s*(\d{4}-\d{2}-\d{2}))?/.exec(head);
    if (!m || !parseVersion(m[1])) continue;
    out.push({ version: m[1], date: m[2] ?? null, body: (nl < 0 ? "" : part.slice(nl + 1)).trim() });
    if (out.length >= limit) break;
  }
  return out;
}
