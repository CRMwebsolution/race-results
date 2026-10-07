import Link from "next/link";
import {raceContext} from "@/lib/race-context";
import {readAll} from "@/lib/read-all";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { finalizeEventStandings } from "./actions";

export default async function EventSettingsPage({ params, searchParams }: { searchParams: Promise<{ error?: string }>; params: Promise<{ trackId?: string; seriesId?: string; eventId: string }> }) {
  const {ownerId:trackId,ownerType,ownerColumn,ownerPath,eventId}=raceContext(await params);
  const { error: actionError } = await searchParams;
  const supabase = await createClient();
  
  const { data: event } = await supabase.from("events").select("name, local_date, status, working_revision, venue_description, competition_season_id").eq("id", eventId).eq(ownerColumn,trackId).single();

  const { data: canPublish } = await supabase.rpc("can_publish_race",{p_event_id:eventId});
  if (!canPublish) return <p className="p-8 text-slate-400">Only the track or organization owner can publish final results or reopen this event.</p>;

  const {data:seasons}=await readAll(supabase.from("competition_seasons").select("*").eq(ownerColumn,trackId).order("starts_on",{ascending:false}));
  async function setSeason(f:FormData){"use server";const db=await createClient();const {error}=await db.rpc("attach_competition",{p_event_id:eventId,p_season_id:String(f.get("season_id"))});if(error)redirect(`${ownerPath}/events/${eventId}/settings?error=${encodeURIComponent(error.message)}`);revalidatePath("/dashboard","layout");redirect(`${ownerPath}/events/${eventId}/settings`);}
  const {data:offlineSessions}=await readAll(supabase.from("offline_scoring_sessions").select("*").eq("event_id",eventId).is("closed_at",null));
  async function releaseDevice(f:FormData){"use server";if(f.get("confirm")!=="on")throw new Error("Confirmation required");const db=await createClient();const {error}=await db.rpc("release_offline_session",{p_session_id:String(f.get("session_id")),p_reason:String(f.get("reason"))});if(error)redirect(`${ownerPath}/events/${eventId}/settings?error=${encodeURIComponent(error.message)}`);revalidatePath("/dashboard","layout");redirect(`${ownerPath}/events/${eventId}/settings`);}
  async function updateStatus(formData: FormData) {
    "use server";
    const newStatus = formData.get("status") as string;
    const supabase = await createClient();
    const result = newStatus === "completed" ? await finalizeEventStandings(eventId) : await supabase.rpc("set_race_event_status", {
      p_event_id: eventId, p_status: newStatus, p_expected_revision: Number(formData.get("revision")),
    });
    if (result.error) {
      const message = typeof result.error === "string" ? result.error : result.error.message;
      redirect(`${ownerPath}/events/${eventId}/settings?error=${encodeURIComponent(message)}`);
    }

    revalidatePath(`${ownerPath}/events/${eventId}`);
    revalidatePath(`/r/[slug]`, 'layout');
    redirect(`${ownerPath}/events/${eventId}/settings`);
  }

  async function editEvent(f:FormData) { "use server"; const db=await createClient();const {error}=await db.rpc("edit_race_event",{p_event_id:eventId,p_name:String(f.get("name")),p_date:String(f.get("date")),p_track_id:trackId,p_expected_revision:Number(f.get("revision"))});if(error)redirect(`${ownerPath}/events/${eventId}/settings?error=${encodeURIComponent(error.message)}`);if(ownerType==="series"){const {error:venueError}=await db.rpc("edit_series_venue",{p_event_id:eventId,p_description:String(f.get("venue_description"))});if(venueError)redirect(`${ownerPath}/events/${eventId}/settings?error=${encodeURIComponent(venueError.message)}`);}revalidatePath("/dashboard","layout");redirect(`${ownerPath}/events/${eventId}/settings`); }
  async function deleteEvent(f:FormData) { "use server"; const db=await createClient();const {error}=await db.rpc("delete_or_withdraw_event",{p_event_id:eventId,p_confirm:f.get("confirm")==="on"});if(error)redirect(`${ownerPath}/events/${eventId}/settings?error=${encodeURIComponent(error.message)}`);revalidatePath("/dashboard","layout");redirect(`${ownerPath}`); }

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto w-full">
      <h2 className="text-2xl font-bold text-white mb-6">Event Settings</h2>
      
      {actionError && <p role="alert" className="mb-4 text-red-400">{actionError}</p>}
      {offlineSessions.length>0&&<section className="border border-amber-600 rounded p-4 space-y-4 mb-6"><h2 className="font-bold">Open offline devices · finalization blocked</h2><p>Finish each device session after uploading. An owner can release an abandoned device deliberately; unsent edits from that device cannot enter a completed race.</p>{offlineSessions.map(s=><form action={releaseDevice} key={s.id} className="space-y-3 border-t pt-3"><p>Device {s.device_id.slice(0,8)} · prepared {s.prepared_at}</p><input type="hidden" name="session_id" value={s.id}/><label className="block">Release reason<input name="reason" required minLength={5} className="block w-full p-3 bg-slate-900 border rounded"/></label><label className="block"><input type="checkbox" required name="confirm"/> I confirm its uploads are complete or intentionally abandon any remaining device edits.</label><button className="p-3 border rounded">Release device session (audited)</button></form>)}</section>}
      <form action={editEvent} className="space-y-4 mb-8"><h2 className="text-xl font-bold">Event details</h2><input type="hidden" name="revision" value={event?.working_revision}/><label className="block">Name<input required name="name" defaultValue={event?.name} className="block w-full min-w-0 p-3 rounded bg-slate-900 border w-full"/></label><label className="block">Race date<input required type="date" name="date" defaultValue={event?.local_date} className="block w-full min-w-0 p-3 rounded bg-slate-900 border w-full"/></label>{ownerType==="series"&&<label className="block">Venue and location<textarea name="venue_description" required defaultValue={event?.venue_description||""} className="block w-full min-w-0 p-3 rounded bg-slate-900 border w-full"/></label>}<button className="p-3 rounded bg-amber-500 text-slate-950">Save details</button></form>
      <section className="space-y-3 mb-6"><h2 className="font-bold">{ownerType==='series'?'Series season':'Optional track in-house championship'}</h2><p>Current season: {seasons.find(s=>s.id===event?.competition_season_id)?.name||'None'}</p><Link href={`${ownerPath}/seasons`} className="text-amber-400">Manage championship seasons and registrations</Link>{seasons.length>0&&<form action={setSeason} className="space-y-3"><label>Season<select name="season_id" required defaultValue={event?.competition_season_id||''} className="block w-full min-w-0 p-3 bg-slate-900 border rounded"><option value="">Choose season</option>{seasons.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button className="p-3 border rounded">Assign championship season</button></form>}</section><form action={deleteEvent} className="space-y-3 mb-8 p-4 border border-red-900 rounded"><h2 className="font-bold">Delete or withdraw event</h2><p>Empty events are deleted. Events with racers or official results are withdrawn; their history is retained.</p><label className="block"><input required type="checkbox" name="confirm"/> I confirm this event should be removed from the schedule.</label><button className="p-3 bg-red-950 rounded">Delete / withdraw event</button></form>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div>
          <h3 className="font-bold text-lg text-white mb-2">Event Status</h3>
          <p className="text-slate-400 text-sm mb-4">
            If an event is set to <span className="font-mono text-slate-300">draft</span>, it will not appear on the public spectator view. You must change it to <span className="font-mono text-red-400">live</span> to begin broadcasting times.
          </p>
          
          <form action={updateStatus} className="grid gap-3 sm:grid-cols-2 items-center">
            <input type="hidden" name="revision" value={event?.working_revision ?? ""} />
            <select 
              name="status" 
              defaultValue={event?.status}
              className="w-full min-w-0 bg-slate-950 border border-slate-700 text-white rounded p-2"
            >
              <option value="draft">Draft (Hidden)</option>
              <option value="scheduled">Scheduled (Calendar Preview)</option>
              <option value="live">Live</option>
              <option value="cancelled">Cancelled / withdrawn</option>
              <option value="completed">Completed (Final Results)</option>
            </select>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded transition">
              Update Status
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
