import {publicRaceChampionship} from "@/championship/public-race";
import {PublicCompetition} from "@/components/public-competition";
import {judgeInput} from "@/scoring/multi-judge";
import {officialResult,OfficialRow} from "@/lib/official-results";
import Link from "next/link";
import { readAll } from "@/lib/read-all";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { LiveLeaderboard } from "./live-leaderboard";
import {spectatorPointsMode} from '@/lib/spectator-points';

export default async function PublicEventPage({
  params,searchParams,
}: {
  searchParams:Promise<{version?:string}>;
  params: Promise<{ slug?: string; seriesId?: string; eventSlug: string }>;
}) {
  const { slug, seriesId, eventSlug } = await params;
  const supabase = await createClient();

  const {data:track}=slug?await supabase.from("tracks").select("id").eq("slug",slug).single():{data:null};
  if(!seriesId&&!track)notFound();
  const {data:event}=await supabase.from("events").select("*").eq(seriesId?'series_id':'track_id',seriesId||track!.id).eq('slug',eventSlug).single();if(!event)notFound();
  const mode=await spectatorPointsMode(supabase,{seriesId:event.series_id||undefined,trackId:event.track_id||undefined});
  const currentPath=seriesId?`/s/${seriesId}/races/${eventSlug}`:`/r/${slug}/${eventSlug}`;
  const championship=<PublicCompetition trackId={event.track_id||undefined} seriesId={event.series_id||undefined} selected={event.competition_season_id||undefined}/>;



  const requested=Number((await searchParams).version)||undefined;
  if(event.status==="completed"||requested){
   const snapshot=await officialResult(supabase,event.id,requested);
   if(!snapshot)throw new Error("Official results version is unavailable");
   const payload=snapshot.payload as any;
   const points=await publicRaceChampionship(supabase,payload.event,payload.entries,payload.classes,payload.registrations);
   return <div className="space-y-4"><p>Official results · Version {snapshot.version}{snapshot.reconstructed ? " · Reconstructed historical ranks" : ` · ${snapshot.finalized_at}`}</p><nav className="flex flex-wrap gap-3">{Array.from({length:snapshot.version},(_,i)=><Link key={i} href={`?version=${i+1}`}>Version {i+1}</Link>)}<Link href={currentPath}>Current results</Link></nav><LiveLeaderboard event={{...payload.event,status:"completed",spectator_points_mode:mode}} classes={payload.classes} initialEntries={payload.entries} initialAttempts={payload.attempts} officialResults={payload.results as OfficialRow[]} officialVersion={snapshot.version} judgeScores={judgeInput(payload.judge_scores||[])} championship={points}/>{event.competition_season_id&&championship}</div>;
  }
  // Fetch all classes
  const { data: classes } = await readAll(supabase
    .from("event_classes")
    .select("id, name, scoring_type, scoring_version, scoring_config, order_num, competition_class_id")
    .eq("event_id", event.id)
    .order("order_num", { ascending: true }));

  if (!classes || classes.length === 0) {
    return (
      <div className="py-20 text-center text-slate-500">
        No results available yet.
      </div>
    );
  }

  const classIds=classes.map(c=>c.id);
  const [{data:entries},{data:attempts},{data:judges}]=await Promise.all([
    readAll(supabase.from("entries").select("id, event_class_id, display_name, seed, order_num, registration_id").in("event_class_id",classIds).order("order_num",{ascending:true})),
    readAll(supabase.from("attempts").select("id, event_class_id, entry_id, ordinal, status, elapsed_ms, distance_mm, penalty_ms, raw_input").in("event_class_id",classIds).order("ordinal",{ascending:true})),
    readAll(supabase.from("judge_scores").select("*").in("event_class_id",classIds)),
  ]);
  const points=await publicRaceChampionship(supabase,event,entries,classes);
  return (
    <div className="space-y-6"><LiveLeaderboard
      key={event.id}
      event={{...event,spectator_points_mode:mode}}
      classes={classes}
      initialEntries={entries || []}
      initialAttempts={attempts || []}
      judgeScores={judgeInput(judges)}
      championship={points}
    />{event.competition_season_id&&championship}</div>
  );
}
