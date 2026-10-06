import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Calendar, ChevronRight, Trophy } from "lucide-react";

export default async function PublicTrackPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: track } = await supabase
    .from("tracks")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!track) notFound();

  // Fetch published events
  const { data: events } = await supabase
    .from("events")
    .select("id, name, slug, local_date, status")
    .eq("track_id", track.id)
    .in("status", ["scheduled", "live", "completed"])
    .order("local_date", { ascending: false });

  if (!events || events.length === 0) {
    return (
      <div className="py-20 text-center">
        <Trophy className="w-12 h-12 text-slate-800 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-300">No events found</h2>
        <p className="text-slate-500 mt-2">
          There are currently no published events for this venue.
        </p>
      </div>
    );
  }

  const upcomingEvents = events.filter(e => e.status === "scheduled").reverse(); // Ascending for upcoming
  const pastEvents = events.filter(e => e.status !== "scheduled");

  return (
    <div className="space-y-12">
      {upcomingEvents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Upcoming Schedule</h2>
          <div className="grid gap-3">
            {upcomingEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="font-bold text-white text-lg">
                      {event.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                      Scheduled
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{event.local_date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pastEvents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Recent & Live Events</h2>
          <div className="grid gap-3">
            {pastEvents.map((event) => (
              <Link
                key={event.id}
                href={`/r/${slug}/${event.slug}`}
                className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/50 transition group"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="font-bold text-white text-lg group-hover:text-amber-400 transition">
                      {event.name}
                    </h3>
                    {event.status === "live" && (
                      <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400 uppercase tracking-widest animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        <span>Live</span>
                      </span>
                    )}
                    {event.status === "completed" && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Final Results
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{event.local_date}</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-amber-500 transition" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
