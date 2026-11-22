import { sign } from "./auth";
import type { Env } from "./env";

/** Uniform 6-digit code using rejection sampling (no modulo bias). */
export function sixDigitCode(): string {
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

/** Keyed hash so a leaked database cannot be brute-forced offline without the session secret. */
export const hashCode = (env: Env, scope: string, code: string) => sign(env.SESSION_SECRET, `code:${scope}:${code}`);
