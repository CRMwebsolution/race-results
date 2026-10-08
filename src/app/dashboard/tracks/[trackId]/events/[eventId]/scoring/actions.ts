"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { parseAttemptInput } from "@/scoring/parser";
import type { Database } from "@/types/database";

type SaveResult = { success: false; error: string; errorCode?:string } | {
  success: true; attempt: Database["public"]["Tables"]["attempts"]["Row"];
  working_revision: number; published_revision: number | null;
};

export async function saveAttempt(
  trackId: string, eventId: string, eventClassId: string, entryId: string,
  ordinal: number, rawInput: string, penaltyMs: number, expectedVersion: number, operationId?:string
): Promise<SaveResult> {
  const parsed = parseAttemptInput(rawInput, penaltyMs);
  if (parsed.error) return { success: false, error: parsed.error };
  if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > 100 ||
      !Number.isInteger(expectedVersion) || expectedVersion < 0) return { success: false, error: "Invalid pass number or save version" };
  const supabase = await createClient();
  // Generated RPC argument types do not express nullable SQL inputs. Send explicit
  // nulls (omitting a required argument would prevent PostgREST resolving the RPC).
  const args = {
    p_track_id: trackId, p_event_id: eventId, p_class_id: eventClassId, p_entry_id: entryId,
    p_ordinal: ordinal, p_status: parsed.status, p_elapsed_ms: parsed.elapsedMs,
    p_distance_mm: parsed.distanceMm, p_penalty_ms: parsed.penaltyMs, p_raw_input: parsed.rawInput,
    p_expected_version: expectedVersion,
  } as unknown as Database["public"]["Functions"]["save_race_attempt"]["Args"];
  const { data, error } = operationId ? await supabase.rpc("save_race_attempt_operation",{...args,p_operation_id:operationId}) : await supabase.rpc("save_race_attempt", args);
  if (error) return { success: false, error: error.message, errorCode:error.code };
  if (!data || typeof data !== "object" || Array.isArray(data) || !data.attempt) {
    return { success: false, error: "The server did not confirm this save. Refresh to check the recorded pass." };
  }
  const result = data as {
    attempt: Database["public"]["Tables"]["attempts"]["Row"];
    working_revision: number; published_revision: number | null;
  };
  revalidatePath("/dashboard/tracks/" + trackId + "/events/" + eventId + "/scoring");
  return { success: true, ...result };
}

export async function setBracketMatchWinner(
  trackId: string,
  eventId: string,
  eventClassId: string,
  matchId: string,
  winnerEntryId: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: cls, error: fetchError } = await supabase
    .from("event_classes")
    .select("scoring_config")
    .eq("id", eventClassId)
    .eq("event_id", eventId)
    .single();

  if (fetchError || !cls) {
    return { success: false, error: fetchError?.message || "Class not found" };
  }

  const currentConfig = (cls.scoring_config as Record<string, any>) || {};
  const currentManual = { ...(currentConfig.manualWinners || {}) };

  if (winnerEntryId) {
    currentManual[matchId] = winnerEntryId;
  } else {
    delete currentManual[matchId];
  }

  const nextConfig = {
    ...currentConfig,
    manualWinners: currentManual,
  };

  const { error: updateError } = await supabase
    .from("event_classes")
    .update({ scoring_config: nextConfig })
    .eq("id", eventClassId)
    .eq("event_id", eventId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath(`/dashboard/tracks/${trackId}/events/${eventId}/scoring`);
  revalidatePath(`/r`, "layout");
  revalidatePath(`/s`, "layout");
  return { success: true };
}

export async function setBracketPasses(
  trackId: string,
  eventId: string,
  eventClassId: string,
  passes: number
): Promise<{ success: boolean; error?: string }> {
  if (!Number.isInteger(passes) || passes < 1 || passes > 100) {
    return { success: false, error: "Passes must be an integer between 1 and 100" };
  }
  const supabase = await createClient();
  const { data: cls, error: fetchError } = await supabase
    .from("event_classes")
    .select("scoring_config")
    .eq("id", eventClassId)
    .eq("event_id", eventId)
    .single();

  if (fetchError || !cls) {
    return { success: false, error: fetchError?.message || "Class not found" };
  }

  const currentConfig = (cls.scoring_config as Record<string, any>) || {};
  const nextConfig = {
    ...currentConfig,
    requiredPasses: passes,
  };

  const { error: updateError } = await supabase
    .from("event_classes")
    .update({ scoring_config: nextConfig })
    .eq("id", eventClassId)
    .eq("event_id", eventId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath(`/dashboard/tracks/${trackId}/events/${eventId}/scoring`);
  revalidatePath(`/r`, "layout");
  revalidatePath(`/s`, "layout");
  return { success: true };
}
