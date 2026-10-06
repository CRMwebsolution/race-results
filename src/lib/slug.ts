/**
 * Generates a clean URL slug for a track:
 * - If shorthand name exists, slug auto-populates from shorthand.
 * - If no shorthand name, slug auto-populates from track name using hyphens/underscores instead of spaces.
 */
export function generateTrackSlug(
  trackName: string,
  shorthand?: string | null
): string {
  const raw = (shorthand && shorthand.trim()) ? shorthand.trim() : (trackName || "").trim();

  return raw
    .toLowerCase()
    .replace(/%20/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Separate server action allocation from the rendered form; avoid short timestamp collisions. */
export function uniqueRaceSlug(name: string): string {
  return `${generateTrackSlug(name) || "race"}-${crypto.randomUUID()}`;
}
