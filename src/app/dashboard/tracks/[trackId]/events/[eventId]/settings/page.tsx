import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { finalizeEventStandings } from "./actions";

export default async function EventSettingsPage({ params }: { params: Promise<{ trackId: string; eventId: string }> }) {
  const { trackId, eventId } = await params;
  const supabase = await createClient();
  
  const { data: event } = await supabase.from("events").select("name, status").eq("id", eventId).single();

  async function updateStatus(formData: FormData) {
    "use server";
    const newStatus = formData.get("status") as string;
    const supabase = await createClient();
    await supabase.from("events").update({ status: newStatus }).eq("id", eventId);
    
    if (newStatus === "completed") {
      await finalizeEventStandings(eventId);
    }
    
    // Create params object inside server action context to revalidate properly
    const { trackId, eventId: eId } = await params;
    revalidatePath(`/dashboard/tracks/${trackId}/events/${eId}`);
    revalidatePath(`/r/[slug]`, 'layout');
  }

  return (
    <div className="p-8 max-w-2xl mx-auto w-full">
      <h2 className="text-2xl font-bold text-white mb-6">Event Settings</h2>
      
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div>
          <h3 className="font-bold text-lg text-white mb-2">Event Status</h3>
          <p className="text-slate-400 text-sm mb-4">
            If an event is set to <span className="font-mono text-slate-300">draft</span>, it will not appear on the public spectator view. You must change it to <span className="font-mono text-red-400">live</span> to begin broadcasting times.
          </p>
          
          <form action={updateStatus} className="flex items-center space-x-4">
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
