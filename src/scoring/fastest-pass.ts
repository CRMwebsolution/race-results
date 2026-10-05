import { Attempt, Score, adjustedTime } from "./types";

export type FastestPassConfig = {
  distanceUnit?: "ft" | "m";
  timeDecimals?: number;
};

/**
 * Fastest Pass Scorer:
 * 1. Lowest valid adjusted elapsed time wins.
 * 2. Completed timed runs strictly outrank stopped distances.
 * 3. When no timed completions exist, greatest stopped distance wins.
 * 4. DQs, DNFs, and blanks do not produce valid qualifying scores.
 */
export function scoreFastestPass(
  attempts: Attempt[],
  config?: FastestPassConfig
): Score {
  const timeDecimals = config?.timeDecimals ?? 3;

  // 1. Gather all valid timed passes
  const validTimes = attempts
    .map((attempt) => ({ attempt, time: adjustedTime(attempt) }))
    .filter((t): t is { attempt: Attempt; time: number } => t.time != null);

  if (validTimes.length > 0) {
    const sorted = [...validTimes].sort((a, b) => a.time - b.time);
    const best = sorted[0].time;
    // Tiebreaker: subsequent best times
    const tieBreakers = sorted.slice(1).map((s) => s.time);

    return {
      eligible: true,
      group: "timed",
      primary: best,
      direction: "asc",
      tieBreakers,
      label: `${(best / 1000).toFixed(timeDecimals)} s`,
      details: {
        bestElapsedMs: best,
        allTimesMs: sorted.map((s) => s.time),
        completed: true,
      },
    };
  }

  // 2. Fallback to valid stopped distances if no timed pass exists
  const validDistances = attempts
    .filter((a) => a.status === "valid" && a.distanceMm != null)
    .map((a) => a.distanceMm as number);

  if (validDistances.length > 0) {
    const sortedDistances = [...validDistances].sort((a, b) => b - a);
    const bestDistance = sortedDistances[0];
    const tieBreakers = sortedDistances.slice(1);

    // Format display in feet (304.8 mm per foot)
    const feet = (bestDistance / 304.8).toFixed(1);

    return {
      eligible: true,
      group: "distance",
      primary: bestDistance,
      direction: "desc", // Greater distance is better
      tieBreakers,
      label: `${feet} ft`,
      details: {
        bestDistanceMm: bestDistance,
        allDistancesMm: sortedDistances,
        completed: false,
      },
    };
  }

  // 3. Ineligible when no valid timed or distance passes exist
  return {
    eligible: false,
    group: "none",
    primary: null,
    direction: "asc",
    tieBreakers: [],
    label: "No qualifying pass",
    details: {},
  };
}
