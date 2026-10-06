import { readAll } from "@/lib/read-all";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Calendar, Plus } from "lucide-react";

export default async function SeasonsPage({ params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params;
  const supabase = await createClient();

  const { data: seasons } = await readAll(supabase
    .from("seasons")
    .select("*, season_events(count)")
    .eq("track_id", trackId)
    .order("created_at", { ascending: false }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Championship Seasons</h1>
        <Link 
          href={`/dashboard/tracks/${trackId}/seasons/new`}
          className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-4 py-2 rounded-lg flex items-center space-x-2 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Season</span>
        </Link>
      </div>

      {seasons?.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-xl bg-slate-900 border border-dashed border-slate-800">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-300">No seasons yet</h3>
          <p className="text-xs text-slate-500 mt-1">Group events together to track points over time.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {seasons?.map((s) => (
            <div key={s.id} className="bg-slate-900 border border-slate-800 p-5 rounded-xl hover:border-slate-700 transition">
              <h3 className="text-lg font-bold text-white mb-2">{s.name}</h3>
              <p className="text-sm text-slate-400 mb-4">{s.season_events[0]?.count || 0} Events Linked</p>
              <Link
                href={`/dashboard/tracks/${trackId}/seasons/${s.id}`}
                className="text-sm font-bold text-amber-500 hover:text-amber-400 transition"
              >
                Manage Season &rarr;
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
