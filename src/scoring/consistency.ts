import { Attempt, Score, adjustedTime, Scorer } from "./types";

export type ConsistencyConfig = {
  requiredOrdinals?: [number, number];
  decimals?: number;
};

/**
 * Two-pass consistency scorer:
 * 1. Two valid timed passes are required.
 * 2. Score is the absolute difference between them, rounded to configured decimals (default 3).
 * 3. Lowest difference wins (direction: 'asc').
 * 4. First tiebreaker is the fastest individual pass between the two runs.
 * 5. If any required run is missing, DQ, DNF, DNS, or distance-only, entry is ineligible.
 */
export const scoreConsistency: Scorer<ConsistencyConfig, Attempt[]> = (
  attempts,
  config
) => {
  const requiredOrdinals: [number, number] = config?.requiredOrdinals ?? [1, 2];
  const decimals = config?.decimals ?? 3;

  const byOrdinal = new Map(attempts.map((a) => [a.ordinal, a]));
  const selectedAttempts = requiredOrdinals.map((ord) => byOrdinal.get(ord));
  const times = selectedAttempts.map((a) => (a ? adjustedTime(a) : null));

  // Verify both passes are valid timed passes
  if (times.some((v) => v == null)) {
    return {
      eligible: false,
      group: "none",
      primary: null,
      direction: "asc",
      tieBreakers: [],
      label: "Two valid passes required",
      details: {
        requiredOrdinals,
        pass1Valid: times[0] != null,
        pass2Valid: times[1] != null,
      },
    };
  }

  const first = times[0] as number;
  const second = times[1] as number;
  const difference = Math.abs(first - second);
  const bestPass = Math.min(first, second);

  const formattedDifference = (difference / 1000).toFixed(decimals);

  return {
    eligible: true,
    group: "timed",
    primary: difference,
    direction: "asc",
    tieBreakers: [bestPass],
    label: `${formattedDifference} s`,
    details: {
      firstMs: first,
      secondMs: second,
      differenceMs: difference,
      bestPassMs: bestPass,
    },
  };
};
