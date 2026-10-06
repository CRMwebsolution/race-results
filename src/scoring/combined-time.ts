import { Score, Attempt } from "./types";

export function scoreCombinedTime(
  attempts: Attempt[],
  config: { requiredPasses: number } = { requiredPasses: 2 }
): Score {
  // strictly require passes 1 through requiredPasses to be valid times
  const ordinals = Array.from({ length: config.requiredPasses }, (_, i) => i + 1);
  const byOrdinal = new Map(attempts.map((a) => [a.ordinal, a]));
  const selectedAttempts = ordinals.map((ord) => byOrdinal.get(ord));

  const hasInvalid = selectedAttempts.some((a) => !a || a.status !== "valid" || a.elapsedMs === null);

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
  const sumMs = selectedAttempts.reduce((acc, curr) => acc + (curr!.elapsedMs || 0), 0);

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
