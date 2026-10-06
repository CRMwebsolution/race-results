"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateTrackSettings(trackId: string, defaultClasses: any[]) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("tracks")
    .update({ default_classes: defaultClasses })
    .eq("id", trackId).select("id").single();

  if (error) {
    console.error("Failed to update track settings", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/dashboard/tracks/${trackId}`);
  revalidatePath(`/dashboard/tracks/${trackId}/settings`);
  
  return { success: true };
}
