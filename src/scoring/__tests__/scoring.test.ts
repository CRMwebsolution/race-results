import { describe, it, expect } from "vitest";
import {
  parseAttemptInput,
  formatSeconds,
  formatFeet,
  scoreFastestPass,
  scoreStoppedDistance,
  scoreConsistency,
  compareScores,
  compareRankedEntries,
  Attempt,
  Score,
} from "../index";

describe("Scoring Engine: Input Parser", () => {
  it("parses valid elapsed time strings into milliseconds", () => {
    const r1 = parseAttemptInput("9.082");
    expect(r1.status).toBe("valid");
    expect(r1.elapsedMs).toBe(9082);
    expect(r1.distanceMm).toBeNull();
    expect(r1.rawInput).toBe("9.082");

    const r2 = parseAttemptInput("9.019s");
    expect(r2.status).toBe("valid");
    expect(r2.elapsedMs).toBe(9019);

    const r3 = parseAttemptInput("12.4 s", 500);
    expect(r3.status).toBe("valid");
    expect(r3.elapsedMs).toBe(12400);
    expect(r3.penaltyMs).toBe(500);
  });

  it("parses distance strings into millimeters", () => {
    const r1 = parseAttemptInput("200ft");
    expect(r1.status).toBe("valid");
    expect(r1.elapsedMs).toBeNull();
    // 200 * 304.8 = 60960
    expect(r1.distanceMm).toBe(60960);
    expect(r1.rawInput).toBe("200ft");

    const r2 = parseAttemptInput("108.9 ft");
    expect(r2.status).toBe("valid");
    // 108.9 * 304.8 = 33192.72 -> 33193
    expect(r2.distanceMm).toBe(33193);

    const r3 = parseAttemptInput("50m");
    expect(r3.status).toBe("valid");
    expect(r3.distanceMm).toBe(50000);
  });

  it("handles disqualifications and non-completions without turning them into numbers", () => {
    const dq = parseAttemptInput("DQ");
    expect(dq.status).toBe("dq");
    expect(dq.elapsedMs).toBeNull();
    expect(dq.distanceMm).toBeNull();

    const dnf = parseAttemptInput("DNF");
    expect(dnf.status).toBe("dnf");

    const dns = parseAttemptInput("dns");
    expect(dns.status).toBe("dns");

    const nt = parseAttemptInput("NO TIME");
    expect(nt.status).toBe("no_time");
  });

  it("handles blank and whitespace-only attempts gracefully", () => {
    const blank = parseAttemptInput("");
    expect(blank.status).toBe("no_time");
    expect(blank.elapsedMs).toBeNull();
    expect(blank.distanceMm).toBeNull();

    const ws = parseAttemptInput("   ");
    expect(ws.status).toBe("no_time");

    const nil = parseAttemptInput(null);
    expect(nil.status).toBe("no_time");
  });

  it("retains a dash as an explicit no-pass result without assigning a time or distance", () => {
    const attempt = parseAttemptInput(" - ");
    expect(attempt.error).toBeUndefined();
    expect(attempt.status).toBe("no_time");
    expect(attempt.elapsedMs).toBeNull();
    expect(attempt.distanceMm).toBeNull();
    expect(attempt.rawInput).toBe(" - ");
    const score = scoreFastestPass([{id:"no-pass",entryId:"racer",ordinal:1,...attempt}]);
    expect(score.eligible).toBe(false);
  });
});

describe("Scoring Engine: Fastest Pass & Blueprint Regression", () => {
  const createAttempt = (
    ordinal: number,
    raw: string,
    penaltyMs = 0
  ): Attempt => {
    const parsed = parseAttemptInput(raw, penaltyMs);
    return {
      id: `att-${ordinal}`,
      entryId: "entry-1",
      ordinal,
      status: parsed.status,
      elapsedMs: parsed.elapsedMs,
      distanceMm: parsed.distanceMm,
      penaltyMs: parsed.penaltyMs,
      rawInput: parsed.rawInput,
    };
  };

  it("regression test: 9.082 and 9.019 produce best pass 9.019", () => {
    const attempts: Attempt[] = [
      createAttempt(1, "9.082"),
      createAttempt(2, "9.019"),
    ];

    const result = scoreFastestPass(attempts);
    expect(result.eligible).toBe(true);
    expect(result.group).toBe("timed");
    expect(result.primary).toBe(9019);
    expect(result.label).toBe("9.019 s");
    expect(result.details.bestElapsedMs).toBe(9019);
  });

  it("calculates penalties into the adjusted fastest pass time", () => {
    const attempts: Attempt[] = [
      createAttempt(1, "9.000", 500), // 9.500 s
      createAttempt(2, "9.200", 0),   // 9.200 s
    ];

    const result = scoreFastestPass(attempts);
    expect(result.eligible).toBe(true);
    expect(result.primary).toBe(9200);
    expect(result.label).toBe("9.200 s");
  });

  it("falls back to greatest stopped distance when no timed pass exists", () => {
    const attempts: Attempt[] = [
      createAttempt(1, "200ft"),
      createAttempt(2, "120ft"),
    ];

    const result = scoreFastestPass(attempts);
    expect(result.eligible).toBe(true);
    expect(result.group).toBe("distance");
    expect(result.primary).toBe(60960); // 200ft in mm
    expect(result.direction).toBe("desc");
    expect(result.label).toBe("200.0 ft");
  });

  it("ignores DQ and ranks by distance if another run has distance", () => {
    const attempts: Attempt[] = [
      createAttempt(1, "DQ"),
      createAttempt(2, "108.9ft"),
    ];

    const result = scoreFastestPass(attempts);
    expect(result.eligible).toBe(true);
    expect(result.group).toBe("distance");
    expect(result.label).toBe("108.9 ft");
  });

  it("returns ineligible when all runs are DQ, DNF, or blank", () => {
    const attempts: Attempt[] = [
      createAttempt(1, "DQ"),
      createAttempt(2, "DNF"),
      createAttempt(3, ""),
    ];

    const result = scoreFastestPass(attempts);
    expect(result.eligible).toBe(false);
    expect(result.primary).toBeNull();
    expect(result.label).toBe("No qualifying pass");
  });
});

describe("Scoring Engine: Consistency & Blueprint Regression", () => {
  const createAttempt = (ordinal: number, raw: string): Attempt => {
    const parsed = parseAttemptInput(raw);
    return {
      id: `att-${ordinal}`,
      entryId: "entry-1",
      ordinal,
      status: parsed.status,
      elapsedMs: parsed.elapsedMs,
      distanceMm: parsed.distanceMm,
      penaltyMs: parsed.penaltyMs,
      rawInput: parsed.rawInput,
    };
  };

  it("regression test: 9.082 and 9.019 produce consistency 0.063", () => {
    const attempts: Attempt[] = [
      createAttempt(1, "9.082"),
      createAttempt(2, "9.019"),
    ];

    const result = scoreConsistency(attempts);
    expect(result.eligible).toBe(true);
    expect(result.group).toBe("timed");
    expect(result.primary).toBe(63); // 9082 - 9019 = 63 ms
    expect(result.label).toBe("0.063 s");
    // First tiebreaker is best pass (9019 ms)
    expect(result.tieBreakers).toEqual([9019]);
    expect(result.details.firstMs).toBe(9082);
    expect(result.details.secondMs).toBe(9019);
    expect(result.details.differenceMs).toBe(63);
  });

  it("blueprint test: 9.000 and 9.000 produce consistency 0.000", () => {
    const attempts: Attempt[] = [
      createAttempt(1, "9.000"),
      createAttempt(2, "9.000"),
    ];

    const result = scoreConsistency(attempts);
    expect(result.eligible).toBe(true);
    expect(result.primary).toBe(0);
    expect(result.label).toBe("0.000 s");
    expect(result.tieBreakers).toEqual([9000]);
  });

  it("ineligible if one pass is distance and not timed", () => {
    const attempts: Attempt[] = [
      createAttempt(1, "8.900"),
      createAttempt(2, "200ft"),
    ];

    const result = scoreConsistency(attempts);
    expect(result.eligible).toBe(false);
    expect(result.primary).toBeNull();
    expect(result.label).toBe("Two valid passes required");
  });

  it("ineligible if second pass is DQ", () => {
    const attempts: Attempt[] = [
      createAttempt(1, "9.000"),
      createAttempt(2, "DQ"),
    ];

    const result = scoreConsistency(attempts);
    expect(result.eligible).toBe(false);
    expect(result.primary).toBeNull();
  });
});

describe("Scoring Engine: Stopped Distance Dedicated", () => {
  const createAttempt = (ordinal: number, raw: string): Attempt => {
    const parsed = parseAttemptInput(raw);
    return {
      id: `att-${ordinal}`,
      entryId: "entry-1",
      ordinal,
      status: parsed.status,
      elapsedMs: parsed.elapsedMs,
      distanceMm: parsed.distanceMm,
      penaltyMs: parsed.penaltyMs,
      rawInput: parsed.rawInput,
    };
  };

  it("chooses greatest distance with distance tiebreakers", () => {
    const attempts: Attempt[] = [
      createAttempt(1, "120ft"),
      createAttempt(2, "200ft"),
    ];

    const result = scoreStoppedDistance(attempts);
    expect(result.eligible).toBe(true);
    expect(result.group).toBe("distance");
    expect(result.primary).toBe(60960);
    expect(result.direction).toBe("desc");
    expect(result.label).toBe("200.0 ft");
  });

  it("returns ineligible when no distance attempts recorded", () => {
    const attempts: Attempt[] = [createAttempt(1, "DQ")];
    const result = scoreStoppedDistance(attempts);
    expect(result.eligible).toBe(false);
  });
});

describe("Scoring Engine: Precedence and compareScores", () => {
  it("strictly ranks a completed timed run ahead of any stopped distance", () => {
    const timedScore: Score = {
      eligible: true,
      group: "timed",
      primary: 15000, // 15.0 s (slow time)
      direction: "asc",
      tieBreakers: [],
      label: "15.000 s",
      details: {},
    };

    const distanceScore: Score = {
      eligible: true,
      group: "distance",
      primary: 90000, // 90 meters (huge distance)
      direction: "desc",
      tieBreakers: [],
      label: "295.3 ft",
      details: {},
    };

    // compareScores returns negative if A ranks higher than B
    expect(compareScores(timedScore, distanceScore)).toBeLessThan(0);
    expect(compareScores(distanceScore, timedScore)).toBeGreaterThan(0);
  });

  it("ranks greater distance higher when both are distance scores", () => {
    const score200: Score = {
      eligible: true,
      group: "distance",
      primary: 60960, // 200 ft
      direction: "desc",
      tieBreakers: [],
      label: "200.0 ft",
      details: {},
    };

    const score120: Score = {
      eligible: true,
      group: "distance",
      primary: 36576, // 120 ft
      direction: "desc",
      tieBreakers: [],
      label: "120.0 ft",
      details: {},
    };

    expect(compareScores(score200, score120)).toBeLessThan(0);
  });

  it("ranks eligible ahead of ineligible", () => {
    const eligible: Score = {
      eligible: true,
      group: "timed",
      primary: 9000,
      direction: "asc",
      tieBreakers: [],
      label: "9.000 s",
      details: {},
    };

    const ineligible: Score = {
      eligible: false,
      group: "none",
      primary: null,
      direction: "asc",
      tieBreakers: [],
      label: "DQ",
      details: {},
    };

    expect(compareScores(eligible, ineligible)).toBeLessThan(0);
    expect(compareScores(ineligible, eligible)).toBeGreaterThan(0);
  });

  it("evaluates consistency tiebreaker (best pass) when differences are equal", () => {
    const competitorA: Score = {
      eligible: true,
      group: "timed",
      primary: 50, // 0.050 s difference
      direction: "asc",
      tieBreakers: [9020], // Best pass 9.020 s
      label: "0.050 s",
      details: {},
    };

    const competitorB: Score = {
      eligible: true,
      group: "timed",
      primary: 50, // 0.050 s difference
      direction: "asc",
      tieBreakers: [9010], // Best pass 9.010 s (faster)
      label: "0.050 s",
      details: {},
    };

    // Competitor B should rank ahead because 9010 < 9020
    expect(compareScores(competitorB, competitorA)).toBeLessThan(0);
  });

  it("compareRankedEntries ensures full deterministic tiebreaking", () => {
    const entryA = {
      entryId: "entry-a",
      orderNum: 1,
      seed: 2,
      score: {
        eligible: true,
        group: "timed" as const,
        primary: 9000,
        direction: "asc" as const,
        tieBreakers: [],
        label: "9.000 s",
        details: {},
      },
    };

    const entryB = {
      entryId: "entry-b",
      orderNum: 2,
      seed: 1,
      score: {
        eligible: true,
        group: "timed" as const,
        primary: 9000,
        direction: "asc" as const,
        tieBreakers: [],
        label: "9.000 s",
        details: {},
      },
    };

    // Scores are tied; entryB has lower seed (1 vs 2), so entryB ranks first
    expect(compareRankedEntries(entryB, entryA)).toBeLessThan(0);
  });
});
