import { AttemptStatus } from "./types";

export type ParsedAttempt = {
  status: AttemptStatus;
  elapsedMs: number | null;
  distanceMm: number | null;
  penaltyMs: number;
  rawInput: string;
  error?: string;
};

const MAX_INT = 2147483647;
const MM_PER_FOOT = 304.8;
const MM_PER_INCH = 25.4;

/** Preserve raw input exactly; invalid input is explicitly rejected by saving callers. */
export function parseAttemptInput(raw: string | null | undefined, penaltyMs = 0): ParsedAttempt {
  const rawInput = raw ?? "";
  const trimmed = rawInput.trim();
  const empty: ParsedAttempt = { status: "no_time", elapsedMs: null, distanceMm: null, penaltyMs: 0, rawInput };
  const fail = (error: string) => ({ ...empty, error });
  if (!Number.isInteger(penaltyMs) || penaltyMs < 0 || penaltyMs > MAX_INT) return fail("Invalid penalty");
  if (!trimmed) return empty;
  const markers: Record<string, AttemptStatus> = {
    "-": "no_time", "NO PASS": "no_time",
    DQ: "dq", DISQUALIFIED: "dq", DNF: "dnf", "DID NOT FINISH": "dnf",
    DNS: "dns", "DID NOT START": "dns", NT: "no_time", "NO TIME": "no_time", NO_TIME: "no_time",
  };
  const marker = markers[trimmed.toUpperCase()];
  if (marker) return { ...empty, status: marker };

  const combined = trimmed.match(/^([0-9]+)\s*(?:ft|feet|')\s*([0-9]+(?:\.[0-9]+)?)\s*(?:in|inches|")$/i);
  const distance = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*(ft|feet|'|m|meters|in|inches|")$/i);
  let distanceMm: number | undefined;
  if (combined) {
    const inches = Number(combined[2]);
    if (inches >= 12) return fail("Use fewer than 12 inches with feet");
    distanceMm = Math.round(Number(combined[1]) * MM_PER_FOOT + inches * MM_PER_INCH);
  } else if (distance) {
    const unit = distance[2].toLowerCase();
    const multiplier = ["ft", "feet", "'"].includes(unit) ? MM_PER_FOOT :
      ["m", "meters"].includes(unit) ? 1000 : MM_PER_INCH;
    distanceMm = Math.round(Number(distance[1]) * multiplier);
  }
  if (distanceMm !== undefined) {
    if (!Number.isSafeInteger(distanceMm) || distanceMm < 0 || distanceMm > MAX_INT) return fail("Distance is out of range");
    return { status: "valid", elapsedMs: null, distanceMm, penaltyMs, rawInput };
  }
  const time = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*s?$/i);
  if (time) {
    const elapsedMs = Math.round(Number(time[1]) * 1000);
    if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 1 || elapsedMs > MAX_INT) return fail("Time must be positive and within range");
    return { status: "valid", elapsedMs, distanceMm: null, penaltyMs, rawInput };
  }
  return fail("Enter a time, distance, - for no pass, DQ, DNF, or DNS");
}

export function formatSeconds(ms: number | null | undefined, decimals = 3): string {
  return ms == null ? "-" : `${(ms / 1000).toFixed(decimals)} s`;
}
export function formatFeet(mm: number | null | undefined, decimals = 1): string {
  return mm == null ? "-" : `${(mm / MM_PER_FOOT).toFixed(decimals)} ft`;
}
