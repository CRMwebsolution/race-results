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

  // Fetch event and track details
  const { data: event } = await supabase
    .from("events")
    .select("id, name, working_revision, slug, tracks(slug)")
    .eq("id", eventId)
    .single();

  if (!event) redirect("/dashboard");

  const trackSlug = (event.tracks as any)?.slug;
  const eventSlug = event.slug;

  // Fetch all classes
  const { data: classes } = await supabase
    .from("event_classes")
    .select("id, name, scoring_type, scoring_version, scoring_config, order_num")
    .eq("event_id", eventId)
    .order("order_num", { ascending: true });

  if (!classes || classes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12 px-4">
        <h2 className="text-xl font-bold text-white">No classes found</h2>
        <p className="text-slate-400 mt-2">Please create at least one class before scoring.</p>
      </div>
    );
  }

  // Fetch all entries for these classes
  const { data: entries } = await supabase
    .from("entries")
    .select("id, event_class_id, display_name, seed, status, order_num")
    .in("event_class_id", classes.map(c => c.id))
    .order("order_num", { ascending: true });

  // Fetch all attempts for these entries
  const { data: attempts } = await supabase
    .from("attempts")
    .select("id, event_class_id, entry_id, ordinal, status, elapsed_ms, distance_mm, penalty_ms, raw_input")
    .in("event_class_id", classes.map(c => c.id))
    .order("ordinal", { ascending: true });

  return (
    <ScoringWorkspace
      trackId={trackId}
      trackSlug={trackSlug}
      eventSlug={eventSlug}
      event={event}
      classes={classes}
      initialEntries={entries || []}
      initialAttempts={attempts || []}
    />
  );
}
