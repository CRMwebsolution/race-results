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
import { scoringFromForm } from "@/components/scoring-fields";
import { passCount } from "@/lib/race-order";

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

describe("Win Criteria and Manual Winner Selection (1st Across Line)", () => {
  const entries = [
    { id: "e1", display_name: "Racer 1", seed: 1 },
    { id: "e2", display_name: "Racer 2", seed: 2 },
  ];

  it("supports fastest_time winCriterion where lower elapsed time wins pass automatically", () => {
    const attempts = [
      makeAttempt("a1", "e1", 1, "9.150"), // Racer 1: 9.150s
      makeAttempt("a2", "e2", 1, "9.220"), // Racer 2: 9.220s
    ];

    const ladder = buildBracketLadder(entries, attempts, {
      winCriterion: "fastest_time",
    });

    expect(ladder.championId).toBe("e1");
    expect(ladder.runnerUpId).toBe("e2");
    expect(ladder.rounds[0].matchups[0].winnerId).toBe("e1");
    expect(ladder.rounds[0].matchups[0].winnerReason).toContain("9.150s beats 9.220s");
    // Times are always retained and displayed
    expect(ladder.rounds[0].matchups[0].racer1?.displayScore).toBe("9.150s");
    expect(ladder.rounds[0].matchups[0].racer2?.displayScore).toBe("9.220s");
  });

  it("supports first_to_finish winCriterion where owner can manually click winner (1st across line) despite slower ET", () => {
    // In drag/stripe racing, Racer 2 leaves first or holeshot wins, crossing stripe first even with a 9.200s vs 9.150s
    const attempts = [
      makeAttempt("a1", "e1", 1, "9.150"), // Racer 1: 9.150s
      makeAttempt("a2", "e2", 1, "9.200"), // Racer 2: 9.200s
    ];

    // Without manual override yet: provisional lower ET
    const provisionalLadder = buildBracketLadder(entries, attempts, {
      winCriterion: "first_to_finish",
    });
    expect(provisionalLadder.rounds[0].matchups[0].winnerReason).toContain("Provisional");

    // When track owner manually clicks Racer 2 as 1st across line
    const ladder = buildBracketLadder(entries, attempts, {
      winCriterion: "first_to_finish",
      manualWinners: {
        "R1-M1": "e2",
      },
    });

    expect(ladder.championId).toBe("e2");
    expect(ladder.runnerUpId).toBe("e1");
    const m = ladder.rounds[0].matchups[0];
    expect(m.winnerId).toBe("e2");
    expect(m.isManual).toBe(true);
    expect(m.winnerReason).toContain("1st across line (manual selection)");
    // Both times MUST always be shown!
    expect(m.racer1?.displayScore).toBe("9.150s");
    expect(m.racer2?.displayScore).toBe("9.200s");
    expect(m.racer1?.elapsedMs).toBe(9150);
    expect(m.racer2?.elapsedMs).toBe(9200);
  });

  it("allows clearing manual winner selection back to automatic", () => {
    const attempts = [
      makeAttempt("a1", "e1", 1, "9.100"),
      makeAttempt("a2", "e2", 1, "9.300"),
    ];

    const withManual = buildBracketLadder(entries, attempts, {
      manualWinners: { "R1-M1": "e2" },
    });
    expect(withManual.championId).toBe("e2");

    const cleared = buildBracketLadder(entries, attempts, {
      manualWinners: {},
    });
    expect(cleared.championId).toBe("e1");
  });
});

describe("Losers Bracket (Double Elimination Tournament Ladder)", () => {
  it("generates and resolves a 4-car double elimination ladder with grand finals", () => {
    const entries = [
      { id: "e1", display_name: "Alice", seed: 1 },
      { id: "e2", display_name: "Bob", seed: 2 },
      { id: "e3", display_name: "Charlie", seed: 3 },
      { id: "e4", display_name: "Dave", seed: 4 },
    ];

    // Round 1 attempts:
    // W1-M1: Alice (9.100) vs Dave (9.400) -> Alice wins W1-M1, Dave drops to L1
    // W1-M2: Bob (9.200) vs Charlie (9.300) -> Bob wins W1-M2, Charlie drops to L1
    // Round 2 attempts:
    // L1-M1: Charlie (9.280) vs Dave (9.390) -> Charlie wins L1-M1, Dave is 4th
    // W2-M1 (Winners Finals): Alice (9.080) vs Bob (9.190) -> Alice to GF, Bob drops to L2
    // Round 3 attempts:
    // L2-M1 (Losers Finals): Charlie (9.270) vs Bob (9.180) -> Bob to GF, Charlie is 3rd
    // Grand Finals (GF-M1): Alice (9.050) vs Bob (9.150) -> Alice is Champion, Bob is Runner-up
    const attempts = [
      // Alice (e1)
      makeAttempt("a1-1", "e1", 1, "9.100"),
      makeAttempt("a1-2", "e1", 2, "9.080"),
      makeAttempt("a1-3", "e1", 3, "9.050"),
      // Bob (e2)
      makeAttempt("a2-1", "e2", 1, "9.200"),
      makeAttempt("a2-2", "e2", 2, "9.190"),
      makeAttempt("a2-3", "e2", 3, "9.180"),
      makeAttempt("a2-4", "e2", 4, "9.150"),
      // Charlie (e3)
      makeAttempt("a3-1", "e3", 1, "9.300"),
      makeAttempt("a3-2", "e3", 2, "9.280"),
      makeAttempt("a3-3", "e3", 3, "9.270"),
      // Dave (e4)
      makeAttempt("a4-1", "e4", 1, "9.400"),
      makeAttempt("a4-2", "e4", 2, "9.390"),
    ];

    const ladder = buildBracketLadder(entries, attempts, {
      losersBracket: true,
      winCriterion: "fastest_time",
    });

    expect(ladder.hasLosersBracket).toBe(true);
    expect(ladder.winnersRounds).toHaveLength(2); // W1 (Semifinals), W2 (Winners Finals)
    expect(ladder.losersRounds).toHaveLength(2); // L1 (Losers Semifinals), L2 (Losers Finals)
    expect(ladder.grandFinal).toBeDefined();

    // Check Champion & Runner-up
    expect(ladder.championId).toBe("e1");
    expect(ladder.runnerUpId).toBe("e2");

    // Check specific placements
    const results = ladder.resultsByEntryId;
    expect(results["e1"].isChampion).toBe(true);
    expect(results["e1"].placementRank).toBe(1);

    expect(results["e2"].isRunnerUp).toBe(true);
    expect(results["e2"].placementRank).toBe(2);

    expect(results["e3"].placementRank).toBe(3);
    expect(results["e3"].statusLabel).toBe("3rd Place");

    expect(results["e4"].placementRank).toBe(4);
    expect(results["e4"].statusLabel).toBe("4th Place");

    // Verify deterministic order via rankEntries
    const e1Score = scoreHeadToHead(attempts.filter((a) => a.entryId === "e1"), {}, results["e1"]);
    const e2Score = scoreHeadToHead(attempts.filter((a) => a.entryId === "e2"), {}, results["e2"]);
    const e3Score = scoreHeadToHead(attempts.filter((a) => a.entryId === "e3"), {}, results["e3"]);
    const e4Score = scoreHeadToHead(attempts.filter((a) => a.entryId === "e4"), {}, results["e4"]);

    const ranked = rankEntries([
      { entryId: "e4", score: e4Score, seed: 4 },
      { entryId: "e1", score: e1Score, seed: 1 },
      { entryId: "e3", score: e3Score, seed: 3 },
      { entryId: "e2", score: e2Score, seed: 2 },
    ]);

    expect(ranked.map((r) => [r.entryId, r.rank])).toEqual([
      ["e1", 1],
      ["e2", 2],
      ["e3", 3],
      ["e4", 4],
    ]);
  });

  it("handles 8-car double elimination structure with byes", () => {
    const entries = [
      { id: "e1", display_name: "Racer 1", seed: 1 },
      { id: "e2", display_name: "Racer 2", seed: 2 },
      { id: "e3", display_name: "Racer 3", seed: 3 },
      { id: "e4", display_name: "Racer 4", seed: 4 },
      { id: "e5", display_name: "Racer 5", seed: 5 },
      { id: "e6", display_name: "Racer 6", seed: 6 },
    ];

    const ladder = buildBracketLadder(entries, [], {
      losersBracket: true,
      bracketSize: 8,
    });

    expect(ladder.hasLosersBracket).toBe(true);
    expect(ladder.bracketSize).toBe(8);
    expect(ladder.winnersRounds).toHaveLength(3); // W1, W2, W3
    expect(ladder.losersRounds).toHaveLength(4); // L1, L2, L3, L4
    expect(ladder.grandFinal).toBeDefined();

    // Top seeds get byes in Round 1
    const w1 = ladder.winnersRounds![0].matchups;
    expect(w1[0].racer1?.entryId).toBe("e1");
    expect(w1[0].racer2?.isBye).toBe(true);
    expect(w1[0].winnerId).toBe("e1");
  });
});

describe("Scoring Fields Form Parsing", () => {
  it("extracts winCriterion and losersBracket correctly from form data", () => {
    const form = new FormData();
    form.set("scoring_type", "head_to_head");
    form.set("bracketSize", "8");
    form.set("seedMethod", "seed");
    form.set("winCriterion", "first_to_finish");
    form.set("losersBracket", "on");

    const parsed = scoringFromForm(form);
    expect(parsed.scoring_type).toBe("head_to_head");
    expect(parsed.scoring_config.winCriterion).toBe("first_to_finish");
    expect(parsed.scoring_config.losersBracket).toBe(true);
    expect(parsed.scoring_config.bracketSize).toBe(8);
  });

  it("defaults requiredPasses to 1 in bracket racing and keeps it adjustable", () => {
    // 1. When not specified on form, defaults to 1
    const defaultForm = new FormData();
    defaultForm.set("scoring_type", "head_to_head");
    const defaultParsed = scoringFromForm(defaultForm);
    expect(defaultParsed.scoring_config.requiredPasses).toBe(1);

    // 2. When adjusted by user (e.g. 3 passes), respects it
    const adjustedForm = new FormData();
    adjustedForm.set("scoring_type", "head_to_head");
    adjustedForm.set("requiredPasses", "3");
    const adjustedParsed = scoringFromForm(adjustedForm);
    expect(adjustedParsed.scoring_config.requiredPasses).toBe(3);

    // 3. passCount returns 1 by default for bracket class with no runs yet
    expect(passCount({ bracketSize: 8, requiredPasses: 1 }, [])).toBe(1);

    // 4. passCount returns configured amount when adjusted to 3
    expect(passCount({ bracketSize: 8, requiredPasses: 3 }, [])).toBe(3);

    // 5. passCount automatically expands when attempts with higher ordinals exist
    expect(passCount({ bracketSize: 8, requiredPasses: 1 }, [{ ordinal: 2 }])).toBe(2);
  });
});

