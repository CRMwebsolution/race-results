import { describe, expect, it } from "vitest";
import { Attempt, compareScores, parseAttemptInput, rankEntries, scoreClass, scoreCombinedTime } from "../index";

function attempt(ordinal: number, raw: string, penalty = 0): Attempt {
  return { ...parseAttemptInput(raw, penalty), id: String(ordinal), entryId: "entry", ordinal };
}
describe("Scoring repairs", () => {
  it("includes every required pass penalty in combined time", () => {
    expect(scoreCombinedTime([attempt(1, "9", 500), attempt(2, "10", 250)]).primary).toBe(19750);
    expect(scoreCombinedTime([attempt(1, "9"), attempt(2, "DQ")]).eligible).toBe(false);
  });
  it("merges partial configuration with defaults and rejects invalid configurations", () => {
    expect(scoreClass("combined_time", [attempt(1, "9")], { decimals: 3 }).eligible).toBe(false);
    expect(scoreClass("combined_time", [attempt(1, "9"), attempt(2, "10")], { decimals: 3 }).primary).toBe(19000);
    for (const requiredPasses of [0, -1, 1.5, 101, "2"]) {
      expect(scoreClass("combined_time", [], { requiredPasses }).details.error).toBeTruthy();
    }
    expect(scoreClass("consistency", [], { requiredOrdinals: [1, 1] }).details.error).toBeTruthy();
    expect(scoreClass("fastest_pass", [], { timeDecimals: 100 }).details.error).toBeTruthy();
  });
  it("fails explicitly on unsupported formats and scorer versions", () => {
    expect(scoreClass("team_aggregate", [attempt(1, "9")]).details.error).toBeTruthy();
    expect(scoreClass("fastest_pass", [attempt(1, "9")], {}, 2).details.error).toBeTruthy();
  });
  it.each(["fastest_pass", "stopped_distance"])("ranks every distance tiebreaker descending for %s", type => {
    const a = scoreClass(type, [attempt(1, "200ft"), attempt(2, "190ft")]);
    const b = scoreClass(type, [attempt(1, "200ft"), attempt(2, "180ft")]);
    expect(compareScores(a, b)).toBeLessThan(0);
    expect(compareScores(a, scoreClass(type, [attempt(1, "200ft")]))).toBeLessThan(0);
  });
  it("uses all score tiebreakers, without treating seed/draw as a sporting win", () => {
    const entries = [
      { entryId: "b", orderNum: 1, score: scoreClass("fastest_pass", [attempt(1,"9"),attempt(2,"10"),attempt(3,"12")]) },
      { entryId: "a", orderNum: 2, score: scoreClass("fastest_pass", [attempt(1,"9"),attempt(2,"10"),attempt(3,"11")]) },
      { entryId: "c", orderNum: 3, score: scoreClass("fastest_pass", [attempt(1,"9"),attempt(2,"10"),attempt(3,"11")]) },
      { entryId: "d", orderNum: 4, score: scoreClass("fastest_pass", [attempt(1,"DQ")]) },
    ];
    expect(rankEntries(entries).map(e => [e.entryId,e.rank,e.tied])).toEqual([
      ["a",1,true],["c",1,true],["b",3,false],["d",null,false],
    ]);
  });
  it("preserves exact input, supports feet plus inches, and rejects invalid or out-of-range values", () => {
    expect(parseAttemptInput(" 9.082 s ").rawInput).toBe(" 9.082 s ");
    expect(parseAttemptInput("12'6\"").distanceMm).toBe(3810);
    expect(parseAttemptInput("12 ft 6 in").distanceMm).toBe(3810);
    expect(parseAttemptInput("0ft").error).toBeUndefined();
    for (const raw of ["0", "0.0001", "oops", "12'13\"", "999999999999s", "999999999999m"]) {
      expect(parseAttemptInput(raw).error).toBeTruthy();
    }
    expect(parseAttemptInput("9", -1).error).toBeTruthy();
  });
});
