import { readAll } from "@/lib/read-all";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Flag, CalendarDays, Plus, Calendar, ExternalLink } from "lucide-react";

export default async function TrackDashboardPage({ params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params;
  const supabase = await createClient();

  // Validate session and permissions
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: track } = await supabase
    .from("tracks")
    .select("id, name, slug, shorthand, timezone")
    .eq("id", trackId)
    .single();

  if (!track) redirect("/dashboard");

  // Fetch events
  const { data: events } = await readAll(supabase
    .from("events")
    .select("id, name, slug, local_date, status, published_revision")
    .eq("track_id", trackId)
    .order("local_date", { ascending: false }));

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/dashboard" className="text-slate-400 hover:text-white transition font-medium text-sm">
              Dashboard
            </Link>
            <span className="text-slate-600">/</span>
            <span className="font-extrabold text-sm tracking-tight text-white flex items-center space-x-2">
              <Flag className="w-3.5 h-3.5 text-amber-500" />
              <span>{track.name}</span>
            </span>
          </div>
          <Link
            href={`/r/${track.slug}`}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center space-x-1.5 border border-slate-700"
          >
            <span>Public Page</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Events & Meets</h1>
            <p className="text-slate-400 text-sm mt-1">Manage single-day events and races for this venue.</p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              href={`/dashboard/tracks/${track.id}/settings`}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold py-2 px-4 rounded-xl flex items-center space-x-2 transition"
            >
              <span>Track Settings</span>
            </Link>
            <Link
              href={`/dashboard/tracks/${track.id}/seasons`}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold py-2 px-4 rounded-xl flex items-center space-x-2 transition"
            >
              <span>Manage Seasons</span>
            </Link>
            <Link
              href={`/dashboard/tracks/${track.id}/events/new`}
              className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold py-2 px-4 rounded-xl flex items-center space-x-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Event</span>
            </Link>
          </div>
        </div>

        {!events || events.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
            <CalendarDays className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-base font-semibold text-white">No events scheduled</h3>
            <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">
              Create your first event to set up classes, enroll competitors, and start scoring passes.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {events.map((event) => (
              <Link
                href={`/dashboard/tracks/${track.id}/events/${event.id}`}
                key={event.id}
                className="bg-slate-900/60 border border-slate-800 hover:border-amber-500/50 p-5 rounded-2xl transition flex items-center justify-between group"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-3">
                    <h2 className="text-lg font-bold text-white group-hover:text-amber-400 transition">
                      {event.name}
                    </h2>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        event.status === "live"
                          ? "bg-red-500/10 text-red-400 border-red-500/20"
                          : event.status === "completed"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {event.status}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-slate-400">
                    <span className="flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{event.local_date}</span>
                    </span>
                    <span className="text-slate-600">&bull;</span>
                    <span className="font-mono text-xs text-slate-500">/r/{track.slug}/{event.slug}</span>
                  </div>
                </div>
                <div className="text-slate-500 group-hover:text-amber-500 transition">
                  &rarr;
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
