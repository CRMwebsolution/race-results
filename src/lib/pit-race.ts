import type {ComponentProps} from "react";
import type {PitDisplay} from "@/components/pit-display";
import type {createClient} from "@/lib/supabase/server";
import type {Database} from "@/types/database";
import {readAll} from "@/lib/read-all";
import {officialResult, type OfficialRow} from "@/lib/official-results";
import {judgeInput} from "@/scoring/multi-judge";
import {latestScoringClass} from "@/lib/pit-activity";

type Props=ComponentProps<typeof PitDisplay>;
type JudgeRow=Database["public"]["Tables"]["judge_scores"]["Row"];
type Payload={event:Props["event"];classes:Props["classes"];entries:Props["initialEntries"];attempts:(Props["initialAttempts"][number]&{updated_at?:string|null})[];results:OfficialRow[];judge_scores?:JudgeRow[]};
export async function pitRace(db:Awaited<ReturnType<typeof createClient>>, event:Props["event"]):Promise<Props> {
 if(event.status==="completed") {
  const snapshot=await officialResult(db,event.id);
  if(!snapshot) throw new Error("Official results are unavailable. Please refresh or contact the organizer.");
  const p=snapshot.payload as unknown as Payload;
  return {event:{...p.event,status:"completed"},classes:p.classes,initialEntries:p.entries,initialAttempts:p.attempts,
   judgeScores:judgeInput(p.judge_scores || []),officialResults:p.results,officialVersion:snapshot.version,
   latestClassId:latestScoringClass(p.classes,p.attempts,p.judge_scores || [])};
 }
 const {data:classes,error}=await readAll(db.from("event_classes").select("id,name,scoring_type,scoring_version,scoring_config,order_num").eq("event_id",event.id).order("order_num"));
 if(error) throw new Error("Could not load race classes: "+error.message);
 const ids=(classes || []).map(c=>c.id);
 if(!ids.length) return {event,classes:[],initialEntries:[],initialAttempts:[],latestClassId:""};
 const [entries,attempts,judges]=await Promise.all([
  readAll(db.from("entries").select("id,event_class_id,display_name,seed,order_num").in("event_class_id",ids).order("order_num")),
  readAll(db.from("attempts").select("id,event_class_id,entry_id,ordinal,status,elapsed_ms,distance_mm,penalty_ms,raw_input,updated_at").in("event_class_id",ids).order("ordinal")),
  readAll(db.from("judge_scores").select("*").in("event_class_id",ids)),
 ]);
 for(const result of [entries,attempts,judges]) if(result.error) throw new Error("Could not load race scores: "+result.error.message);
 return {event,classes:classes || [],initialEntries:entries.data || [],initialAttempts:attempts.data || [],
  judgeScores:judgeInput(judges.data),latestClassId:latestScoringClass(classes || [],attempts.data || [],judges.data || [])};
}
