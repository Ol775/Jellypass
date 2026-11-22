export const STEPS = ["welcome", "account", "device", "done", "tour"] as const;
export const SKIPPABLE = ["device", "email", "reminders"] as const;
export const TOUR_LENGTH = 7;

export interface OnboardingState {
  kind?: "new" | "existing";
  step?: (typeof STEPS)[number];
  experience?: "new" | "knows-jellyfin";
  tourIndex?: number;
  skipped?: string[];
  done?: boolean;
}

/** Whitelist-parse a client patch. Unknown keys are dropped; wrong types or values throw. */
export function parsePatch(b: any): OnboardingState {
  const out: OnboardingState = {};
  if (b?.kind !== undefined) { if (b.kind !== "new" && b.kind !== "existing") throw new Error("bad kind"); out.kind = b.kind; }
  if (b?.step !== undefined) { if (!STEPS.includes(b.step)) throw new Error("bad step"); out.step = b.step; }
  if (b?.experience !== undefined) { if (b.experience !== "new" && b.experience !== "knows-jellyfin") throw new Error("bad experience"); out.experience = b.experience; }
  if (b?.tourIndex !== undefined) { if (!Number.isInteger(b.tourIndex) || b.tourIndex < 0 || b.tourIndex >= TOUR_LENGTH) throw new Error("bad tourIndex"); out.tourIndex = b.tourIndex; }
  if (b?.skipped !== undefined) { if (!Array.isArray(b.skipped) || !b.skipped.every((s: unknown) => SKIPPABLE.includes(s as never))) throw new Error("bad skipped"); out.skipped = [...new Set<string>(b.skipped)]; }
  return out;
}
