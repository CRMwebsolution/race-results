import { Score, Attempt } from "./types";

export function scoreJudgedPoints(attempts: Attempt[]): Score {
  const valid = attempts.filter((a) => a.status === "valid" && a.elapsedMs !== null);

  if (valid.length === 0) {
    return {
      eligible: false,
      group: "none",
      primary: null,
      direction: "asc",
      tieBreakers: [],
      label: "No points",
      details: {},
    };
  }

  // Sum points across passes (using elapsedMs as the numerical storage)
  const sumPoints = valid.reduce((acc, curr) => acc + curr.elapsedMs! / 1000, 0);

  // Negative primary so higher points = lower primary = better rank in our system
  return {
    eligible: true,
    group: "none",
    primary: -sumPoints,
    direction: "asc", // keep asc because we negate the primary
    tieBreakers: [-sumPoints],
    label: sumPoints.toFixed(2) + " pts",
    details: { sumPoints },
  };
}
