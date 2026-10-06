import {judgeInput} from "@/scoring/multi-judge";
import {officialResult} from "@/lib/official-results";
import {LiveLeaderboard} from "@/app/r/[slug]/[eventSlug]/live-leaderboard";
import { readAll } from "@/lib/read-all";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ScoringWorkspace } from "./scoring-workspace";

export default async function EventScoringPage({
  params,
}: {
  params: Promise<{ trackId: string; eventId: string }>;
}) {
  const { trackId, eventId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: canEdit } = await supabase.rpc("can_edit_track",{p_track_id:trackId});
  if (!canEdit) redirect(`/dashboard/tracks/${trackId}/events/${eventId}`);

  // Fetch event and track details
  const { data: event } = await supabase
    .from("events")
    .select("id, name, working_revision, status, slug, tracks(slug)")
    .eq("id", eventId)
    .eq("track_id", trackId)
    .single();

  if (!event) redirect("/dashboard");

  const trackSlug = (event.tracks as any)?.slug;
  const eventSlug = event.slug;


  if(event.status==="completed") {const snapshot=await officialResult(supabase,event.id);if(!snapshot)throw new Error("Official snapshot unavailable");const p=snapshot.payload as any;return <div className="p-4 w-full"><p>Official results · Version {snapshot.version}</p><LiveLeaderboard event={{...p.event,status:"completed"}} classes={p.classes} initialEntries={p.entries} initialAttempts={p.attempts} officialResults={p.results}/></div>;}
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

  // Fetch all entries for these classes
  const { data: entries } = await readAll(supabase
    .from("entries")
    .select("id, event_class_id, display_name, seed, status, order_num")
    .in("event_class_id", classes.map(c => c.id))
    .order("order_num", { ascending: true }));

  // Fetch all attempts for these entries
  const { data: attempts } = await readAll(supabase
    .from("attempts")
    .select("id, event_class_id, entry_id, ordinal, status, elapsed_ms, distance_mm, penalty_ms, raw_input, save_version")
    .in("event_class_id", classes.map(c => c.id))
    .order("ordinal", { ascending: true }));

  const {data:judges}=await readAll(supabase.from("judge_scores").select("*").in("event_class_id",classes.map(c=>c.id)));
  return (
    <ScoringWorkspace
      key={event.id}
      trackId={trackId}
      trackSlug={trackSlug}
      eventSlug={eventSlug}
      event={event}
      classes={classes}
      initialEntries={entries || []}
      initialAttempts={attempts || []}
      judgeScores={judgeInput(judges)}
    />
  );
}
