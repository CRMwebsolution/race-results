"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateTrackSlug } from "@/lib/slug";

export async function createEvent(trackId: string, formData: FormData) {
  const name = formData.get("name") as string;
  const localDate = formData.get("local_date") as string;
  
  if (!name || !localDate) {
    return { error: "Name and date are required" };
  }

  const supabase = await createClient();

  // Ensure user has access
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const slug = generateTrackSlug(name); // Basic slugification works for events too

  // We use the RPC create_track_event
  const { data: eventId, error } = await supabase.rpc("create_track_event", {
    p_track_id: trackId,
    p_name: name,
    p_local_date: localDate,
    p_slug: slug,
    p_template_ids: [], // No templates yet
  });

  if (error) {
    if (error.message.includes("An event with this URL slug already exists")) {
       return { error: "An event with this URL already exists for this track. Please adjust the name." };
    }
    console.error("Create event error:", error);
    return { error: "Failed to create event: " + error.message };
  }

  revalidatePath(`/dashboard/tracks/${trackId}`);
  redirect(`/dashboard/tracks/${trackId}/events/${eventId}`);
}
