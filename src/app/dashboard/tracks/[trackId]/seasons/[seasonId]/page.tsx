import { readAll } from "@/lib/read-all";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ArrowLeft, Link as LinkIcon, Trash2 } from "lucide-react";

export default async function ManageSeasonPage({ params }: { params: Promise<{ trackId: string, seasonId: string }> }) {
  const { trackId, seasonId } = await params;
  const supabase = await createClient();

  // Fetch season
  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .eq("id", seasonId)
    .single();

  // Fetch linked events
  const { data: seasonEvents } = await readAll(supabase
    .from("season_events")
    .select("event_id, events(id, name, local_date, status)")
    .eq("season_id", seasonId));

  // Fetch all track events to allow linking
  const { data: allTrackEvents } = await readAll(supabase
    .from("events")
    .select("id, name, local_date, status")
    .eq("track_id", trackId)
    .order("local_date", { ascending: false }));

  const linkedEventIds = new Set(seasonEvents?.map(se => se.event_id) || []);
  const availableEvents = allTrackEvents?.filter(e => !linkedEventIds.has(e.id)) || [];

  async function linkEvent(formData: FormData) {
    "use server";
    const eventId = formData.get("event_id") as string;
    const supabase = await createClient();
    await supabase.from("season_events").insert({ season_id: seasonId, event_id: eventId });
    revalidatePath(`/dashboard/tracks/${trackId}/seasons/${seasonId}`);
  }

  async function unlinkEvent(formData: FormData) {
    "use server";
    const eventId = formData.get("event_id") as string;
    const supabase = await createClient();
    await supabase.from("season_events").delete().match({ season_id: seasonId, event_id: eventId });
    revalidatePath(`/dashboard/tracks/${trackId}/seasons/${seasonId}`);
  }

  if (!season) return <div>Season not found</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <Link 
          href={`/dashboard/tracks/${trackId}/seasons`}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold text-white">{season.name}</h1>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <h2 className="font-bold text-lg text-white">Linked Events</h2>
          {seasonEvents?.length === 0 ? (
            <p className="text-slate-500 text-sm italic">No events linked to this season yet.</p>
          ) : (
            <div className="space-y-3">
              {seasonEvents?.map(se => {
                const ev = se.events as any;
                return (
                  <div key={se.event_id} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <div>
                      <div className="font-bold text-slate-200 text-sm">{ev.name}</div>
                      <div className="text-xs text-slate-500">{ev.local_date} • {ev.status}</div>
                    </div>
                    <form action={unlinkEvent}>
                      <input type="hidden" name="event_id" value={se.event_id} />
                      <button type="submit" className="text-slate-500 hover:text-red-400 p-2 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <h2 className="font-bold text-lg text-white">Link New Event</h2>
          {availableEvents.length === 0 ? (
            <p className="text-slate-500 text-sm italic">No more events available to link.</p>
          ) : (
            <form action={linkEvent} className="space-y-4">
              <select name="event_id" className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm" required>
                <option value="">Select an event...</option>
                {availableEvents.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.name} ({ev.local_date})</option>
                ))}
              </select>
              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-4 py-2.5 rounded-xl transition flex items-center justify-center space-x-2">
                <LinkIcon className="w-4 h-4" />
                <span>Link Event to Season</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
