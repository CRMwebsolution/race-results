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
  id: string; // e.g. "R1-M1", "W1-M1", "L1-M1", "GF-M1"
  round: number; // 1-based
  matchNumber: number; // 1-based within round
  racer1: MatchupRacer | null;
  racer2: MatchupRacer | null;
  winnerId: string | null;
  winnerReason?: string;
  isComplete: boolean;
  isManual?: boolean;
  bracketType?: "winners" | "losers" | "finals";
};

export type BracketRound = {
  round: number;
  roundName: string;
  matchups: BracketMatchup[];
  bracketType?: "winners" | "losers" | "finals";
};

export type EntryBracketResult = {
  entryId: string;
  seed: number;
  displayName: string;
  maxRoundReached: number;
  isChampion: boolean;
  isRunnerUp: boolean;
  placementRank?: number; // 1 = Winner, 2 = Runner-up, 3 = 3rd, etc.
  eliminatedInRound: number | null;
  eliminatedInBracket?: "winners" | "losers" | "finals" | null;
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
  hasLosersBracket?: boolean;
  winCriterion?: "fastest_time" | "first_to_finish";
  winnersRounds?: BracketRound[];
  losersRounds?: BracketRound[];
  grandFinal?: BracketMatchup | null;
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

export function getLosersRoundName(round: number, totalLosersRounds: number): string {
  if (round === totalLosersRounds) return "Losers Finals";
  if (round === totalLosersRounds - 1 && totalLosersRounds >= 2) return "Losers Semifinals";
  return `Losers Round ${round}`;
}

/**
 * Decides a heads-up matchup based on round attempts, win criterion, and manual overrides.
 */
export function compareMatchAttempts(
  att1: Attempt | undefined | null,
  att2: Attempt | undefined | null,
  racer1: MatchupRacer,
  racer2: MatchupRacer,
  options?: {
    winCriterion?: "fastest_time" | "first_to_finish";
    manualWinnerId?: string | null;
  }
): { winnerId: string | null; reason: string; isComplete: boolean; isManual?: boolean } {
  // Case 0: Bye advance
  if (racer2.isBye) {
    return { winnerId: racer1.entryId, reason: "Bye advance", isComplete: true };
  }
  if (racer1.isBye) {
    return { winnerId: racer2.entryId, reason: "Bye advance", isComplete: true };
  }

  // Case 1: Manual winner selection by owner/scorer
  if (options?.manualWinnerId) {
    if (options.manualWinnerId === racer1.entryId) {
      const reason =
        options.winCriterion === "first_to_finish"
          ? "1st across line (manual selection)"
          : "Winner (manual selection)";
      return { winnerId: racer1.entryId, reason, isComplete: true, isManual: true };
    }
    if (options.manualWinnerId === racer2.entryId) {
      const reason =
        options.winCriterion === "first_to_finish"
          ? "1st across line (manual selection)"
          : "Winner (manual selection)";
      return { winnerId: racer2.entryId, reason, isComplete: true, isManual: true };
    }
  }

  // Case 2: Neither or only one has run
  if (!att1 && !att2) {
    return {
      winnerId: null,
      reason:
        options?.winCriterion === "first_to_finish"
          ? "Pending (Awaiting passes or 1st across line)"
          : "Pending",
      isComplete: false,
    };
  }

  if (!att1 || !att2) {
    const missing = att1 ? racer2 : racer1;
    return { winnerId: null, reason: `Waiting for ${missing.displayName}`, isComplete: false };
  }

  const valid1 = att1.status === "valid";
  const valid2 = att2.status === "valid";

  // Case 3: One valid, one invalid pass
  if (valid1 && !valid2) {
    const time1 = adjustedTime(att1);
    const timeStr = time1 != null ? `${(time1 / 1000).toFixed(3)}s` : "Valid pass";
    const status2 = att2.status.toUpperCase();
    return {
      winnerId: racer1.entryId,
      reason:
        options?.winCriterion === "first_to_finish"
          ? `${timeStr} (1st across line beats ${status2})`
          : `${timeStr} beats ${status2}`,
      isComplete: true,
    };
  }
  if (valid2 && !valid1) {
    const time2 = adjustedTime(att2);
    const timeStr = time2 != null ? `${(time2 / 1000).toFixed(3)}s` : "Valid pass";
    const status1 = att1.status.toUpperCase();
    return {
      winnerId: racer2.entryId,
      reason:
        options?.winCriterion === "first_to_finish"
          ? `${timeStr} (1st across line beats ${status1})`
          : `${timeStr} beats ${status1}`,
      isComplete: true,
    };
  }

  // Case 4: Both passes valid
  if (valid1 && valid2) {
    const time1 = adjustedTime(att1);
    const time2 = adjustedTime(att2);

    if (time1 != null && time2 != null) {
      if (options?.winCriterion === "first_to_finish") {
        // In first_to_finish without an explicit manual click, lower ET is provisional 1st across line
        if (time1 < time2) {
          return {
            winnerId: racer1.entryId,
            reason: `${(time1 / 1000).toFixed(3)}s (Provisional · Click to confirm 1st across line)`,
            isComplete: true,
          };
        }
        if (time2 < time1) {
          return {
            winnerId: racer2.entryId,
            reason: `${(time2 / 1000).toFixed(3)}s (Provisional · Click to confirm 1st across line)`,
            isComplete: true,
          };
        }
      } else {
        // Standard fastest_time mode: fastest ET wins
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

  // Case 5: Both invalid
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
 * Builds and resolves bracket ladder (supporting both Single Elimination and Double Elimination / Losers Bracket).
 */
export function buildBracketLadder(
  entries: Array<{ id: string; display_name: string; seed?: number | null; order_num?: number }>,
  attempts: Attempt[],
  config: Record<string, unknown> = {}
): BracketLadder {
  const winCriterion = (config.winCriterion as "fastest_time" | "first_to_finish") || "fastest_time";
  const hasLosersBracket = Boolean(config.losersBracket);
  const manualWinners = (config.manualWinners as Record<string, string>) || {};

  if (!entries.length) {
    return {
      bracketSize: 2,
      totalRounds: 1,
      rounds: [],
      championId: null,
      runnerUpId: null,
      resultsByEntryId: {},
      hasLosersBracket,
      winCriterion,
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
  let bracketSize =
    Number.isInteger(userSize) && [2, 4, 8, 16, 32, 64].includes(userSize) && userSize >= seeded.length
      ? userSize
      : Math.max(2, Math.pow(2, Math.ceil(Math.log2(seeded.length || 2))));

  bracketSize = Math.min(64, bracketSize);
  const totalRounds = Math.round(Math.log2(bracketSize));

  // Attempts map & best time map
  const attemptsByEntryRound = new Map<string, Attempt>();
  const attemptsByEntryList = new Map<string, Attempt[]>();
  for (const a of attempts) {
    attemptsByEntryRound.set(`${a.entryId}:${a.ordinal}`, a);
    const list = attemptsByEntryList.get(a.entryId) || [];
    list.push(a);
    attemptsByEntryList.set(a.entryId, list);
  }
  for (const list of attemptsByEntryList.values()) {
    list.sort((a, b) => a.ordinal - b.ordinal);
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

  // Track racer match counts to map nth match to nth attempt
  const racerMatchCounts = new Map<string, number>();
  function getRacerAttempt(racer: MatchupRacer, roundNum: number): Attempt | null {
    if (racer.isBye) return null;
    const matchCount = racerMatchCounts.get(racer.entryId) || 0;
    // 1. Direct ordinal match by tournament round
    const byRound = attemptsByEntryRound.get(`${racer.entryId}:${roundNum}`);
    if (byRound) return byRound;
    // 2. By match sequence count (1st match -> 1st pass, 2nd match -> 2nd pass)
    const bySeq = attemptsByEntryRound.get(`${racer.entryId}:${matchCount + 1}`);
    if (bySeq) return bySeq;
    // 3. By sorted list of attempts for this racer
    const list = attemptsByEntryList.get(racer.entryId);
    if (list && list[matchCount]) return list[matchCount];
    return null;
  }

  function applyAttemptToRacer(racer: MatchupRacer | null, roundNum: number) {
    if (!racer) return;
    const att = getRacerAttempt(racer, roundNum);
    racer.attempt = att;
    racer.status = racer.isBye ? "bye" : att ? att.status : "pending";
    racer.elapsedMs = att ? adjustedTime(att) : null;
    racer.displayScore = racer.isBye
      ? "BYE"
      : att
      ? racer.elapsedMs != null
        ? `${(racer.elapsedMs / 1000).toFixed(3)}s`
        : att.rawInput || att.status.toUpperCase()
      : "-";
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

  // --------------------------------------------------------------------------
  // BRANCH A: SINGLE ELIMINATION
  // --------------------------------------------------------------------------
  if (!hasLosersBracket) {
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
          bracketType: "winners",
        });
      }
      rounds.push({
        round: r,
        roundName: getRoundName(r, totalRounds),
        matchups,
        bracketType: "winners",
      });
    }

    // Populate Round 1 matchups
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

    // Simulate each round forward
    for (let r = 1; r <= totalRounds; r++) {
      const currentRound = rounds[r - 1];
      const nextRound = r < totalRounds ? rounds[r] : null;

      for (const match of currentRound.matchups) {
        const r1 = match.racer1;
        const r2 = match.racer2;
        if (!r1 || !r2) continue;

        applyAttemptToRacer(r1, r);
        applyAttemptToRacer(r2, r);

        const outcome = compareMatchAttempts(r1.attempt, r2.attempt, r1, r2, {
          winCriterion,
          manualWinnerId: manualWinners[match.id],
        });
        match.winnerId = outcome.winnerId;
        match.winnerReason = outcome.reason;
        match.isComplete = outcome.isComplete;
        match.isManual = outcome.isManual;

        if (outcome.winnerId) {
          const winner = outcome.winnerId === r1.entryId ? r1 : r2;
          const loser = outcome.winnerId === r1.entryId ? r2 : r1;

          if (!winner.isBye && resultsByEntryId[winner.entryId]) {
            resultsByEntryId[winner.entryId].totalWins += 1;
            resultsByEntryId[winner.entryId].maxRoundReached = Math.max(
              resultsByEntryId[winner.entryId].maxRoundReached,
              r + 1
            );
            racerMatchCounts.set(winner.entryId, (racerMatchCounts.get(winner.entryId) || 0) + 1);
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
            racerMatchCounts.set(loser.entryId, (racerMatchCounts.get(loser.entryId) || 0) + 1);
          }

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
        resultsByEntryId[champRacer.entryId].placementRank = 1;
        resultsByEntryId[champRacer.entryId].statusLabel = "Winner";
        resultsByEntryId[champRacer.entryId].finalRoundElapsedMs = champRacer.elapsedMs ?? null;
        resultsByEntryId[champRacer.entryId].eliminatedInRound = null;
      }

      if (runnerRacer && !runnerRacer.isBye && resultsByEntryId[runnerRacer.entryId]) {
        resultsByEntryId[runnerRacer.entryId].isRunnerUp = true;
        resultsByEntryId[runnerRacer.entryId].placementRank = 2;
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
      hasLosersBracket: false,
      winCriterion,
    };
  }

  // --------------------------------------------------------------------------
  // BRANCH B: DOUBLE ELIMINATION (LOSERS BRACKET)
  // --------------------------------------------------------------------------
  const k = totalRounds; // e.g., 2 for 4-car, 3 for 8-car, 4 for 16-car

  // 1. Build Winners Rounds structures (W1 through W_k)
  const winnersRounds: BracketRound[] = [];
  for (let r = 1; r <= k; r++) {
    const matchCount = bracketSize / Math.pow(2, r);
    const matchups: BracketMatchup[] = [];
    for (let m = 1; m <= matchCount; m++) {
      matchups.push({
        id: `W${r}-M${m}`,
        round: r,
        matchNumber: m,
        racer1: null,
        racer2: null,
        winnerId: null,
        isComplete: false,
        bracketType: "winners",
      });
    }
    winnersRounds.push({
      round: r,
      roundName: r === k ? "Winners Finals" : r === k - 1 && k >= 2 ? "Winners Semifinals" : `Winners Round ${r}`,
      matchups,
      bracketType: "winners",
    });
  }

  // 2. Build Losers Rounds structures (L1 through L_{2k-2})
  const losersRounds: BracketRound[] = [];
  const totalLosersRounds = Math.max(0, 2 * (k - 1));

  for (let L = 1; L <= totalLosersRounds; L++) {
    const j = Math.floor((L + 1) / 2);
    const matchCount = bracketSize / Math.pow(2, j + 1);
    const matchups: BracketMatchup[] = [];
    for (let m = 1; m <= matchCount; m++) {
      matchups.push({
        id: `L${L}-M${m}`,
        round: L,
        matchNumber: m,
        racer1: null,
        racer2: null,
        winnerId: null,
        isComplete: false,
        bracketType: "losers",
      });
    }
    losersRounds.push({
      round: L,
      roundName: getLosersRoundName(L, totalLosersRounds),
      matchups,
      bracketType: "losers",
    });
  }

  // 3. Build Grand Finals matchup
  const grandFinal: BracketMatchup = {
    id: "GF-M1",
    round: k + 1,
    matchNumber: 1,
    racer1: null, // Winner of Winners Finals (W_k)
    racer2: null, // Winner of Losers Finals (L_{2k-2})
    winnerId: null,
    isComplete: false,
    bracketType: "finals",
  };

  // Helper to evaluate a matchup
  function evaluateMatchup(
    match: BracketMatchup,
    passRound: number,
    bracketType: "winners" | "losers" | "finals"
  ) {
    const r1 = match.racer1;
    const r2 = match.racer2;
    if (!r1 || !r2) return null;

    applyAttemptToRacer(r1, passRound);
    applyAttemptToRacer(r2, passRound);

    const outcome = compareMatchAttempts(r1.attempt, r2.attempt, r1, r2, {
      winCriterion,
      manualWinnerId: manualWinners[match.id],
    });
    match.winnerId = outcome.winnerId;
    match.winnerReason = outcome.reason;
    match.isComplete = outcome.isComplete;
    match.isManual = outcome.isManual;

    if (outcome.winnerId) {
      const winner = outcome.winnerId === r1.entryId ? r1 : r2;
      const loser = outcome.winnerId === r1.entryId ? r2 : r1;

      if (!winner.isBye && resultsByEntryId[winner.entryId]) {
        resultsByEntryId[winner.entryId].totalWins += 1;
        resultsByEntryId[winner.entryId].maxRoundReached = Math.max(
          resultsByEntryId[winner.entryId].maxRoundReached,
          passRound + 1
        );
        racerMatchCounts.set(winner.entryId, (racerMatchCounts.get(winner.entryId) || 0) + 1);
      }
      if (!loser.isBye && resultsByEntryId[loser.entryId]) {
        racerMatchCounts.set(loser.entryId, (racerMatchCounts.get(loser.entryId) || 0) + 1);
      }
      return { winner, loser };
    }
    return null;
  }

  // Populate Winners Round 1
  const seedOrder = getBracketSeedOrder(bracketSize);
  const w1Matchups = winnersRounds[0].matchups;
  for (let m = 0; m < w1Matchups.length; m++) {
    const seed1 = seedOrder[m * 2];
    const seed2 = seedOrder[m * 2 + 1];
    const entry1 = seeded[seed1 - 1];
    const entry2 = seeded[seed2 - 1];

    w1Matchups[m].racer1 = entry1
      ? { entryId: entry1.id, displayName: entry1.displayName, seed: entry1.seed, isBye: false }
      : { entryId: `bye-${seed1}`, displayName: "BYE", seed: seed1, isBye: true };

    w1Matchups[m].racer2 = entry2
      ? { entryId: entry2.id, displayName: entry2.displayName, seed: entry2.seed, isBye: false }
      : { entryId: `bye-${seed2}`, displayName: "BYE", seed: seed2, isBye: true };
  }

  // 4. Interleaved round-by-round progression for Double Elimination
  if (k === 1) {
    // 2-car double elimination: W1 then Grand Finals rematch
    const w1Result = evaluateMatchup(w1Matchups[0], 1, "winners");
    if (w1Result) {
      grandFinal.racer1 = { ...w1Result.winner };
      grandFinal.racer2 = { ...w1Result.loser };
      evaluateMatchup(grandFinal, 2, "finals");
    }
  } else {
    // Step A: Evaluate Winners Round 1 (W1)
    for (let m = 0; m < w1Matchups.length; m++) {
      const match = w1Matchups[m];
      const res = evaluateMatchup(match, 1, "winners");
      if (res) {
        // Winner advances to W2
        const nextW = winnersRounds[1]?.matchups[Math.floor(m / 2)];
        if (nextW) {
          const nextRacer: MatchupRacer = { entryId: res.winner.entryId, displayName: res.winner.displayName, seed: res.winner.seed, isBye: res.winner.isBye };
          if (m % 2 === 0) nextW.racer1 = nextRacer;
          else nextW.racer2 = nextRacer;
        }

        // Loser drops to Losers Round 1 (L1)
        const nextL = losersRounds[0]?.matchups[Math.floor(m / 2)];
        if (nextL) {
          const dropRacer: MatchupRacer = { entryId: res.loser.entryId, displayName: res.loser.displayName, seed: res.loser.seed, isBye: res.loser.isBye };
          if (m % 2 === 0) nextL.racer1 = dropRacer;
          else nextL.racer2 = dropRacer;
        }
      }
    }

    // Step B: Progress through stages j = 1 to k - 1
    for (let j = 1; j <= k - 1; j++) {
      const minorLIdx = 2 * j - 2; // L_{2j-1}
      const majorLIdx = 2 * j - 1; // L_{2j}

      // 1. Evaluate Minor Losers Round L_{2j-1}
      const minorRound = losersRounds[minorLIdx];
      if (minorRound) {
        for (let m = 0; m < minorRound.matchups.length; m++) {
          const match = minorRound.matchups[m];
          const res = evaluateMatchup(match, j + 1, "losers");
          if (res) {
            // Loser is eliminated from tournament!
            if (!res.loser.isBye && resultsByEntryId[res.loser.entryId]) {
              resultsByEntryId[res.loser.entryId].eliminatedInRound = minorRound.round;
              resultsByEntryId[res.loser.entryId].eliminatedInBracket = "losers";
              resultsByEntryId[res.loser.entryId].eliminatedByEntryId = res.winner.entryId;
              resultsByEntryId[res.loser.entryId].eliminatedRoundElapsedMs = res.loser.elapsedMs ?? null;
              resultsByEntryId[res.loser.entryId].statusLabel = minorRound.roundName;
            }
            // Winner advances to Major Losers Round L_{2j} (as racer1)
            const nextL = losersRounds[majorLIdx]?.matchups[m];
            if (nextL) {
              nextL.racer1 = { entryId: res.winner.entryId, displayName: res.winner.displayName, seed: res.winner.seed, isBye: res.winner.isBye };
            }
          }
        }
      }

      // 2. Evaluate Winners Round W_{j+1}
      const wRound = winnersRounds[j]; // round j + 1
      if (wRound) {
        for (let m = 0; m < wRound.matchups.length; m++) {
          const match = wRound.matchups[m];
          const res = evaluateMatchup(match, j + 1, "winners");
          if (res) {
            // Winner advances to next Winners round or Grand Finals
            if (j + 1 === k) {
              // Winner of Winners Finals advances to Grand Finals as racer1
              grandFinal.racer1 = { entryId: res.winner.entryId, displayName: res.winner.displayName, seed: res.winner.seed, isBye: res.winner.isBye };
            } else {
              const nextW = winnersRounds[j + 1]?.matchups[Math.floor(m / 2)];
              if (nextW) {
                const nextRacer: MatchupRacer = { entryId: res.winner.entryId, displayName: res.winner.displayName, seed: res.winner.seed, isBye: res.winner.isBye };
                if (m % 2 === 0) nextW.racer1 = nextRacer;
                else nextW.racer2 = nextRacer;
              }
            }

            // Loser drops to Major Losers Round L_{2j} (as racer2)
            const nextL = losersRounds[majorLIdx]?.matchups[m];
            if (nextL) {
              nextL.racer2 = { entryId: res.loser.entryId, displayName: res.loser.displayName, seed: res.loser.seed, isBye: res.loser.isBye };
            }
          }
        }
      }

      // 3. Evaluate Major Losers Round L_{2j}
      const majorRound = losersRounds[majorLIdx];
      if (majorRound) {
        for (let m = 0; m < majorRound.matchups.length; m++) {
          const match = majorRound.matchups[m];
          const res = evaluateMatchup(match, j + 2, "losers");
          if (res) {
            // Loser is eliminated from tournament
            if (!res.loser.isBye && resultsByEntryId[res.loser.entryId]) {
              resultsByEntryId[res.loser.entryId].eliminatedInRound = majorRound.round;
              resultsByEntryId[res.loser.entryId].eliminatedInBracket = "losers";
              resultsByEntryId[res.loser.entryId].eliminatedByEntryId = res.winner.entryId;
              resultsByEntryId[res.loser.entryId].eliminatedRoundElapsedMs = res.loser.elapsedMs ?? null;
              resultsByEntryId[res.loser.entryId].statusLabel =
                majorRound.round === totalLosersRounds ? "3rd Place" : majorRound.roundName;
              if (majorRound.round === totalLosersRounds) {
                resultsByEntryId[res.loser.entryId].placementRank = 3;
              }
            }

            // Winner advances to next Minor Losers round or Grand Finals
            if (majorLIdx === totalLosersRounds - 1) {
              // Losers Champion advances to Grand Finals as racer2
              grandFinal.racer2 = { entryId: res.winner.entryId, displayName: res.winner.displayName, seed: res.winner.seed, isBye: res.winner.isBye };
            } else {
              const nextMinor = losersRounds[majorLIdx + 1]?.matchups[Math.floor(m / 2)];
              if (nextMinor) {
                const nextRacer: MatchupRacer = { entryId: res.winner.entryId, displayName: res.winner.displayName, seed: res.winner.seed, isBye: res.winner.isBye };
                if (m % 2 === 0) nextMinor.racer1 = nextRacer;
                else nextMinor.racer2 = nextRacer;
              }
            }
          }
        }
      }
    }

    // Step C: Evaluate Grand Finals
    if (grandFinal.racer1 && grandFinal.racer2) {
      evaluateMatchup(grandFinal, k + 2, "finals");
    }
  }

  // Determine Champion & Runner-up in Double Elimination
  let championId: string | null = null;
  let runnerUpId: string | null = null;

  if (grandFinal.winnerId) {
    championId = grandFinal.winnerId;
    const champRacer = grandFinal.winnerId === grandFinal.racer1?.entryId ? grandFinal.racer1 : grandFinal.racer2;
    const runnerRacer = grandFinal.winnerId === grandFinal.racer1?.entryId ? grandFinal.racer2 : grandFinal.racer1;

    runnerUpId = runnerRacer && !runnerRacer.isBye ? runnerRacer.entryId : null;

    if (champRacer && !champRacer.isBye && resultsByEntryId[champRacer.entryId]) {
      resultsByEntryId[champRacer.entryId].isChampion = true;
      resultsByEntryId[champRacer.entryId].placementRank = 1;
      resultsByEntryId[champRacer.entryId].statusLabel = "Winner";
      resultsByEntryId[champRacer.entryId].finalRoundElapsedMs = champRacer.elapsedMs ?? null;
      resultsByEntryId[champRacer.entryId].eliminatedInRound = null;
    }

    if (runnerRacer && !runnerRacer.isBye && resultsByEntryId[runnerRacer.entryId]) {
      resultsByEntryId[runnerRacer.entryId].isRunnerUp = true;
      resultsByEntryId[runnerRacer.entryId].placementRank = 2;
      resultsByEntryId[runnerRacer.entryId].statusLabel = "Runner-up";
      resultsByEntryId[runnerRacer.entryId].finalRoundElapsedMs = runnerRacer.elapsedMs ?? null;
    }
  }

  // Assign deterministic placement ranks for double elimination eliminated racers
  // 3rd place: Loser of Losers Finals
  // 4th place: Loser of Losers Semifinals
  // 5th/6th place: Losers of round prior, etc.
  if (losersRounds.length >= 2) {
    const lFinal = losersRounds[losersRounds.length - 1];
    const lSemi = losersRounds[losersRounds.length - 2];

    if (lFinal && lFinal.matchups[0]?.winnerId) {
      const loserId =
        lFinal.matchups[0].winnerId === lFinal.matchups[0].racer1?.entryId
          ? lFinal.matchups[0].racer2?.entryId
          : lFinal.matchups[0].racer1?.entryId;
      if (loserId && resultsByEntryId[loserId]) {
        resultsByEntryId[loserId].placementRank = 3;
        resultsByEntryId[loserId].statusLabel = "3rd Place";
      }
    }

    if (lSemi && lSemi.matchups[0]?.winnerId) {
      const loserId =
        lSemi.matchups[0].winnerId === lSemi.matchups[0].racer1?.entryId
          ? lSemi.matchups[0].racer2?.entryId
          : lSemi.matchups[0].racer1?.entryId;
      if (loserId && resultsByEntryId[loserId] && resultsByEntryId[loserId].placementRank == null) {
        resultsByEntryId[loserId].placementRank = 4;
        resultsByEntryId[loserId].statusLabel = "4th Place";
      }
    }
  }

  // Combine rounds array for components iterating ladder.rounds
  const combinedRounds = [...winnersRounds];

  return {
    bracketSize,
    totalRounds: k + 1,
    rounds: combinedRounds,
    championId,
    runnerUpId,
    resultsByEntryId,
    hasLosersBracket: true,
    winCriterion,
    winnersRounds,
    losersRounds,
    grandFinal,
  };
}
