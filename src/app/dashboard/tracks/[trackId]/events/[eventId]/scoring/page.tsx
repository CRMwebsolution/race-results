import {ActionFeedback} from '@/components/action-feedback';
import {raceContext} from "@/lib/race-context";
import {judgeInput} from "@/scoring/multi-judge";
import {officialResult} from "@/lib/official-results";
import {LiveLeaderboard} from "@/app/r/[slug]/[eventSlug]/live-leaderboard";
import { readAll } from "@/lib/read-all";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ScoringWorkspace } from "./scoring-workspace";
import Link from "next/link";

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

  if (event.status === "scheduled" || event.status === "draft") {
    async function goLive(f: FormData) {
      "use server";
      const db = await createClient();
      const { error } = await db.rpc("set_race_event_status", {
        p_event_id: eventId,
        p_status: "live",
        p_expected_revision: event!.working_revision
      });
      if (error) {
        if (error.message.includes("credit") || error.message.includes("quota")) {
          await fetch("https://n8n.southernautomate.com/webhook/a8aecd54-4eb6-4243-9c19-daf7c939c69c", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "quota_denied",
              action: "go_live",
              table: "events",
              timestamp: new Date().toISOString(),
              record: {
                event_id: eventId,
                event_name: event!.name,
                owner_id: trackId,
                user_id: user?.id
              }
            })
          }).catch(console.error);
        }
        redirect(ownerPath + "/events/" + eventId + "/scoring?message=" + encodeURIComponent(error.message));
      }
      import("next/cache").then(m => m.revalidatePath("/dashboard", "layout"));
      redirect(ownerPath + "/events/" + eventId + "/scoring");
    }
    
    return (
      <div className="max-w-xl mx-auto mt-12 p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-6">
        <div className="w-16 h-16 bg-amber-500/20 text-amber-500 flex items-center justify-center rounded-2xl mx-auto">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Ready to Race?</h2>
          <p className="text-slate-400">Going live will open the Scoring Workspace and broadcast results to the public spectator view.</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-4 rounded-xl text-sm font-semibold">
          This action consumes 1 Event Credit. The scoring workspace will remain editable for 72 hours.
        </div>
        <form action={goLive}>
          <button className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition">
            Go Live & Launch Scoring
          </button>
        </form>
        {message && (
          <div className="text-rose-400 text-sm mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            {message}
            {(message.includes("credit") || message.includes("Pass")) && (
              <div className="mt-3">
                <Link href="/dashboard/billing" className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg inline-block font-semibold transition">
                  Manage Billing & Credits
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

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





