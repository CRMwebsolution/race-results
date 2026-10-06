"use server";
import {judgeInput} from "@/scoring/multi-judge";
import { readAll } from "@/lib/read-all";

import { createClient } from "@/lib/supabase/server";
import { scoreClass, rankEntries } from "@/scoring";

export async function finalizeEventStandings(eventId: string) {
  const supabase = await createClient();

  const { data: event, error: eventError } = await supabase.from("events").select("working_revision").eq("id",eventId).single();
  if (eventError || !event) return { error: eventError?.message ?? "Event not found" };

  // Fetch one revision, then compare it inside the transaction after calculating.
  // 1. Fetch all classes
  const { data: classes, error: classesError } = await readAll(supabase
    .from("event_classes")
    .select("*")
    .eq("event_id", eventId));

  if (classesError) return { error: classesError.message };
  if (!classes) return { error: "Classes unavailable" };

  // 2. Fetch all entries
  const { data: entries, error: entriesError } = classes.length ? await readAll(supabase
    .from("entries")
    .select("*")
    .in("event_class_id", classes.map(c => c.id))) : { data: [], error: null };

  // 3. Fetch all attempts
  const { data: attempts, error: attemptsError } = classes.length ? await readAll(supabase
    .from("attempts")
    .select("*")
    .in("event_class_id", classes.map(c => c.id))) : { data: [], error: null };

  if (entriesError || attemptsError) return { error: entriesError?.message ?? attemptsError?.message };

  const {data:judgeScores}=classes.length ? await readAll(supabase.from("judge_scores").select("*").in("event_class_id",classes.map(c=>c.id))) : {data:[]};
  const updates: { id: string, final_rank: number | null; score: import("@/scoring").Score; tied: boolean }[] = [];

  // 4. Compute for each class
  for (const cls of classes) {
    const configCheck = scoreClass(cls.scoring_type, [], cls.scoring_config, cls.scoring_version);
    if (configCheck.details.error) return { error: String(configCheck.details.error) };
    const classEntries = entries?.filter(e => e.event_class_id === cls.id) || [];
    const classAttempts = attempts?.filter(a => a.event_class_id === cls.id) || [];
    const config = (cls.scoring_config as any) || {};

    const entriesWithScore = classEntries.map(entry => {
      const entryAttempts = classAttempts
        .filter(a => a.entry_id === entry.id)
        .map(a => ({
          id: a.id,
          entryId: a.entry_id,
          ordinal: a.ordinal,
          status: a.status as any,
          elapsedMs: a.elapsed_ms,
          distanceMm: a.distance_mm,
          penaltyMs: a.penalty_ms,
          rawInput: a.raw_input
        }));

      const score = scoreClass(cls.scoring_type, entryAttempts, config, cls.scoring_version,judgeInput(judgeScores.filter(s=>s.entry_id===entry.id)));

      return {
        entryId: entry.id,
        seed: entry.seed,
        orderNum: entry.order_num || 999,
        score
      };
    });

    if(cls.scoring_type==="judged_points" && entriesWithScore.some(e=>!e.score.eligible))return {error:"All required judge submissions must be complete before finalizing"};
    const invalid = entriesWithScore.find(e => e.score.details.error);
    if (invalid) return { error: String(invalid.score.details.error) };
    rankEntries(entriesWithScore).forEach(e => updates.push({ id: e.entryId, final_rank: e.rank, score:e.score, tied:e.tied }));
  }

  const { error } = await supabase.rpc("complete_race_event", {
    p_event_id: eventId, p_expected_revision: event.working_revision, p_ranks: updates as unknown as import("@/types/database").Json,
  });
  return error ? { error: error.message } : { success: true };
}
