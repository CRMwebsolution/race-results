import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Trophy, Calendar, Users, Target } from "lucide-react";

export default async function PublicSeriesPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;
  const supabase = await createClient();

  // Fetch Series Details
  const { data: series } = await supabase
    .from("series")
    .select("*")
    .eq("id", seriesId)
    .single();

  if (!series) notFound();
  const { data: promoterName } = await supabase.rpc("public_series_organization_name", { p_series_id: seriesId });

  // Fetch Events
  const { data: events } = await supabase
    .from("events")
    .select("*, tracks(name, slug)")
    .eq("series_id", seriesId)
    .order("local_date", { ascending: true });

  // Fetch Classes
  const { data: classes } = await supabase
    .from("series_classes")
    .select("*")
    .eq("series_id", seriesId)
    .order("order_num", { ascending: true });

  // Fetch Rosters
  const { data: roster } = await supabase
    .from("series_rosters")
    .select("*")
    .eq("series_id", seriesId);

  // Note: Full calculated standings across all events would require pulling all entries from all completed events 
  // and applying the series_points_rules and series_bonuses. For the initial phase, we display the master list
  // and schedule, letting users drill into individual completed events.

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top Banner */}
      <header className="bg-slate-900 border-b border-slate-800 py-12 px-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Trophy className="w-64 h-64" />
        </div>
        <div className="max-w-5xl mx-auto relative z-10 text-center">
          <div className="inline-block bg-slate-800 text-amber-500 font-bold text-xs px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
            Championship Series
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
            {series.name}
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            {series.description || "Official Series Leaderboard & Information"}
          </p>
          <div className="mt-6 flex items-center justify-center space-x-6 text-sm text-slate-500 font-medium">
            <span className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-slate-400" />
              <span>Promoted by {promoterName || "Series organizer"}</span>
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-12 space-y-12">
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center">
            <Calendar className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <div className="text-3xl font-black text-white">{events?.length || 0}</div>
            <div className="text-xs text-slate-500 uppercase font-bold mt-1">Tour Dates</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center">
            <Users className="w-6 h-6 text-purple-500 mx-auto mb-2" />
            <div className="text-3xl font-black text-white">{roster?.length || 0}</div>
            <div className="text-xs text-slate-500 uppercase font-bold mt-1">Registered Racers</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center">
            <Target className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
            <div className="text-3xl font-black text-white">{classes?.length || 0}</div>
            <div className="text-xs text-slate-500 uppercase font-bold mt-1">Master Classes</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center flex flex-col justify-center">
            <Trophy className="w-6 h-6 text-amber-500 mx-auto mb-2" />
            <div className="text-xs text-slate-300 font-bold mt-1">Championship</div>
            <div className="text-[10px] text-slate-500 uppercase mt-1">Points Active</div>
          </div>
        </div>

        {/* Schedule */}
        <section>
          <h2 className="text-2xl font-black text-white mb-6 flex items-center space-x-3">
            <Calendar className="w-6 h-6 text-blue-500" />
            <span>Tour Schedule</span>
          </h2>
          {events?.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500">
              No dates announced yet.
            </div>
          ) : (
            <div className="grid gap-4">
              {events?.map((ev, i) => (
                <div key={ev.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-slate-700 transition">
                  <div className="flex items-center space-x-6">
                    <div className="text-center w-16">
                      <div className="text-xs font-bold text-slate-500 uppercase mb-1">Round</div>
                      <div className="text-2xl font-black text-amber-500">{i + 1}</div>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition">{ev.name}</h3>
                      <div className="flex items-center space-x-3 mt-2 text-sm">
                        <span className="font-mono text-slate-300">{ev.local_date}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-400">{(ev.tracks as any).name}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    {ev.status === "completed" ? (
                      <Link 
                        href={`/r/${(ev.tracks as any).slug}/${ev.slug || ev.id}/standings`}
                        className="inline-block bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-6 rounded-xl transition border border-slate-700 w-full text-center"
                      >
                        View Results
                      </Link>
                    ) : (
                      <span className="inline-block bg-slate-950 text-slate-500 font-bold py-2 px-6 rounded-xl border border-slate-800 w-full text-center uppercase text-sm">
                        {ev.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Classes List */}
        <section>
          <h2 className="text-2xl font-black text-white mb-6 flex items-center space-x-3">
            <Target className="w-6 h-6 text-emerald-500" />
            <span>Master Classes & Rules</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {classes?.map(cls => (
              <div key={cls.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-slate-200">{cls.name}</h3>
                  {cls.entry_fee_text && (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                      {cls.entry_fee_text}
                    </span>
                  )}
                </div>
                {cls.rules_text && (
                  <div className="flex-1 bg-slate-950 rounded-xl p-4 border border-slate-800 text-sm text-slate-400">
                    {cls.rules_text}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
