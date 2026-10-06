import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { finalizeEventStandings } from "./actions";

export default async function EventSettingsPage({ params, searchParams }: { searchParams: Promise<{ error?: string }>; params: Promise<{ trackId: string; eventId: string }> }) {
  const { trackId, eventId } = await params;
  const { error: actionError } = await searchParams;
  const supabase = await createClient();
  
  const { data: event } = await supabase.from("events").select("name, status, working_revision").eq("id", eventId).eq("track_id",trackId).single();

  const { data: canPublish } = await supabase.rpc("can_publish_track",{p_track_id:trackId});
  if (!canPublish) return <p className="p-8 text-slate-400">Only the track or organization owner can publish final results or reopen this event.</p>;

  async function updateStatus(formData: FormData) {
    "use server";
    const newStatus = formData.get("status") as string;
    const supabase = await createClient();
    const result = newStatus === "completed" ? await finalizeEventStandings(eventId) : await supabase.rpc("set_race_event_status", {
      p_event_id: eventId, p_status: newStatus, p_expected_revision: Number(formData.get("revision")),
    });
    if (result.error) {
      const message = typeof result.error === "string" ? result.error : result.error.message;
      redirect(`/dashboard/tracks/${trackId}/events/${eventId}/settings?error=${encodeURIComponent(message)}`);
    }

    revalidatePath(`/dashboard/tracks/${trackId}/events/${eventId}`);
    revalidatePath(`/r/[slug]`, 'layout');
    redirect(`/dashboard/tracks/${trackId}/events/${eventId}/settings`);
  }

  return (
    <div className="p-8 max-w-2xl mx-auto w-full">
      <h2 className="text-2xl font-bold text-white mb-6">Event Settings</h2>
      
      {actionError && <p role="alert" className="mb-4 text-red-400">{actionError}</p>}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div>
          <h3 className="font-bold text-lg text-white mb-2">Event Status</h3>
          <p className="text-slate-400 text-sm mb-4">
            If an event is set to <span className="font-mono text-slate-300">draft</span>, it will not appear on the public spectator view. You must change it to <span className="font-mono text-red-400">live</span> to begin broadcasting times.
          </p>
          
          <form action={updateStatus} className="flex items-center space-x-4">
            <input type="hidden" name="revision" value={event?.working_revision ?? ""} />
            <select 
              name="status" 
              defaultValue={event?.status}
              className="bg-slate-950 border border-slate-700 text-white rounded p-2"
            >
              <option value="draft">Draft (Hidden)</option>
              <option value="scheduled">Scheduled (Calendar Preview)</option>
              <option value="live">Live</option>
              <option value="completed">Completed (Final Results)</option>
            </select>
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded transition">
              Update Status
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
