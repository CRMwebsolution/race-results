/**
 * Normalizes Supabase project URL to ensure standard origin without trailing slashes,
 * path suffixes (/rest/v1, /auth/v1), or whitespace.
 */
export function normalizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl) {
    return "https://kzugyadzbqnurwbkmrik.supabase.co";
  }

  let url = rawUrl.trim();
  // Strip trailing slashes
  url = url.replace(/\/+$/, "");
  // Strip common misconfigured path suffixes
  url = url.replace(/\/rest\/v1\/?$/i, "");
  url = url.replace(/\/auth\/v1\/?$/i, "");

  return url;
}
