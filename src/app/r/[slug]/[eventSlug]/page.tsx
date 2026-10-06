import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { LiveLeaderboard } from "./live-leaderboard";

export default async function PublicEventPage({
  params,
}: {
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

  // Fetch all classes
  const { data: classes } = await supabase
    .from("event_classes")
    .select("id, name, scoring_type, scoring_config, order_num")
    .eq("event_id", event.id)
    .order("order_num", { ascending: true });

  if (!classes || classes.length === 0) {
    return (
      <div className="py-20 text-center text-slate-500">
        No results available yet.
      </div>
    );
  }

  // Fetch all entries for these classes
  const { data: entries } = await supabase
    .from("entries")
    .select("id, event_class_id, display_name, seed, order_num")
    .in("event_class_id", classes.map(c => c.id))
    .order("order_num", { ascending: true });

  // Fetch all attempts for these entries
  const { data: attempts } = await supabase
    .from("attempts")
    .select("id, event_class_id, entry_id, ordinal, status, elapsed_ms, distance_mm, penalty_ms, raw_input")
    .in("event_class_id", classes.map(c => c.id))
    .order("ordinal", { ascending: true });

  return (
    <LiveLeaderboard
      event={event}
      classes={classes}
      initialEntries={entries || []}
      initialAttempts={attempts || []}
    />
  );
}
