import { readAll } from "@/lib/read-all";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Trophy, ArrowLeft } from "lucide-react";

export default async function PublicSeasonStandings({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: track } = await supabase.from("tracks").select("id, name").eq("slug", slug).single();
  if (!track) notFound();

  const { data: seasons } = await readAll(supabase
    .from("seasons")
    .select("*, season_events(count)")
    .eq("track_id", track.id)
    .order("created_at", { ascending: false }));

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-8">
      <Link href={`/r/${slug}`} className="text-amber-500 hover:text-amber-400 flex items-center space-x-2 text-sm font-bold w-fit">
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Track</span>
      </Link>
      
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
          <Trophy className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Championship Standings</h1>
        <p className="text-slate-400 max-w-lg mx-auto">{track.name} Season Points & Leaderboards</p>
      </div>

      {seasons?.length === 0 ? (
        <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl">
          <p className="text-slate-400">No active championship seasons found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {seasons?.map((season) => (
            <div key={season.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">{season.name}</h2>
                <p className="text-slate-400 text-sm mt-1">{season.season_events[0]?.count || 0} Events Logged</p>
              </div>
              <button disabled className="bg-slate-800 text-slate-400 font-bold px-4 py-2 rounded-xl border border-slate-700 cursor-not-allowed">
                View Points (Coming Soon)
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
