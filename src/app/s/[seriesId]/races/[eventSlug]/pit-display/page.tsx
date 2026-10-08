import { readAll } from "@/lib/read-all";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PitDisplay } from "@/components/pit-display";
import { judgeInput } from "@/scoring/multi-judge";

export default async function SeriesPitDisplayPage({
  params,
}: {
  params: Promise<{ seriesId: string; eventSlug: string }>;
}) {
  const { seriesId, eventSlug } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("*").eq("series_id", seriesId).eq("slug", eventSlug).single();
  if (!event) notFound();

  const { data: classes } = await readAll(supabase
    .from("event_classes")
    .select("id, name, scoring_type, scoring_version, scoring_config, order_num")
    .eq("event_id", event.id)
    .order("order_num", { ascending: true }));

  if (!classes || classes.length === 0) {
    return <div className="py-20 text-center text-slate-500 bg-black min-h-screen text-4xl">No classes found.</div>;
  }

  const classIds = classes.map(c => c.id);
  const [{ data: entries }, { data: attempts }, { data: judges }] = await Promise.all([
    readAll(supabase.from("entries").select("id, event_class_id, display_name, seed, order_num").in("event_class_id", classIds).order("order_num", { ascending: true })),
    readAll(supabase.from("attempts").select("id, event_class_id, entry_id, ordinal, status, elapsed_ms, distance_mm, penalty_ms, raw_input").in("event_class_id", classIds).order("ordinal", { ascending: true })),
    readAll(supabase.from("judge_scores").select("*").in("event_class_id", classIds)),
  ]);

  return (
    <PitDisplay
      event={event}
      classes={classes}
      initialEntries={entries || []}
      initialAttempts={attempts || []}
      judgeScores={judgeInput(judges)}
    />
  );
}
