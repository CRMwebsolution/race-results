export type Direction = "asc" | "desc";

export type AttemptStatus = "valid" | "dq" | "dnf" | "dns" | "no_time";

export type Attempt = {
  id: string;
  entryId: string;
  ordinal: number;
  status: AttemptStatus;
  elapsedMs: number | null;
  distanceMm: number | null;
  penaltyMs: number;
  rawInput?: string | null;
};

export type ScoreGroup = "timed" | "distance" | "none";

export type Score = {
  eligible: boolean;
  group?: ScoreGroup;
  primary: number | null;
  direction: Direction;
  tieBreakers: number[];
  label: string;
  details: Record<string, unknown>;
};

export type Scorer<TConfig = void, TInput = Attempt[]> = (
  input: TInput,
  config?: TConfig
) => Score;

/**
 * Compare two scores authoritatively:
 * 1. Eligible entries strictly outrank ineligible entries.
 * 2. Timed completions strictly outrank stopped distances.
 * 3. Distance completions strictly outrank ineligible entries.
 * 4. Within the same group, primary scores are compared according to direction ("asc" for lower-is-better, "desc" for higher-is-better).
 * 5. Tiebreakers are evaluated sequentially (lower is better for standard tiebreakers like best pass).
 */
export function compareScores(a: Score, b: Score): number {
  // 1. Eligibility check
  if (a.eligible !== b.eligible) {
    return a.eligible ? -1 : 1;
  }
  if (!a.eligible && !b.eligible) {
    return 0;
  }

  // 2. Precedence group check: 'timed' beats 'distance'
  const groupOrder: Record<ScoreGroup, number> = {
    timed: 0,
    distance: 1,
    none: 2,
  };
  const groupA = a.group ?? (a.primary != null ? "timed" : "none");
  const groupB = b.group ?? (b.primary != null ? "timed" : "none");

  if (groupOrder[groupA] !== groupOrder[groupB]) {
    return groupOrder[groupA] - groupOrder[groupB];
  }

  // 3. Primary score comparison
  if (a.primary == null || b.primary == null) {
    return a.primary == null ? (b.primary == null ? 0 : 1) : -1;
  }

  const primaryDiff =
    a.direction === "asc" ? a.primary - b.primary : b.primary - a.primary;
  if (primaryDiff !== 0) {
    return primaryDiff;
  }

  // 4. Tiebreaker comparison
  const length = Math.max(a.tieBreakers.length, b.tieBreakers.length);
  for (let i = 0; i < length; i += 1) {
    const valA = a.tieBreakers[i] ?? Number.MAX_SAFE_INTEGER;
    const valB = b.tieBreakers[i] ?? Number.MAX_SAFE_INTEGER;
    const diff = valA - valB;
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

/**
 * Deterministic full-field ranking helper:
 * Combines score comparison with deterministic tiebreakers outside the scorer:
 * 1. Score comparison (compareScores)
 * 2. Seed (if present, lower seed number comes first)
 * 3. Entry orderNum (if present, earlier order comes first)
 * 4. Stable entry ID string comparison
 */
export function compareRankedEntries<
  T extends {
    score: Score;
    seed?: number | null;
    orderNum?: number;
    entryId: string;
  }
>(a: T, b: T): number {
  const scoreDiff = compareScores(a.score, b.score);
  if (scoreDiff !== 0) return scoreDiff;

  // Seed tiebreaker
  if (a.seed != null && b.seed != null && a.seed !== b.seed) {
    return a.seed - b.seed;
  }
  if (a.seed != null && b.seed == null) return -1;
  if (a.seed == null && b.seed != null) return 1;

  // OrderNum tiebreaker
  if (a.orderNum != null && b.orderNum != null && a.orderNum !== b.orderNum) {
    return a.orderNum - b.orderNum;
  }

  // Final deterministic string comparison on ID
  return a.entryId.localeCompare(b.entryId);
}

/**
 * Helper to compute adjusted elapsed time including penalties.
 */
export function adjustedTime(attempt: Attempt): number | null {
  return attempt.status === "valid" && attempt.elapsedMs != null
    ? attempt.elapsedMs + (attempt.penaltyMs ?? 0)
    : null;
}
