"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveAttempt(
  trackId: string,
  eventId: string,
  eventClassId: string,
  entryId: string,
  ordinal: number,
  status: "valid" | "dq" | "dnf" | "dns" | "no_time",
  elapsedMs: number | null,
  distanceMm: number | null,
  penaltyMs: number,
  rawInput: string
) {
  const supabase = await createClient();

  const { error } = await supabase.from("attempts").upsert({
    event_class_id: eventClassId,
    entry_id: entryId,
    ordinal,
    status,
    elapsed_ms: elapsedMs,
    distance_mm: distanceMm,
    penalty_ms: penaltyMs,
    raw_input: rawInput,
  }, {
    onConflict: "entry_id, ordinal"
  });

  if (error) {
    console.error("Failed to save attempt:", error);
    return { error: error.message };
  }

  // Update working and published revision instantly
  const rev = Math.floor(Date.now() / 1000);
  await supabase
    .from("events")
    .update({ 
      working_revision: rev,
      published_revision: rev
    })
    .eq("id", eventId);

  revalidatePath(`/dashboard/tracks/${trackId}/events/${eventId}/scoring`);
  return { success: true };
}

export async function publishRevision(trackId: string, eventId: string) {
  const supabase = await createClient();

  // Get current working revision
  const { data: event } = await supabase
    .from("events")
    .select("working_revision")
    .eq("id", eventId)
    .single();

  if (!event) return { error: "Event not found" };

  const { error } = await supabase
    .from("events")
    .update({ published_revision: event.working_revision })
    .eq("id", eventId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/tracks/${trackId}/events/${eventId}/scoring`);
  revalidatePath(`/r/[slug]`, "layout"); // Revalidate public routes
  return { success: true };
}
