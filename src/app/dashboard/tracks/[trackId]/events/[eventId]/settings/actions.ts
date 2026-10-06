"use server";

import { createClient } from "@/lib/supabase/server";
import { scoreFastestPass } from "@/scoring/fastest-pass";
import { scoreCombinedTime } from "@/scoring/combined-time";
import { scoreConsistency } from "@/scoring/consistency";
import { scoreJudgedPoints } from "@/scoring/judged-points";
import { scoreStoppedDistance } from "@/scoring/stopped-distance";
import { compareRankedEntries, Score } from "@/scoring/types";

export async function finalizeEventStandings(eventId: string) {
  const supabase = await createClient();

  // 1. Fetch all classes
  const { data: classes } = await supabase
    .from("event_classes")
    .select("*")
    .eq("event_id", eventId);

  if (!classes || classes.length === 0) return { success: true };

  // 2. Fetch all entries
  const { data: entries } = await supabase
    .from("entries")
    .select("*")
    .in("event_class_id", classes.map(c => c.id));

  // 3. Fetch all attempts
  const { data: attempts } = await supabase
    .from("attempts")
    .select("*")
    .in("event_class_id", classes.map(c => c.id));

  const updates: { id: string, final_rank: number | null }[] = [];

  // 4. Compute for each class
  for (const cls of classes) {
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

      let score: Score;
      const scoringTypeStr = cls.scoring_type as string;
      if (scoringTypeStr === "consistency") {
        const cnf = Object.keys(config).length > 0 ? config : { requiredOrdinals: [1, 2], decimals: 3 };
        score = scoreConsistency(entryAttempts, cnf);
      } else if (scoringTypeStr === "combined_time") {
        const cnf = Object.keys(config).length > 0 ? config : { requiredPasses: 2 };
        score = scoreCombinedTime(entryAttempts as any, cnf);
      } else if (scoringTypeStr === "judged_points") {
        score = scoreJudgedPoints(entryAttempts as any);
      } else if (scoringTypeStr === "stopped_distance") {
        score = scoreStoppedDistance(entryAttempts as any);
      } else {
        score = scoreFastestPass(entryAttempts);
      }

      return {
        entryId: entry.id,
        seed: entry.seed,
        orderNum: entry.order_num || 999,
        score
      };
    });

    const sorted = [...entriesWithScore].sort(compareRankedEntries);
    
    // Assign ranks (1-indexed based on array position, ties aren't explicitly mapped differently here since points allocation usually requires strict tiebreakers anyway)
    sorted.forEach((e, idx) => {
       if (e.score.eligible) {
          updates.push({ id: e.entryId, final_rank: idx + 1 });
       }
    });
  }

  // 5. Save all final_ranks back to DB
  for (const update of updates) {
    await supabase.from("entries").update({ final_rank: update.final_rank }).eq("id", update.id);
  }

  return { success: true };
}
