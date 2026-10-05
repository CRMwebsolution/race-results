"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateTrackSlug } from "@/lib/slug";

export type ActionState = {
  success?: boolean;
  error?: string | null;
  data?: unknown;
};

export async function registerTrackAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  const trackName = (formData.get("trackName") as string)?.trim();
  const shorthand = (formData.get("shorthand") as string)?.trim() || null;
  const timezone = (formData.get("timezone") as string) || "America/New_York";

  if (!trackName) {
    return { error: "Track name is required" };
  }

  // Auto-populate slug from shorthand if exists, otherwise from track name
  const slug = generateTrackSlug(trackName, shorthand);

  const { data, error } = await supabase.rpc("register_track", {
    p_track_name: trackName,
    p_shorthand: shorthand,
    p_timezone: timezone,
    p_slug: slug,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true, data };
}
