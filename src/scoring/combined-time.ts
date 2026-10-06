import { Score, Attempt, adjustedTime } from "./types";

export function scoreCombinedTime(
  attempts: Attempt[],
  config: { requiredPasses?: number } = {}
): Score {
  const requiredPasses = config.requiredPasses ?? 2;
  if (!Number.isInteger(requiredPasses) || requiredPasses < 1 || requiredPasses > 100) {
    return { eligible: false, group: "none", primary: null, direction: "asc", tieBreakers: [],
      label: "Invalid required pass count", details: { error: "Invalid required pass count" } };
  }
  // strictly require passes 1 through requiredPasses to be valid times
  const ordinals = Array.from({ length: requiredPasses }, (_, i) => i + 1);
  const byOrdinal = new Map(attempts.map((a) => [a.ordinal, a]));
  const selectedAttempts = ordinals.map((ord) => byOrdinal.get(ord));

  const times = selectedAttempts.map(a => a ? adjustedTime(a) : null);
  const hasInvalid = times.some(t => t === null);

  if (hasInvalid) {
    return {
      eligible: false,
      group: "none",
      primary: null,
      direction: "asc",
      tieBreakers: [],
      label: `DNF / DQ`,
      details: {},
    };
  }

  // Sum the times of the required passes
  const sumMs = times.reduce<number>((acc, time) => acc + time!, 0);

  return {
    eligible: true,
    group: "timed",
    primary: sumMs,
    direction: "asc",
    tieBreakers: [sumMs],
    label: (sumMs / 1000).toFixed(3) + " s",
    details: { sumMs },
  };
}
