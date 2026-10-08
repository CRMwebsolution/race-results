import { Attempt, AttemptStatus, adjustedTime } from "./types";

export type BracketSeed = {
  id: string; // entryId
  displayName: string;
  seed: number; // 1-based seed
  orderNum?: number;
  qualifyingTimeMs?: number | null;
};

export type MatchupRacer = {
  entryId: string;
  displayName: string;
  seed: number;
  isBye?: boolean;
  attempt?: Attempt | null;
  status?: AttemptStatus | "bye" | "pending";
  elapsedMs?: number | null;
  displayScore?: string;
};

export type BracketMatchup = {
  id: string; // e.g. "R1-M1"
  round: number; // 1-based
  matchNumber: number; // 1-based within round
  racer1: MatchupRacer | null;
  racer2: MatchupRacer | null;
  winnerId: string | null;
  winnerReason?: string;
  isComplete: boolean;
};

export type BracketRound = {
  round: number;
  roundName: string;
  matchups: BracketMatchup[];
};

export type EntryBracketResult = {
  entryId: string;
  seed: number;
  displayName: string;
  maxRoundReached: number;
  isChampion: boolean;
  isRunnerUp: boolean;
  eliminatedInRound: number | null;
  eliminatedByEntryId: string | null;
  bestElapsedMs: number | null;
  finalRoundElapsedMs: number | null;
  eliminatedRoundElapsedMs: number | null;
  totalWins: number;
  statusLabel: string;
};

export type BracketLadder = {
  bracketSize: number;
  totalRounds: number;
  rounds: BracketRound[];
  championId: string | null;
  runnerUpId: string | null;
  resultsByEntryId: Record<string, EntryBracketResult>;
};

/**
 * Returns standard tournament pairing order for a power-of-two bracket size.
 * For size 8: [1, 8, 4, 5, 2, 7, 3, 6] -> pairs (1 vs 8), (4 vs 5), (2 vs 7), (3 vs 6).
 */
export function getBracketSeedOrder(size: number): number[] {
  if (size <= 1) return [1];
  if (size === 2) return [1, 2];
  const rounds = Math.round(Math.log2(size));
  let order = [1, 2];
  for (let r = 1; r < rounds; r++) {
    const nextOrder: number[] = [];
    const sum = Math.pow(2, r + 1) + 1;
    for (const seed of order) {
      nextOrder.push(seed);
      nextOrder.push(sum - seed);
    }
    order = nextOrder;
  }
  return order;
}

export function getRoundName(round: number, totalRounds: number): string {
  if (round === totalRounds) return "Finals";
  if (round === totalRounds - 1 && totalRounds >= 2) return "Semifinals";
  if (round === totalRounds - 2 && totalRounds >= 3) return "Quarterfinals";
  if (round === totalRounds - 3 && totalRounds >= 4) return "Round of 16";
  return `Round ${round}`;
}

/**
 * Decides a heads-up matchup based on round attempts.
 */
export function compareMatchAttempts(
  att1: Attempt | undefined | null,
  att2: Attempt | undefined | null,
  racer1: MatchupRacer,
  racer2: MatchupRacer
): { winnerId: string | null; reason: string; isComplete: boolean } {
  if (racer2.isBye) {
    return { winnerId: racer1.entryId, reason: "Bye advance", isComplete: true };
  }
  if (racer1.isBye) {
    return { winnerId: racer2.entryId, reason: "Bye advance", isComplete: true };
  }

  if (!att1 && !att2) {
    return { winnerId: null, reason: "Pending", isComplete: false };
  }

  if (!att1 || !att2) {
    const missing = att1 ? racer2 : racer1;
    return { winnerId: null, reason: `Waiting for ${missing.displayName}`, isComplete: false };
  }

  const valid1 = att1.status === "valid";
  const valid2 = att2.status === "valid";

  // Case 1: One valid, one invalid
  if (valid1 && !valid2) {
    const time1 = adjustedTime(att1);
    const timeStr = time1 != null ? `${(time1 / 1000).toFixed(3)}s` : "Valid pass";
    const status2 = att2.status.toUpperCase();
    return { winnerId: racer1.entryId, reason: `${timeStr} beats ${status2}`, isComplete: true };
  }
  if (valid2 && !valid1) {
    const time2 = adjustedTime(att2);
    const timeStr = time2 != null ? `${(time2 / 1000).toFixed(3)}s` : "Valid pass";
    const status1 = att1.status.toUpperCase();
    return { winnerId: racer2.entryId, reason: `${timeStr} beats ${status1}`, isComplete: true };
  }

  // Case 2: Both valid
  if (valid1 && valid2) {
    const time1 = adjustedTime(att1);
    const time2 = adjustedTime(att2);

    if (time1 != null && time2 != null) {
      if (time1 < time2) {
        return {
          winnerId: racer1.entryId,
          reason: `${(time1 / 1000).toFixed(3)}s beats ${(time2 / 1000).toFixed(3)}s`,
          isComplete: true,
        };
      }
      if (time2 < time1) {
        return {
          winnerId: racer2.entryId,
          reason: `${(time2 / 1000).toFixed(3)}s beats ${(time1 / 1000).toFixed(3)}s`,
          isComplete: true,
        };
      }
      // Raw time tiebreaker
      if (att1.elapsedMs != null && att2.elapsedMs != null && att1.elapsedMs !== att2.elapsedMs) {
        const winner = att1.elapsedMs < att2.elapsedMs ? racer1 : racer2;
        return { winnerId: winner.entryId, reason: "Tiebreak by raw elapsed time", isComplete: true };
      }
      // Seed tiebreaker
      const winner = racer1.seed < racer2.seed ? racer1 : racer2;
      return { winnerId: winner.entryId, reason: "Dead heat (tiebreak by higher seed)", isComplete: true };
    }

    if (time1 != null && time2 == null) {
      return { winnerId: racer1.entryId, reason: "Timed run beats distance", isComplete: true };
    }
    if (time2 != null && time1 == null) {
      return { winnerId: racer2.entryId, reason: "Timed run beats distance", isComplete: true };
    }

    const dist1 = att1.distanceMm ?? 0;
    const dist2 = att2.distanceMm ?? 0;
    if (dist1 !== dist2) {
      const winner = dist1 > dist2 ? racer1 : racer2;
      return { winnerId: winner.entryId, reason: "Greater distance", isComplete: true };
    }
    const winner = racer1.seed < racer2.seed ? racer1 : racer2;
    return { winnerId: winner.entryId, reason: "Tiebreak by higher seed", isComplete: true };
  }

  // Case 3: Both invalid
  const penaltyOrder: Record<AttemptStatus, number> = {
    valid: 0,
    dnf: 1,
    no_time: 2,
    dns: 3,
    dq: 4,
  };
  const p1 = penaltyOrder[att1.status];
  const p2 = penaltyOrder[att2.status];
  if (p1 !== p2) {
    const winner = p1 < p2 ? racer1 : racer2;
    return { winnerId: winner.entryId, reason: `${winner.displayName} had lesser penalty`, isComplete: true };
  }
  if (att1.status === "dnf" && att2.status === "dnf") {
    const dist1 = att1.distanceMm ?? 0;
    const dist2 = att2.distanceMm ?? 0;
    if (dist1 !== dist2) {
      const winner = dist1 > dist2 ? racer1 : racer2;
      return { winnerId: winner.entryId, reason: "Greater distance on DNF", isComplete: true };
    }
  }
  const winner = racer1.seed < racer2.seed ? racer1 : racer2;
  return { winnerId: winner.entryId, reason: "Tiebreak by seed", isComplete: true };
}

/**
 * Builds and resolves the entire bracket ladder from entries, attempts, and configuration.
 */
export function buildBracketLadder(
  entries: Array<{ id: string; display_name: string; seed?: number | null; order_num?: number }>,
  attempts: Attempt[],
  config: Record<string, unknown> = {}
): BracketLadder {
  if (!entries.length) {
    return {
      bracketSize: 2,
      totalRounds: 1,
      rounds: [],
      championId: null,
      runnerUpId: null,
      resultsByEntryId: {},
    };
  }

  // 1. Sort and assign seeds
  const seedMethod = String(config.seedMethod || "seed");
  const sortedEntries = [...entries].sort((a, b) => {
    if (seedMethod === "order") {
      return (a.order_num ?? 999) - (b.order_num ?? 999) || a.id.localeCompare(b.id);
    }
    if (a.seed != null && b.seed != null && a.seed !== b.seed) {
      return a.seed - b.seed;
    }
    if (a.seed != null && b.seed == null) return -1;
    if (a.seed == null && b.seed != null) return 1;
    return (a.order_num ?? 999) - (b.order_num ?? 999) || a.id.localeCompare(b.id);
  });

  const seeded: BracketSeed[] = sortedEntries.map((e, idx) => ({
    id: e.id,
    displayName: e.display_name,
    seed: idx + 1,
    orderNum: e.order_num,
  }));

  // 2. Determine power of 2 bracket size
  const userSize = Number(config.bracketSize);
  let bracketSize = Number.isInteger(userSize) && [2, 4, 8, 16, 32, 64].includes(userSize) && userSize >= seeded.length
    ? userSize
    : Math.max(2, Math.pow(2, Math.ceil(Math.log2(seeded.length || 2))));

  // Cap at 64
  bracketSize = Math.min(64, bracketSize);
  const totalRounds = Math.round(Math.log2(bracketSize));

  // 3. Initialize rounds
  const rounds: BracketRound[] = [];
  for (let r = 1; r <= totalRounds; r++) {
    const matchCount = bracketSize / Math.pow(2, r);
    const matchups: BracketMatchup[] = [];
    for (let m = 1; m <= matchCount; m++) {
      matchups.push({
        id: `R${r}-M${m}`,
        round: r,
        matchNumber: m,
        racer1: null,
        racer2: null,
        winnerId: null,
        isComplete: false,
      });
    }
    rounds.push({
      round: r,
      roundName: getRoundName(r, totalRounds),
      matchups,
    });
  }

  // 4. Populate Round 1 matchups using standard tournament pairings
  const seedOrder = getBracketSeedOrder(bracketSize);
  const r1Matchups = rounds[0].matchups;
  for (let m = 0; m < r1Matchups.length; m++) {
    const seed1 = seedOrder[m * 2];
    const seed2 = seedOrder[m * 2 + 1];

    const entry1 = seeded[seed1 - 1];
    const entry2 = seeded[seed2 - 1];

    r1Matchups[m].racer1 = entry1
      ? { entryId: entry1.id, displayName: entry1.displayName, seed: entry1.seed, isBye: false }
      : { entryId: `bye-${seed1}`, displayName: "BYE", seed: seed1, isBye: true };

    r1Matchups[m].racer2 = entry2
      ? { entryId: entry2.id, displayName: entry2.displayName, seed: entry2.seed, isBye: false }
      : { entryId: `bye-${seed2}`, displayName: "BYE", seed: seed2, isBye: true };
  }

  // 5. Track entry stats across rounds
  const attemptsByEntryRound = new Map<string, Attempt>();
  for (const a of attempts) {
    attemptsByEntryRound.set(`${a.entryId}:${a.ordinal}`, a);
  }

  const bestTimeByEntry = new Map<string, number>();
  for (const a of attempts) {
    const time = adjustedTime(a);
    if (time != null) {
      const current = bestTimeByEntry.get(a.entryId);
      if (current == null || time < current) {
        bestTimeByEntry.set(a.entryId, time);
      }
    }
  }

  const resultsByEntryId: Record<string, EntryBracketResult> = {};
  for (const s of seeded) {
    resultsByEntryId[s.id] = {
      entryId: s.id,
      seed: s.seed,
      displayName: s.displayName,
      maxRoundReached: 1,
      isChampion: false,
      isRunnerUp: false,
      eliminatedInRound: null,
      eliminatedByEntryId: null,
      bestElapsedMs: bestTimeByEntry.get(s.id) ?? null,
      finalRoundElapsedMs: null,
      eliminatedRoundElapsedMs: null,
      totalWins: 0,
      statusLabel: "Round 1",
    };
  }

  // 6. Simulate / evaluate each round forward
  for (let r = 1; r <= totalRounds; r++) {
    const currentRound = rounds[r - 1];
    const nextRound = r < totalRounds ? rounds[r] : null;

    for (const match of currentRound.matchups) {
      const r1 = match.racer1;
      const r2 = match.racer2;

      if (!r1 || !r2) continue;

      // Attach attempts for this round
      const att1 = !r1.isBye ? attemptsByEntryRound.get(`${r1.entryId}:${r}`) : null;
      const att2 = !r2.isBye ? attemptsByEntryRound.get(`${r2.entryId}:${r}`) : null;

      r1.attempt = att1;
      r1.status = r1.isBye ? "bye" : att1 ? att1.status : "pending";
      r1.elapsedMs = att1 ? adjustedTime(att1) : null;
      r1.displayScore = r1.isBye
        ? "BYE"
        : att1
        ? r1.elapsedMs != null
          ? `${(r1.elapsedMs / 1000).toFixed(3)}s`
          : att1.rawInput || att1.status.toUpperCase()
        : "-";

      r2.attempt = att2;
      r2.status = r2.isBye ? "bye" : att2 ? att2.status : "pending";
      r2.elapsedMs = att2 ? adjustedTime(att2) : null;
      r2.displayScore = r2.isBye
        ? "BYE"
        : att2
        ? r2.elapsedMs != null
          ? `${(r2.elapsedMs / 1000).toFixed(3)}s`
          : att2.rawInput || att2.status.toUpperCase()
        : "-";

      // Evaluate match
      const outcome = compareMatchAttempts(att1, att2, r1, r2);
      match.winnerId = outcome.winnerId;
      match.winnerReason = outcome.reason;
      match.isComplete = outcome.isComplete;

      if (outcome.winnerId) {
        const winner = outcome.winnerId === r1.entryId ? r1 : r2;
        const loser = outcome.winnerId === r1.entryId ? r2 : r1;

        if (!winner.isBye && resultsByEntryId[winner.entryId]) {
          resultsByEntryId[winner.entryId].totalWins += 1;
          resultsByEntryId[winner.entryId].maxRoundReached = Math.max(
            resultsByEntryId[winner.entryId].maxRoundReached,
            r + 1
          );
        }

        if (!loser.isBye && resultsByEntryId[loser.entryId]) {
          resultsByEntryId[loser.entryId].eliminatedInRound = r;
          resultsByEntryId[loser.entryId].eliminatedByEntryId = winner.entryId;
          resultsByEntryId[loser.entryId].eliminatedRoundElapsedMs = loser.elapsedMs ?? null;
          resultsByEntryId[loser.entryId].statusLabel =
            r === totalRounds
              ? "Runner-up"
              : r === totalRounds - 1 && totalRounds >= 2
              ? "Semifinals"
              : r === totalRounds - 2 && totalRounds >= 3
              ? "Quarterfinals"
              : `Round ${r}`;
        }

        // Advance winner to next round matchup
        if (nextRound) {
          const nextMatchIndex = Math.floor((match.matchNumber - 1) / 2);
          const nextMatch = nextRound.matchups[nextMatchIndex];
          if (nextMatch) {
            const nextRacer: MatchupRacer = {
              entryId: winner.entryId,
              displayName: winner.displayName,
              seed: winner.seed,
              isBye: winner.isBye,
            };
            if ((match.matchNumber - 1) % 2 === 0) {
              nextMatch.racer1 = nextRacer;
            } else {
              nextMatch.racer2 = nextRacer;
            }
          }
        }
      }
    }
  }

  // 7. Determine Final Champion and Runner-up
  const finalMatch = rounds[totalRounds - 1]?.matchups[0];
  let championId: string | null = null;
  let runnerUpId: string | null = null;

  if (finalMatch && finalMatch.winnerId) {
    championId = finalMatch.winnerId;
    const champRacer = finalMatch.winnerId === finalMatch.racer1?.entryId ? finalMatch.racer1 : finalMatch.racer2;
    const runnerRacer = finalMatch.winnerId === finalMatch.racer1?.entryId ? finalMatch.racer2 : finalMatch.racer1;

    runnerUpId = runnerRacer && !runnerRacer.isBye ? runnerRacer.entryId : null;

    if (champRacer && !champRacer.isBye && resultsByEntryId[champRacer.entryId]) {
      resultsByEntryId[champRacer.entryId].isChampion = true;
      resultsByEntryId[champRacer.entryId].statusLabel = "Winner";
      resultsByEntryId[champRacer.entryId].finalRoundElapsedMs = champRacer.elapsedMs ?? null;
      resultsByEntryId[champRacer.entryId].eliminatedInRound = null;
    }

    if (runnerRacer && !runnerRacer.isBye && resultsByEntryId[runnerRacer.entryId]) {
      resultsByEntryId[runnerRacer.entryId].isRunnerUp = true;
      resultsByEntryId[runnerRacer.entryId].statusLabel = "Runner-up";
      resultsByEntryId[runnerRacer.entryId].finalRoundElapsedMs = runnerRacer.elapsedMs ?? null;
    }
  }

  return {
    bracketSize,
    totalRounds,
    rounds,
    championId,
    runnerUpId,
    resultsByEntryId,
  };
}
