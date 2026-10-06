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

  const slug = generateTrackSlug(trackName, shorthand);
  const state = (formData.get("state") as string) || null;

  const { data, error } = await supabase.rpc("register_track", {
    p_track_name: trackName,
    p_shorthand: shorthand ?? undefined,
    p_timezone: timezone,
    p_slug: slug,
  });

  if (error) {
    if (
      error.message.includes("tracks_slug_key") ||
      error.message.includes("duplicate key") ||
      error.message.includes("Another track already has this URL") ||
      error.code === "23505"
    ) {
      return {
        error:
          "Another track already has this URL, either change your shorthand name or remove it to use the full name.",
      };
    }
    return { error: error.message };
  }

  if (state && data) {
    await supabase.from("tracks").update({ state }).eq("id", data as string);
  }

  revalidatePath("/dashboard");
  return { success: true, data };
}
