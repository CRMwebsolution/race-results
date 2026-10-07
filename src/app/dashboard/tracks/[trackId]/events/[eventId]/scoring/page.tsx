import {ActionFeedback} from '@/components/action-feedback';
import {raceContext} from "@/lib/race-context";
import {judgeInput} from "@/scoring/multi-judge";
import {officialResult} from "@/lib/official-results";
import {LiveLeaderboard} from "@/app/r/[slug]/[eventSlug]/live-leaderboard";
import { readAll } from "@/lib/read-all";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ScoringWorkspace } from "./scoring-workspace";

export default async function EventScoringPage({
  params,searchParams,
}: {
  searchParams:Promise<{message?:string}>;
  params: Promise<{ trackId?: string; seriesId?: string; eventId: string }>;
}) {
  const {ownerId:trackId,ownerType,ownerColumn,ownerPath,eventId}=raceContext(await params);
  const {message}=await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: canEdit } = await supabase.rpc("can_edit_race",{p_event_id:eventId});
  if (!canEdit) redirect(`${ownerPath}/events/${eventId}/judging`);

  // Fetch event and track details
  const { data: event } = await supabase
    .from("events")
    .select("id, name, working_revision, status, slug, tracks(slug)")
    .eq("id", eventId)
    .eq(ownerColumn, trackId)
    .single();

  if (!event) redirect("/dashboard");

  const trackSlug = (event.tracks as any)?.slug;
  const eventSlug = event.slug;


  if(event.status==="completed") {const snapshot=await officialResult(supabase,event.id);if(!snapshot)throw new Error("Official snapshot unavailable");const p=snapshot.payload as any;return <div className="p-4 w-full"><ActionFeedback message={message}/><p>Official results · Version {snapshot.version}</p><LiveLeaderboard event={{...p.event,status:"completed"}} classes={p.classes} initialEntries={p.entries} initialAttempts={p.attempts} officialResults={p.results} officialVersion={snapshot.version} judgeScores={judgeInput(p.judge_scores||[])}/></div>;}
  // Fetch all classes
  const { data: classes } = await readAll(supabase
    .from("event_classes")
    .select("id, name, scoring_type, scoring_version, scoring_config, order_num")
    .eq("event_id", eventId)
    .order("order_num", { ascending: true }));

  if (!classes || classes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12 px-4">
        <h2 className="text-xl font-bold text-white">No classes found</h2>
        <p className="text-slate-400 mt-2">Please create at least one class before scoring.</p>
      </div>
    );
  }

  // Independent lists can load together once the class IDs are known.
  const classIds=classes.map(c=>c.id);
  const [{data:entries},{data:attempts},{data:judges}]=await Promise.all([
    readAll(supabase.from("entries")
      .select("id, event_class_id, display_name, seed, status, order_num")
      .in("event_class_id",classIds).order("order_num",{ascending:true})),
    readAll(supabase.from("attempts")
      .select("id, event_class_id, entry_id, ordinal, status, elapsed_ms, distance_mm, penalty_ms, raw_input, save_version")
      .in("event_class_id",classIds).order("ordinal",{ascending:true})),
    readAll(supabase.from("judge_scores").select("*").in("event_class_id",classIds)),
  ]);
  const {data:canComplete}=await supabase.rpc("can_publish_race",{p_event_id:eventId});
  return (
    <ScoringWorkspace
      key={event.id}
      accountId={user.id}
      canComplete={Boolean(canComplete)}
      trackId={trackId}
      trackSlug={trackSlug}
      ownerType={ownerType}
      eventSlug={eventSlug}
      event={event}
      classes={classes}
      initialEntries={entries || []}
      initialAttempts={attempts || []}
      judgeScores={judgeInput(judges)}
    />
  );
}
