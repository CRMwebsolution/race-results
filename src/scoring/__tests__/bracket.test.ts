import { describe, it, expect } from "vitest";
import {
  buildBracketLadder,
  getBracketSeedOrder,
  getRoundName,
  compareMatchAttempts,
  scoreHeadToHead,
  scoreClass,
  rankEntries,
  compareScores,
  parseAttemptInput,
  Attempt,
} from "../index";

function makeAttempt(
  id: string,
  entryId: string,
  ordinal: number,
  raw: string,
  penaltyMs = 0
): Attempt {
  const parsed = parseAttemptInput(raw, penaltyMs);
  return {
    id,
    entryId,
    ordinal,
    status: parsed.status,
    elapsedMs: parsed.elapsedMs,
    distanceMm: parsed.distanceMm,
    penaltyMs: parsed.penaltyMs,
    rawInput: raw,
  };
}

describe("Bracket Generator and Pairing Ladder", () => {
  it("generates correct NCAA/NHRA standard pairing order for powers of two", () => {
    expect(getBracketSeedOrder(2)).toEqual([1, 2]);
    expect(getBracketSeedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(getBracketSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(getBracketSeedOrder(16)).toEqual([
      1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11,
    ]);
  });

  it("names rounds properly from Round 1 through Finals", () => {
    expect(getRoundName(1, 1)).toBe("Finals");
    expect(getRoundName(1, 2)).toBe("Semifinals");
    expect(getRoundName(2, 2)).toBe("Finals");
    expect(getRoundName(1, 3)).toBe("Quarterfinals");
    expect(getRoundName(2, 3)).toBe("Semifinals");
    expect(getRoundName(3, 3)).toBe("Finals");
    expect(getRoundName(1, 4)).toBe("Round of 16");
  });

  it("assigns byes to highest seeds in uneven fields", () => {
    // 5 racers in an 8-car bracket
    const entries = [
      { id: "e1", display_name: "Racer 1", seed: 1 },
      { id: "e2", display_name: "Racer 2", seed: 2 },
      { id: "e3", display_name: "Racer 3", seed: 3 },
      { id: "e4", display_name: "Racer 4", seed: 4 },
      { id: "e5", display_name: "Racer 5", seed: 5 },
    ];

    const ladder = buildBracketLadder(entries, []);
    expect(ladder.bracketSize).toBe(8);
    expect(ladder.totalRounds).toBe(3);

    const r1 = ladder.rounds[0].matchups;
    expect(r1).toHaveLength(4);

    // Match 1: Seed 1 vs Seed 8 (BYE) -> Seed 1 advances automatically
    expect(r1[0].racer1?.entryId).toBe("e1");
    expect(r1[0].racer2?.isBye).toBe(true);
    expect(r1[0].winnerId).toBe("e1");

    // Match 2: Seed 4 vs Seed 5 -> Neither is bye
    expect(r1[1].racer1?.entryId).toBe("e4");
    expect(r1[1].racer2?.entryId).toBe("e5");
    expect(r1[1].winnerId).toBeNull();

    // Match 3: Seed 2 vs Seed 7 (BYE) -> Seed 2 advances automatically
    expect(r1[2].racer1?.entryId).toBe("e2");
    expect(r1[2].racer2?.isBye).toBe(true);
    expect(r1[2].winnerId).toBe("e2");

    // Match 4: Seed 3 vs Seed 6 (BYE) -> Seed 3 advances automatically
    expect(r1[3].racer1?.entryId).toBe("e3");
    expect(r1[3].racer2?.isBye).toBe(true);
    expect(r1[3].winnerId).toBe("e3");

    // Semifinals (Round 2) should already have the bye winners placed
    const r2 = ladder.rounds[1].matchups;
    expect(r2[0].racer1?.entryId).toBe("e1");
    expect(r2[1].racer1?.entryId).toBe("e2");
    expect(r2[1].racer2?.entryId).toBe("e3");
  });

  it("handles 3 racers with a bye for seed 1 to the final", () => {
    const entries = [
      { id: "e1", display_name: "Top Qualifier", seed: 1 },
      { id: "e2", display_name: "Second Qualifier", seed: 2 },
      { id: "e3", display_name: "Third Qualifier", seed: 3 },
    ];

    const ladder = buildBracketLadder(entries, []);
    expect(ladder.bracketSize).toBe(4);
    expect(ladder.totalRounds).toBe(2);

    const r1 = ladder.rounds[0].matchups;
    // Match 1: 1 vs 4 (bye) -> 1 advances
    expect(r1[0].racer1?.entryId).toBe("e1");
    expect(r1[0].racer2?.isBye).toBe(true);
    expect(r1[0].winnerId).toBe("e1");

    // Match 2: 2 vs 3 -> racing
    expect(r1[1].racer1?.entryId).toBe("e2");
    expect(r1[1].racer2?.entryId).toBe("e3");
    expect(r1[1].winnerId).toBeNull();

    // Finals: e1 is already waiting
    expect(ladder.rounds[1].matchups[0].racer1?.entryId).toBe("e1");
  });
});

describe("Matchup Decision Engine", () => {
  it("awards win to faster elapsed time", () => {
    const r1 = { entryId: "a", displayName: "Racer A", seed: 1 };
    const r2 = { entryId: "b", displayName: "Racer B", seed: 4 };

    const att1 = makeAttempt("1", "a", 1, "9.150");
    const att2 = makeAttempt("2", "b", 1, "9.200");

    const result = compareMatchAttempts(att1, att2, r1, r2);
    expect(result.winnerId).toBe("a");
    expect(result.reason).toContain("beats");
    expect(result.isComplete).toBe(true);
  });

  it("accounts for penalties in elapsed time", () => {
    const r1 = { entryId: "a", displayName: "Racer A", seed: 1 };
    const r2 = { entryId: "b", displayName: "Racer B", seed: 4 };

    // 9.100s + 200ms penalty = 9.300s
    const att1 = makeAttempt("1", "a", 1, "9.100", 200);
    // 9.200s + 0 penalty = 9.200s
    const att2 = makeAttempt("2", "b", 1, "9.200", 0);

    const result = compareMatchAttempts(att1, att2, r1, r2);
    expect(result.winnerId).toBe("b");
    expect(result.isComplete).toBe(true);
  });

  it("valid run beats disqualification or non-finish", () => {
    const r1 = { entryId: "a", displayName: "Racer A", seed: 1 };
    const r2 = { entryId: "b", displayName: "Racer B", seed: 4 };

    const validAtt = makeAttempt("1", "a", 1, "10.500");
    const dqAtt = makeAttempt("2", "b", 1, "DQ");

    const result = compareMatchAttempts(validAtt, dqAtt, r1, r2);
    expect(result.winnerId).toBe("a");
    expect(result.isComplete).toBe(true);

    const dnfAtt = makeAttempt("3", "b", 1, "DNF");
    const result2 = compareMatchAttempts(validAtt, dnfAtt, r1, r2);
    expect(result2.winnerId).toBe("a");
  });

  it("DNF beats DQ when both fail", () => {
    const r1 = { entryId: "a", displayName: "Racer A", seed: 1 };
    const r2 = { entryId: "b", displayName: "Racer B", seed: 4 };

    const dnfAtt = makeAttempt("1", "a", 1, "DNF");
    const dqAtt = makeAttempt("2", "b", 1, "DQ");

    const result = compareMatchAttempts(dnfAtt, dqAtt, r1, r2);
    expect(result.winnerId).toBe("a");
  });
});

describe("Complete 4-Car Tournament Progression and Ranking", () => {
  it("resolves from Round 1 through Finals to crown Champion and establish full ranks", () => {
    const entries = [
      { id: "e1", display_name: "Alice", seed: 1, order_num: 1 },
      { id: "e2", display_name: "Bob", seed: 2, order_num: 2 },
      { id: "e3", display_name: "Charlie", seed: 3, order_num: 3 },
      { id: "e4", display_name: "Dave", seed: 4, order_num: 4 },
    ];

    // Round 1:
    // Match 1: Alice (seed 1) vs Dave (seed 4) -> Alice runs 9.100s, Dave runs 9.300s -> Alice wins
    // Match 2: Bob (seed 2) vs Charlie (seed 3) -> Bob runs 9.150s, Charlie runs 9.250s -> Bob wins
    // Round 2 (Finals):
    // Alice vs Bob -> Alice runs 9.050s, Bob runs 9.120s -> Alice wins Champion!
    const attempts = [
      makeAttempt("a1", "e1", 1, "9.100"),
      makeAttempt("a2", "e4", 1, "9.300"),
      makeAttempt("a3", "e2", 1, "9.150"),
      makeAttempt("a4", "e3", 1, "9.250"),
      makeAttempt("a5", "e1", 2, "9.050"),
      makeAttempt("a6", "e2", 2, "9.120"),
    ];

    const ladder = buildBracketLadder(entries, attempts);
    expect(ladder.championId).toBe("e1");
    expect(ladder.runnerUpId).toBe("e2");

    // Check entry bracket results
    const alice = ladder.resultsByEntryId["e1"];
    expect(alice.isChampion).toBe(true);
    expect(alice.statusLabel).toBe("Winner");

    const bob = ladder.resultsByEntryId["e2"];
    expect(bob.isRunnerUp).toBe(true);
    expect(bob.statusLabel).toBe("Runner-up");

    const charlie = ladder.resultsByEntryId["e3"];
    expect(charlie.eliminatedInRound).toBe(1);
    expect(charlie.statusLabel).toBe("Semifinals");

    const dave = ladder.resultsByEntryId["e4"];
    expect(dave.eliminatedInRound).toBe(1);
    expect(dave.statusLabel).toBe("Semifinals");

    // Test Score evaluation and ranking contract
    const aliceScore = scoreHeadToHead(
      attempts.filter((a) => a.entryId === "e1"),
      {},
      alice
    );
    const bobScore = scoreHeadToHead(
      attempts.filter((a) => a.entryId === "e2"),
      {},
      bob
    );
    const charlieScore = scoreHeadToHead(
      attempts.filter((a) => a.entryId === "e3"),
      {},
      charlie
    );
    const daveScore = scoreHeadToHead(
      attempts.filter((a) => a.entryId === "e4"),
      {},
      dave
    );

    // Champion outranks Runner-up
    expect(compareScores(aliceScore, bobScore)).toBeLessThan(0);
    // Runner-up outranks Semifinalists
    expect(compareScores(bobScore, charlieScore)).toBeLessThan(0);
    // Charlie (9.250s) outranks Dave (9.300s) on elimination pass time
    expect(compareScores(charlieScore, daveScore)).toBeLessThan(0);

    // Full field ranking through rankEntries
    const ranked = rankEntries([
      { entryId: "e4", score: daveScore, seed: 4 },
      { entryId: "e1", score: aliceScore, seed: 1 },
      { entryId: "e3", score: charlieScore, seed: 3 },
      { entryId: "e2", score: bobScore, seed: 2 },
    ]);

    expect(ranked[0].entryId).toBe("e1");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].entryId).toBe("e2");
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].entryId).toBe("e3");
    expect(ranked[2].rank).toBe(3);
    expect(ranked[3].entryId).toBe("e4");
    expect(ranked[3].rank).toBe(4);
  });
});

describe("Registry and Configuration Validation", () => {
  it("validates empty attempts during class creation without errors", () => {
    const emptyScore = scoreClass("head_to_head", [], {});
    expect(emptyScore.details.error).toBeUndefined();
    expect(emptyScore.eligible).toBe(false);
    expect(emptyScore.label).toBe("No time");
  });

  it("rejects invalid decimals or versions", () => {
    expect(scoreClass("head_to_head", [], { decimals: 4 }).details.error).toBeTruthy();
    expect(scoreClass("head_to_head", [], {}, 2).details.error).toBeTruthy();
  });
});
