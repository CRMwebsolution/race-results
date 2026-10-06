import { EventClassList } from "@/components/event-class-list";
import { readAll } from "@/lib/read-all";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Users, Timer, Settings, Trophy } from "lucide-react";
import { redirect } from "next/navigation";

export default async function EventOverviewPage({
  params,
}: {
  params: Promise<{ trackId: string; eventId: string }>;
}) {
  const { trackId, eventId } = await params;
  const supabase = await createClient();

  const { data: classes } = await readAll(supabase
    .from("event_classes")
    .select("id, name, scoring_type, order_num")
    .eq("event_id", eventId)
    .order("order_num", { ascending: true }));

  const { count: entriesCount, error: countError } = await supabase
    .from("entries")
    .select("id", { count: "exact", head: true })
    .in("event_class_id", classes?.map((c) => c.id) || []);

  if(countError)throw new Error(countError.message);
  const totalEntries = entriesCount ?? 0;

  return (
    <div className="flex-1 overflow-y-auto w-full">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href={`/dashboard/tracks/${trackId}/events/${eventId}/scoring`}
            className="flex items-center space-x-4 p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-900/20 border border-amber-500/30 hover:border-amber-500/60 transition group"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
              <Timer className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white group-hover:text-amber-400 transition">
                Launch Scoring Workspace
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Enter times, record distances, and manage race progression.
              </p>
            </div>
          </Link>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href={`/dashboard/tracks/${trackId}/events/${eventId}/entries`}
              className="flex-1 flex items-center space-x-4 p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white">Manage Roster</h3>
                <p className="text-xs text-slate-400 mt-1">{totalEntries} registered entries</p>
              </div>
            </Link>

            <Link
              href={`/dashboard/tracks/${trackId}/events/${eventId}/settings`}
              className="flex-1 flex items-center space-x-4 p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition group"
            >
               <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white">Event Settings</h3>
                <p className="text-xs text-slate-400 mt-1">Status & Details</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Classes Setup */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">Event Classes</h2>
              <p className="text-sm text-slate-400 mt-1">Configure the racing categories and their scoring rules.</p>
            </div>
            <Link
              href={`/dashboard/tracks/${trackId}/events/${eventId}/classes/new`}
              className="bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2 px-4 rounded-xl flex items-center space-x-2 transition border border-slate-700"
            >
              <Plus className="w-4 h-4" />
              <span>Add Class</span>
            </Link>
          </div>

          {!classes || classes.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-xl bg-slate-950/40 border border-dashed border-slate-800">
              <Trophy className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-300">No classes configured</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Add at least one class to begin registering racers and scoring passes.
              </p>
            </div>
          ) : (
            <EventClassList key={classes.map(c=>c.id+":"+c.order_num).join(",")} trackId={trackId} eventId={eventId} classes={classes} />
          )}
        </div>
      </div>
    </div>
  );
}
