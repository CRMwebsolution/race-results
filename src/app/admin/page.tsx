import { createClient } from "@/lib/supabase/server";

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const { count: orgCount } = await supabase.from("organizations").select("*", { count: "exact", head: true });
  const { count: trackCount } = await supabase.from("tracks").select("*", { count: "exact", head: true });
  const { count: eventCount } = await supabase.from("events").select("*", { count: "exact", head: true });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white">Platform Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-medium text-slate-400">Total Organizations</h3>
          <p className="text-3xl font-bold text-white mt-2">{orgCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-medium text-slate-400">Total Tracks</h3>
          <p className="text-3xl font-bold text-white mt-2">{trackCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-medium text-slate-400">Total Events</h3>
          <p className="text-3xl font-bold text-white mt-2">{eventCount}</p>
        </div>
      </div>
    </div>
  );
}
