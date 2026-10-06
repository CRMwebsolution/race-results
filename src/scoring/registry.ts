import {scoreMultiJudge,JudgeInput} from "./multi-judge";
import { Attempt, Score } from "./types";
import { scoreFastestPass } from "./fastest-pass";
import { scoreConsistency } from "./consistency";
import { scoreCombinedTime } from "./combined-time";
import { scoreJudgedPoints } from "./judged-points";
import { scoreStoppedDistance } from "./stopped-distance";

function invalid(message: string): Score {
  return { eligible: false, group: "none", primary: null, direction: "asc", tieBreakers: [],
    label: message, details: { error: message } };
}

/** Single versioned dispatch used by the scoring desk, spectators and finalization. */
export function scoreClass(type: string, attempts: Attempt[], rawConfig: unknown = {}, version = 1, judgeScores?:JudgeInput[]): Score {
  if (version !== 1) return invalid(`Unsupported scoring version: ${version}`);
  if (rawConfig == null || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
    return invalid("Invalid scoring configuration");
  }
  const config = rawConfig as Record<string, unknown>;
  const decimals = config.decimals ?? config.timeDecimals ?? 3;
  if (!Number.isInteger(decimals) || Number(decimals) < 0 || Number(decimals) > 3) {
    return invalid("Scoring precision must be 0–3 decimals");
  }
  switch (type) {
    case "fastest_pass": return scoreFastestPass(attempts, { timeDecimals: Number(decimals) });
    case "consistency": {
      const ordinals = config.requiredOrdinals ?? [1, 2];
      if (!Array.isArray(ordinals) || ordinals.length !== 2 ||
          ordinals.some(o => !Number.isInteger(o) || o < 1 || o > 100) || ordinals[0] === ordinals[1]) {
        return invalid("Consistency requires two distinct pass numbers");
      }
      return scoreConsistency(attempts, { requiredOrdinals: ordinals as [number, number], decimals: Number(decimals) });
    }
    case "combined_time": return scoreCombinedTime(attempts, { requiredPasses: config.requiredPasses as number | undefined });
    case "judged_points": return judgeScores ? scoreMultiJudge(judgeScores,config) : scoreJudgedPoints(attempts);
    case "stopped_distance": return scoreStoppedDistance(attempts);
    default: return invalid(`Unsupported scoring format: ${type}`);
  }
}
