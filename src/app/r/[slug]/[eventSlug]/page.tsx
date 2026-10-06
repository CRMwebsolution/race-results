import {officialResult,OfficialRow} from "@/lib/official-results";
import Link from "next/link";
import { readAll } from "@/lib/read-all";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { LiveLeaderboard } from "./live-leaderboard";

export default async function PublicEventPage({
  params,searchParams,
}: {
  searchParams:Promise<{version?:string}>;
  params: Promise<{ slug: string; eventSlug: string }>;
}) {
  const { slug, eventSlug } = await params;
  const supabase = await createClient();

  const { data: track } = await supabase
    .from("tracks")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!track) notFound();

  // Fetch event
  const { data: event } = await supabase
    .from("events")
    .select("id, name, status, published_revision")
    .eq("track_id", track.id)
    .eq("slug", eventSlug)
    .single();

  if (!event) notFound();


  const requested=Number((await searchParams).version)||undefined;
  if(event.status==="completed"||requested){
   const snapshot=await officialResult(supabase,event.id,requested);
   if(!snapshot)throw new Error("Official results version is unavailable");
   const payload=snapshot.payload as any;
   return <div className="space-y-4"><p>Official results · Version {snapshot.version}{snapshot.reconstructed ? " · Reconstructed historical ranks" : ` · ${snapshot.finalized_at}`}</p><nav className="flex flex-wrap gap-3">{Array.from({length:snapshot.version},(_,i)=><Link key={i} href={`?version=${i+1}`}>Version {i+1}</Link>)}<Link href={`/r/${slug}/${eventSlug}`}>Current results</Link></nav><LiveLeaderboard event={{...payload.event,status:"completed"}} classes={payload.classes} initialEntries={payload.entries} initialAttempts={payload.attempts} officialResults={payload.results as OfficialRow[]}/></div>;
  }
  // Fetch all classes
  const { data: classes } = await readAll(supabase
    .from("event_classes")
    .select("id, name, scoring_type, scoring_version, scoring_config, order_num")
    .eq("event_id", event.id)
    .order("order_num", { ascending: true }));

  if (!classes || classes.length === 0) {
    return (
      <div className="py-20 text-center text-slate-500">
        No results available yet.
      </div>
    );
  }

  // Fetch all entries for these classes
  const { data: entries } = await readAll(supabase
    .from("entries")
    .select("id, event_class_id, display_name, seed, order_num")
    .in("event_class_id", classes.map(c => c.id))
    .order("order_num", { ascending: true }));

  // Fetch all attempts for these entries
  const { data: attempts } = await readAll(supabase
    .from("attempts")
    .select("id, event_class_id, entry_id, ordinal, status, elapsed_ms, distance_mm, penalty_ms, raw_input")
    .in("event_class_id", classes.map(c => c.id))
    .order("ordinal", { ascending: true }));

  return (
    <LiveLeaderboard
      key={event.id}
      event={event}
      classes={classes}
      initialEntries={entries || []}
      initialAttempts={attempts || []}
    />
  );
}
