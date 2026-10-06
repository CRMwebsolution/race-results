import { readAll } from "@/lib/read-all";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ArrowLeft, Plus, Edit2, Trash2, X, Save } from "lucide-react";
import { redirect } from "next/navigation";

export default async function SeriesSchedulePage(props: { 
  params: Promise<{ seriesId: string }>;
  searchParams: Promise<{ edit_event_id?: string; error?: string }>;
}) {
  const { seriesId } = await props.params;
  const searchParams = await props.searchParams;
  const editEventId = searchParams?.edit_event_id;
  const errorMsg = searchParams?.error;

  const supabase = await createClient();

  const { data: series } = await supabase.from("series").select("*").eq("id", seriesId).single();
  
  // Fetch events for this series
  const { data: events } = await readAll(supabase
    .from("events")
    .select("*, tracks(id, name)")
    .eq("series_id", seriesId)
    .order("local_date", { ascending: true }));

  const eventToEdit = events?.find(e => e.id === editEventId);

  // Fetch tracks the user's organization owns
  const { data: orgTracks } = await readAll(supabase
    .from("tracks")
    .select("id, name, slug")
    .eq("organization_id", series?.organization_id || ""));

  async function addEventToSchedule(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const date = formData.get("local_date") as string;
    const trackName = formData.get("track_name") as string;
    
    const supabase = await createClient();
    
    let trackId = "";
    
    // Check if the track name already matches an existing track in this org
    const { data: existingTrack } = await supabase
      .from("tracks")
      .select("id")
      .eq("organization_id", series?.organization_id || "")
      .ilike("name", trackName)
      .maybeSingle();
      
    if (existingTrack) {
      trackId = existingTrack.id;
    } else {
      // Create a new track for this location via secure RPC
      const trackSlug = `${trackName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")}-${Date.now().toString().slice(-4)}`;
      
      const { data: newTrackId, error: createTrackError } = await supabase.rpc("create_ghost_track", {
        p_org_id: series!.organization_id,
        p_name: trackName,
        p_slug: trackSlug,
        p_timezone: "America/New_York"
      });
        
      if (newTrackId) {
        trackId = String(newTrackId);
      } else {
        console.error("Failed to create ghost track:", createTrackError);
        redirect(`/dashboard/series/${seriesId}/schedule?error=TrackCreateFailed_${encodeURIComponent(createTrackError?.message || 'unknown')}`);
      }
    }
    
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")}-${Date.now().toString().slice(-4)}`;

    // Create the event on the track, linked to the series
    const { error: eventError } = await supabase.from("events").insert({
      track_id: trackId,
      series_id: seriesId,
      name,
      slug,
      local_date: date,
      setup_request_id: String(formData.get("request_id")),
      status: "scheduled"
    });
    
    if (eventError) {
      console.error("Failed to create event:", eventError);
      redirect(`/dashboard/series/${seriesId}/schedule?error=EventCreateFailed_${encodeURIComponent(eventError.message)}`);
    }
    
    revalidatePath(`/dashboard/series/${seriesId}/schedule`);
    revalidatePath(`/dashboard/series/${seriesId}`);
  }

  async function updateEventInSchedule(formData: FormData) {
    "use server";
    const eventId = formData.get("event_id") as string;
    const name = formData.get("name") as string;
    const date = formData.get("local_date") as string;
    const trackName = formData.get("track_name") as string;
    const status = formData.get("status") as string;
    
    const supabase = await createClient();
    
    let trackId = "";
    
    // Check if the track name matches an existing track in this org
    const { data: existingTrack } = await supabase
      .from("tracks")
      .select("id")
      .eq("organization_id", series?.organization_id || "")
      .ilike("name", trackName)
      .maybeSingle();
      
    if (existingTrack) {
      trackId = existingTrack.id;
    } else {
      // Create a new track for this location via secure RPC
      const trackSlug = `${trackName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")}-${Date.now().toString().slice(-4)}`;
      
      const { data: newTrackId, error: createTrackError } = await supabase.rpc("create_ghost_track", {
        p_org_id: series!.organization_id,
        p_name: trackName,
        p_slug: trackSlug,
        p_timezone: "America/New_York"
      });
        
      if (newTrackId) {
        trackId = String(newTrackId);
      } else {
        console.error("Failed to create ghost track:", createTrackError);
        redirect(`/dashboard/series/${seriesId}/schedule?error=TrackCreateFailed_${encodeURIComponent(createTrackError?.message || 'unknown')}`);
      }
    }

    const { error: updateError } = await supabase.rpc("edit_race_event", {
      p_event_id: eventId, p_name: name, p_date: date, p_track_id: trackId,
      p_expected_revision: Number(formData.get("revision")),
    });

    if (updateError) {
      console.error("Failed to update event:", updateError);
      redirect(`/dashboard/series/${seriesId}/schedule?error=EventUpdateFailed_${encodeURIComponent(updateError.message)}`);
    }

    revalidatePath(`/dashboard/series/${seriesId}/schedule`);
    revalidatePath(`/dashboard/series/${seriesId}`);
    redirect(`/dashboard/series/${seriesId}/schedule`);
  }

  async function deleteEventFromSchedule(formData: FormData) {
    "use server";
    const eventId = formData.get("event_id") as string;
    const supabase = await createClient();

    const { error: deleteError } = await supabase.rpc("delete_or_withdraw_event", {p_event_id:eventId,p_confirm:formData.get("confirm") === "on"});

    if (deleteError) {
      console.error("Failed to delete event:", deleteError);
      redirect(`/dashboard/series/${seriesId}/schedule?error=EventDeleteFailed_${encodeURIComponent(deleteError.message)}`);
    }

    revalidatePath(`/dashboard/series/${seriesId}/schedule`);
    revalidatePath(`/dashboard/series/${seriesId}`);
    redirect(`/dashboard/series/${seriesId}/schedule`);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-8">
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-sm">
          <strong>Notice:</strong> {decodeURIComponent(errorMsg)}
        </div>
      )}

      <div className="flex items-center space-x-3">
        <Link 
          href={`/dashboard/series/${seriesId}`}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Series Schedule</h1>
          <p className="text-sm text-slate-400">{series?.name}</p>
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="font-bold text-lg text-white">Tour Dates</h2>
          
          {events?.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl text-center text-slate-400">
              No dates added to the tour yet. Add one to the right.
            </div>
          ) : (
            <div className="space-y-3">
              {events?.map(ev => (
                <div 
                  key={ev.id} 
                  className={`border p-4 rounded-xl flex justify-between items-center transition ${
                    editEventId === ev.id ? 'bg-slate-800 border-amber-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex-1 pr-4">
                    <h3 className="font-bold text-slate-200">{ev.name}</h3>
                    <p className="text-sm text-slate-400">{(ev.tracks as any)?.name || "Location TBD"}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className="font-mono text-xs text-amber-500">{ev.local_date}</span>
                      <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {ev.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/dashboard/tracks/${ev.track_id}/events/${ev.id}`} className="text-amber-400">Manage race</Link><Link
                      href={`/dashboard/series/${seriesId}/schedule?edit_event_id=${ev.id}`}
                      className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition"
                      title="Edit Race"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Link>
                    <form action={deleteEventFromSchedule}>
                      <input type="hidden" name="event_id" value={ev.id} />
                      <label className="text-xs"><input type="checkbox" name="confirm" required/> Confirm delete/withdraw</label><button
                        type="submit"
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                        title="Delete Race"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div>
          <form 
            action={editEventId ? updateEventInSchedule : addEventToSchedule} 
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 sticky top-24"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-lg text-white flex items-center space-x-2">
                {editEventId ? <Edit2 className="w-4 h-4 text-amber-500" /> : <Plus className="w-4 h-4 text-amber-500" />}
                <span>{editEventId ? 'Edit Race Date' : 'Add Race Date'}</span>
              </h2>
              {editEventId && (
                <Link href={`/dashboard/series/${seriesId}/schedule`} className="text-slate-500 hover:text-slate-300">
                  <X className="w-5 h-5" />
                </Link>
              )}
            </div>

            {!editEventId && <input type="hidden" name="request_id" value={crypto.randomUUID()}/>}
            {editEventId && <input type="hidden" name="event_id" value={editEventId} />}
            
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Event Name</label>
              <input 
                name="name" 
                defaultValue={eventToEdit?.name || ""}
                required 
                placeholder="e.g. Round 1: Mud Nationals"
                className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-amber-500 outline-none"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Date</label>
              <input 
                name="local_date" 
                type="date"
                defaultValue={eventToEdit?.local_date || ""}
                required 
                style={{ colorScheme: 'dark' }}
                className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-amber-500 outline-none"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Track Location</label>
              <input 
                name="track_name" 
                defaultValue={(eventToEdit?.tracks as any)?.name || ""}
                required 
                list="orgTracksList"
                placeholder="e.g. Dennis Anderson's Muddy Motorsports Park"
                className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-amber-500 outline-none"
              />
              <datalist id="orgTracksList">
                {orgTracks?.map(track => (
                  <option key={track.id} value={track.name} />
                ))}
              </datalist>
            </div>

            {editEventId && <><input type="hidden" name="revision" value={eventToEdit?.working_revision}/><Link className="block text-amber-400" href={`/dashboard/tracks/${eventToEdit?.track_id}/events/${editEventId}/settings`}>Manage status and official results</Link></>}

            <div className="flex items-center space-x-3 pt-2">
              <button 
                type="submit" 
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-4 py-2.5 rounded-lg transition flex items-center justify-center space-x-2"
              >
                {editEventId ? (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                ) : (
                  <span>Add to Schedule</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
