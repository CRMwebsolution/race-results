import { Attempt, Score, adjustedTime } from "./types";
import { EntryBracketResult } from "./bracket";

export type HeadToHeadConfig = {
  decimals?: number;
  timeDecimals?: number;
  bracketSize?: number;
  seedMethod?: string;
};

/**
 * Heads-up elimination bracket scorer.
 * 
 * In bracket racing:
 * 1. The tournament Champion outranks everyone.
 * 2. The Runner-up is 2nd.
 * 3. Racers eliminated in later rounds outrank racers eliminated in earlier rounds.
 * 4. Ties within the same elimination round are broken by round/best elapsed time.
 */
export function scoreHeadToHead(
  attempts: Attempt[],
  config: HeadToHeadConfig = {},
  bracketResult?: EntryBracketResult
): Score {
  const decimals = config.decimals ?? config.timeDecimals ?? 3;

  // 1. When resolved bracket result is provided
  if (bracketResult) {
    const isChamp = bracketResult.isChampion;
    const isRunner = bracketResult.isRunnerUp;
    const maxRound = bracketResult.maxRoundReached;
    const bestTime = bracketResult.bestElapsedMs;
    const roundTime = bracketResult.eliminatedRoundElapsedMs ?? bracketResult.finalRoundElapsedMs ?? bestTime;

    const hasAnyPass = attempts.some(a => a.status === "valid" || a.status === "dnf" || a.status === "dq");
    const eligible = isChamp || isRunner || hasAnyPass || bracketResult.totalWins > 0;

    let primary: number;
    let label = bracketResult.statusLabel;

    if (isChamp) {
      primary = 10000000;
      label = roundTime != null ? `Winner · ${(roundTime / 1000).toFixed(decimals)} s` : "Winner";
    } else if (isRunner) {
      primary = 9000000;
      label = roundTime != null ? `Runner-up · ${(roundTime / 1000).toFixed(decimals)} s` : "Runner-up";
    } else {
      const roundNum = bracketResult.eliminatedInRound ?? maxRound;
      primary = roundNum * 1000000;
      if (roundTime != null) {
        label = `${bracketResult.statusLabel} · ${(roundTime / 1000).toFixed(decimals)} s`;
      }
    }

    const tieBreakers = roundTime != null ? [roundTime, bestTime ?? roundTime] : bestTime != null ? [bestTime] : [];

    return {
      eligible,
      group: "timed",
      primary,
      direction: "desc",
      tieBreakers,
      tieBreakerDirection: "asc",
      label,
      details: {
        bracketResult,
        statusLabel: bracketResult.statusLabel,
        totalWins: bracketResult.totalWins,
        bestElapsedMs: bestTime,
        roundElapsedMs: roundTime,
      },
    };
  }

  // 2. Standalone scoring when no ladder result is passed
  if (!attempts.length) {
    return {
      eligible: false,
      group: "timed",
      primary: null,
      direction: "desc",
      tieBreakers: [],
      label: "No time",
      details: {},
    };
  }

  const validAttempts = attempts.filter(a => a.status === "valid");
  const validTimes = validAttempts
    .map(a => adjustedTime(a))
    .filter((t): t is number => t != null)
    .sort((a, b) => a - b);

  if (validTimes.length > 0) {
    const highestRound = Math.max(0, ...validAttempts.map(a => a.ordinal));
    const bestTime = validTimes[0];
    const latestAttempt = validAttempts.find(a => a.ordinal === highestRound);
    const latestTime = latestAttempt ? adjustedTime(latestAttempt) ?? bestTime : bestTime;

    return {
      eligible: true,
      group: "timed",
      primary: highestRound * 1000000,
      direction: "desc",
      tieBreakers: [latestTime, ...validTimes.filter(t => t !== latestTime)],
      tieBreakerDirection: "asc",
      label: `Round ${highestRound} · ${(latestTime / 1000).toFixed(decimals)} s`,
      details: {
        highestRound,
        bestElapsedMs: bestTime,
        allTimesMs: validTimes,
      },
    };
  }

  const hasDq = attempts.some(a => a.status === "dq");
  const hasDnf = attempts.some(a => a.status === "dnf");
  const label = hasDq ? "DQ" : hasDnf ? "DNF" : "No time";

  return {
    eligible: false,
    group: "timed",
    primary: null,
    direction: "desc",
    tieBreakers: [],
    label,
    details: {},
  };
}
