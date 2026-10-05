import { AttemptStatus } from "./types";

export type ParsedAttempt = {
  status: AttemptStatus;
  elapsedMs: number | null;
  distanceMm: number | null;
  penaltyMs: number;
  rawInput: string;
};

const MM_PER_FOOT = 304.8;
const MM_PER_INCH = 25.4;
const MM_PER_METER = 1000.0;

/**
 * Parses raw attempt input string into structured performance data.
 * Preserves raw input exactly.
 */
export function parseAttemptInput(
  raw: string | null | undefined,
  penaltyMs = 0
): ParsedAttempt {
  const trimmed = (raw ?? "").trim();

  // Blank / empty input
  if (!trimmed) {
    return {
      status: "no_time",
      elapsedMs: null,
      distanceMm: null,
      penaltyMs: 0,
      rawInput: raw ?? "",
    };
  }

  const upper = trimmed.toUpperCase();

  // Explicit non-completion markers
  if (upper === "DQ" || upper === "DISQUALIFIED") {
    return {
      status: "dq",
      elapsedMs: null,
      distanceMm: null,
      penaltyMs: 0,
      rawInput: trimmed,
    };
  }

  if (upper === "DNF" || upper === "DID NOT FINISH") {
    return {
      status: "dnf",
      elapsedMs: null,
      distanceMm: null,
      penaltyMs: 0,
      rawInput: trimmed,
    };
  }

  if (upper === "DNS" || upper === "DID NOT START") {
    return {
      status: "dns",
      elapsedMs: null,
      distanceMm: null,
      penaltyMs: 0,
      rawInput: trimmed,
    };
  }

  if (upper === "NT" || upper === "NO TIME" || upper === "NO_TIME") {
    return {
      status: "no_time",
      elapsedMs: null,
      distanceMm: null,
      penaltyMs: 0,
      rawInput: trimmed,
    };
  }

  // Distance format: e.g. "200ft", "200 ft", "108.9ft", "108.9'", "50m", "100in"
  const distanceFeetMatch = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:ft|feet|')$/i);
  if (distanceFeetMatch) {
    const feet = parseFloat(distanceFeetMatch[1]);
    const distanceMm = Math.round(feet * MM_PER_FOOT);
    return {
      status: "valid",
      elapsedMs: null,
      distanceMm,
      penaltyMs,
      rawInput: trimmed,
    };
  }

  const distanceMetersMatch = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:m|meters)$/i);
  if (distanceMetersMatch) {
    const meters = parseFloat(distanceMetersMatch[1]);
    const distanceMm = Math.round(meters * MM_PER_METER);
    return {
      status: "valid",
      elapsedMs: null,
      distanceMm,
      penaltyMs,
      rawInput: trimmed,
    };
  }

  const distanceInchesMatch = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:in|inches|")$/i);
  if (distanceInchesMatch) {
    const inches = parseFloat(distanceInchesMatch[1]);
    const distanceMm = Math.round(inches * MM_PER_INCH);
    return {
      status: "valid",
      elapsedMs: null,
      distanceMm,
      penaltyMs,
      rawInput: trimmed,
    };
  }

  // Time format: e.g. "9.082", "9.019", "9.082s", "9.082 s", "12"
  const timeMatch = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*s?$/i);
  if (timeMatch) {
    const seconds = parseFloat(timeMatch[1]);
    const elapsedMs = Math.round(seconds * 1000);
    return {
      status: "valid",
      elapsedMs,
      distanceMm: null,
      penaltyMs,
      rawInput: trimmed,
    };
  }

  // Fallback for unparseable input: treat as no_time to prevent corrupted calculations
  return {
    status: "no_time",
    elapsedMs: null,
    distanceMm: null,
    penaltyMs: 0,
    rawInput: trimmed,
  };
}

/**
 * Format milliseconds into standard elapsed seconds string (e.g. "9.019 s").
 */
export function formatSeconds(ms: number | null | undefined, decimals = 3): string {
  if (ms == null) return "-";
  return `${(ms / 1000).toFixed(decimals)} s`;
}

/**
 * Format millimeters into feet display string (e.g. "200.0 ft").
 */
export function formatFeet(mm: number | null | undefined, decimals = 1): string {
  if (mm == null) return "-";
  return `${(mm / MM_PER_FOOT).toFixed(decimals)} ft`;
}
