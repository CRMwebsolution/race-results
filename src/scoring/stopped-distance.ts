import { Attempt, Score } from "./types";

export type StoppedDistanceConfig = {
  distanceUnit?: "ft" | "m";
};

/**
 * Stopped Distance Scorer:
 * Ranks competitors purely by recorded distance stopped (e.g. mud bog / truck pull).
 * Greatest recorded distance wins (descending order).
 */
export function scoreStoppedDistance(
  attempts: Attempt[],
  config?: StoppedDistanceConfig
): Score {
  const validDistances = attempts
    .filter((a) => a.status === "valid" && a.distanceMm != null)
    .map((a) => a.distanceMm as number);

  if (validDistances.length === 0) {
    return {
      eligible: false,
      group: "none",
      primary: null,
      direction: "desc",
      tieBreakers: [],
      label: "No recorded distance",
      details: {},
    };
  }

  const sorted = [...validDistances].sort((a, b) => b - a);
  const best = sorted[0];
  const tieBreakers = sorted.slice(1);
  const feet = (best / 304.8).toFixed(1);

  return {
    eligible: true,
    group: "distance",
    primary: best,
    direction: "desc",
    tieBreakers,
    label: `${feet} ft`,
    details: {
      bestDistanceMm: best,
      allDistancesMm: sorted,
    },
  };
}
