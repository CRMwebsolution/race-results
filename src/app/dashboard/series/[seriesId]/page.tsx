import { readAll } from "@/lib/read-all";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, Calendar, Settings, Trophy, Users } from "lucide-react";
import { notFound } from "next/navigation";

export default async function SeriesHubPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;
  const supabase = await createClient();

  const { data: series } = await supabase
    .from("series")
    .select("*")
    .eq("id", seriesId)
    .single();

  if (!series) notFound();

  const { data: classes } = await readAll(supabase
    .from("series_classes")
    .select("*")
    .eq("series_id", seriesId)
    .order("order_num", { ascending: true }));

  const { data: events } = await readAll(supabase
    .from("events")
    .select("*")
    .eq("series_id", seriesId)
    .order("local_date", { ascending: true }));

  const { data: pointsRules } = await readAll(supabase
    .from("series_points_rules")
    .select("*")
    .eq("series_id", seriesId)
    .order("rank_start", { ascending: true }));

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center space-x-3">
          <Link 
            href={`/dashboard`}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{series.name}</h1>
            <p className="text-sm text-slate-400">Series Management Hub</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Link 
            href={`/dashboard/series/${seriesId}/settings`}
            className="inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition border border-slate-700"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </Link>
          <Link 
            href={`/s/${seriesId}`}
            target="_blank"
            className="inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition border border-slate-700"
          >
            <span>Public Page</span>
          </Link>
        </div>
      </div>

      <Link href={`/dashboard/series/${seriesId}/seasons`} className="inline-block p-4 bg-amber-500 text-slate-950 rounded font-bold">Championship standings & awards</Link>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Master Classes */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg text-white flex items-center space-x-2">
              <Settings className="w-5 h-5 text-amber-500" />
              <span>Master Classes</span>
            </h2>
            <Link 
              href={`/dashboard/series/${seriesId}/classes`}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded border border-slate-700 transition"
            >
              Manage Classes
            </Link>
          </div>
          {classes?.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No master classes defined.</p>
          ) : (
            <ul className="space-y-2">
              {classes?.map(cls => (
                <li key={cls.id} className="flex justify-between items-center text-sm bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="font-bold text-slate-200">{cls.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Schedule & Venues */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg text-white flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              <span>Schedule & Venues</span>
            </h2>
            <Link 
              href={`/dashboard/series/${seriesId}/schedule`}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded border border-slate-700 transition"
            >
              Manage Schedule
            </Link>
          </div>
          {events?.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No events scheduled.</p>
          ) : (
            <ul className="space-y-2">
              {events?.map(ev => (
                <li key={ev.id} className="flex justify-between items-center text-sm bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <Link href={`/dashboard/series/${seriesId}/events/${ev.id}`} className="font-bold text-amber-400">{ev.name}</Link>
                    <div className="text-xs text-slate-500">{ev.venue_description} • {ev.local_date}</div>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded">{ev.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Points & Rules */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg text-white flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-emerald-500" />
              <span>Default Points System</span>
            </h2>
            <Link 
              href={`/dashboard/series/${seriesId}/points`}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded border border-slate-700 transition"
            >
              Edit Rules
            </Link>
          </div>
          {pointsRules?.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No point allocations defined.</p>
          ) : (
            <ul className="space-y-2">
              {pointsRules?.map(pr => (
                <li key={pr.id} className="flex justify-between items-center text-sm bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400">
                    {pr.rank_start === pr.rank_end 
                      ? `Rank ${pr.rank_start}` 
                      : pr.rank_end >= 999 
                        ? `Rank ${pr.rank_start} & below` 
                        : `Ranks ${pr.rank_start} - ${pr.rank_end}`}
                  </span>
                  <span className="font-bold text-emerald-400">+{pr.points} pts</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Master Roster */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-full flex items-center justify-center text-purple-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-white">Season Registrations</h2>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">Register each vehicle and class for a season. Import eligible members into each race, and add one-race entrants separately.</p>
          </div>
          <Link 
            href={`/dashboard/series/${seriesId}/seasons`}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 rounded-xl transition border border-slate-700"
          >
            Manage Seasons
          </Link>
        </div>

      </div>
    </div>
  );
}
