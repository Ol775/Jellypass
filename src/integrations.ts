import type { Env } from "./env";
import { makeJellyfin } from "./jellyfin";
import { makeSeerr } from "./seerr";
import { makeTracearr } from "./tracearr";

export type TestResult = { ok: true } | { ok: false; rejected: boolean; error: string };
export type IntegrationTester = (integration: string, env: Env) => Promise<TestResult>;
export const INTEGRATIONS = ["jellyfin", "seerr", "tracearr"] as const;

/** One cheap authenticated read per service. 401/403 means the key was refused; anything else means we could not tell. */
export const testIntegration: IntegrationTester = async (integration, env) => {
  try {
    if (integration === "jellyfin") await makeJellyfin(env).listUsers();
    else if (integration === "seerr") await makeSeerr(env).ping();
    else if (integration === "tracearr") await makeTracearr(env).liveStreams();
    else return { ok: false, rejected: false, error: "unknown integration" };
    return { ok: true };
  } catch (e) {
    const status = (e as { status?: number }).status;
    return { ok: false, rejected: status === 401 || status === 403, error: status ? `the service answered ${status}` : "could not reach the service" };
  }
};
