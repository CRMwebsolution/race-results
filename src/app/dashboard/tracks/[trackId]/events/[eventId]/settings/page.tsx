import {RaceStatusForm} from '@/components/race-status-form';
import {ActionFeedback} from '@/components/action-feedback';
import Link from "next/link";
import {raceContext} from "@/lib/race-context";
import {readAll} from "@/lib/read-all";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { finalizeEventStandings } from "./actions";

export default async function EventSettingsPage({ params, searchParams }: { searchParams: Promise<{ error?: string;message?:string }>; params: Promise<{ trackId?: string; seriesId?: string; eventId: string }> }) {
  const {ownerId:trackId,ownerType,ownerColumn,ownerPath,eventId}=raceContext(await params);
  const { error: actionError,message } = await searchParams;
  const supabase = await createClient();
  
  const { data: event } = await supabase.from("events").select("name, local_date, status, working_revision, venue_description, competition_season_id").eq("id", eventId).eq(ownerColumn,trackId).single();

  const { data: canPublish } = await supabase.rpc("can_publish_race",{p_event_id:eventId});
  if (!canPublish) return <p className="p-8 text-slate-400">Only the track or organization owner can publish final results or reopen this event.</p>;

  const {data:seasons}=await readAll(supabase.from("competition_seasons").select("*").eq(ownerColumn,trackId).order("starts_on",{ascending:false}));
  async function setSeason(f:FormData){"use server";const db=await createClient();const {error}=await db.rpc("attach_competition",{p_event_id:eventId,p_season_id:String(f.get("season_id"))});if(error)redirect(`${ownerPath}/events/${eventId}/settings?error=${encodeURIComponent(error.message)}`);revalidatePath("/dashboard","layout");redirect(`${ownerPath}/events/${eventId}/settings?message=Changes saved`);}
  async function updateStatus(formData: FormData) {
    "use server";
    const newStatus = formData.get("status") as string;
    if(newStatus==="completed")redirect(`${ownerPath}/events/${eventId}/settings?error=Use Complete race on the Enter results screen to finish saving and publish results.`);
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
    redirect(`${ownerPath}/events/${eventId}/settings?message=${encodeURIComponent("Race status updated: "+newStatus)}`);
  }

  async function editEvent(f:FormData) { "use server"; const db=await createClient();const {error}=await db.rpc("edit_race_event",{p_event_id:eventId,p_name:String(f.get("name")),p_date:String(f.get("date")),p_track_id:trackId,p_expected_revision:Number(f.get("revision"))});if(error)redirect(`${ownerPath}/events/${eventId}/settings?error=${encodeURIComponent(error.message)}`);if(ownerType==="series"){const {error:venueError}=await db.rpc("edit_series_venue",{p_event_id:eventId,p_description:String(f.get("venue_description"))});if(venueError)redirect(`${ownerPath}/events/${eventId}/settings?error=${encodeURIComponent(venueError.message)}`);}revalidatePath("/dashboard","layout");redirect(`${ownerPath}/events/${eventId}/settings?message=Changes saved`); }
  async function deleteEvent(f:FormData) { "use server"; const db=await createClient();const {error}=await db.rpc("delete_or_withdraw_event",{p_event_id:eventId,p_confirm:f.get("confirm")==="on"});if(error)redirect(`${ownerPath}/events/${eventId}/settings?error=${encodeURIComponent(error.message)}`);revalidatePath("/dashboard","layout");redirect(`${ownerPath}`); }

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto w-full">
      <h2 className="text-2xl font-bold text-white mb-6">Event Settings</h2>
      
      <ActionFeedback error={actionError} message={message}/>
      <form action={editEvent} className="space-y-4 mb-8"><h2 className="text-xl font-bold">Event details</h2><input type="hidden" name="revision" value={event?.working_revision}/><label className="block">Name<input required name="name" defaultValue={event?.name} className="block w-full min-w-0 p-3 rounded bg-slate-900 border w-full"/></label><label className="block">Race date<input required type="date" name="date" defaultValue={event?.local_date} className="block w-full min-w-0 p-3 rounded bg-slate-900 border w-full"/></label>{ownerType==="series"&&<label className="block">Venue and location<textarea name="venue_description" required defaultValue={event?.venue_description||""} className="block w-full min-w-0 p-3 rounded bg-slate-900 border w-full"/></label>}<button className="p-3 rounded bg-amber-500 text-slate-950">Save details</button></form>
      <section className="space-y-3 mb-6"><h2 className="font-bold">{ownerType==='series'?'Series season':'Optional track series'}</h2><p>Current series season: {seasons.find(s=>s.id===event?.competition_season_id)?.name||'None'}</p><Link href={`${ownerPath}/seasons`} className="text-amber-400">Manage series seasons and registrations</Link>{seasons.length>0&&<form action={setSeason} className="space-y-3"><label>Series season<select name="season_id" required defaultValue={event?.competition_season_id||''} className="block w-full min-w-0 p-3 bg-slate-900 border rounded"><option value="">Choose series season</option>{seasons.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button className="p-3 border rounded">Assign series season</button></form>}</section>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div>
          <h3 className="font-bold text-lg text-white mb-2">Event Status</h3>
          <p className="text-slate-400 text-sm mb-4">
            If an event is set to <span className="font-mono text-slate-300">draft</span>, it will not appear on the public spectator view. A <span className="font-mono text-slate-300">scheduled</span> event is publicly visible on the calendar. Change it to <span className="font-mono text-red-400">live</span> to begin broadcasting times.
          </p>
          
          <RaceStatusForm status={event?.status||"draft"} revision={event?.working_revision||0} action={updateStatus}/><p className="mt-3 text-sm text-slate-400">To finish and publish official results, use Complete race on the Enter results screen.</p>
        </div>
      </div>
      <form action={deleteEvent} className="space-y-3 mb-8 p-4 border border-red-900 rounded"><h2 className="font-bold">Delete or withdraw event</h2><p>Empty events are deleted. Events with racers or official results are withdrawn; their history is retained.</p><label className="block"><input required type="checkbox" name="confirm"/> I confirm this event should be removed from the schedule.</label><button className="p-3 bg-red-950 rounded">Delete / withdraw event</button></form>
    </div>
  );
}
