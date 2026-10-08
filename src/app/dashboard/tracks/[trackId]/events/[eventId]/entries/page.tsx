import {ActionFeedback} from '@/components/action-feedback';
import {raceContext} from "@/lib/race-context";
import { readAll } from "@/lib/read-all";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Timer } from "lucide-react";
import {RaceEntryForm, RaceRegistrationCorrection} from "@/components/race-entry-form";
import { InlineOrderInput } from "./InlineOrderInput";

export default async function ManageEntriesPage({ params, searchParams }: { params: Promise<{ trackId?: string; seriesId?: string; eventId: string }>, searchParams: Promise<{ error?: string;message?:string;class?:string }> }) {
  const {ownerId:trackId,ownerType,ownerColumn,ownerPath,eventId}=raceContext(await params);
  const { error,message,class:chosenClass } = await searchParams;
  const supabase = await createClient();

  const { data: classes } = await readAll(supabase
    .from("event_classes")
    .select("id, name, order_num, competition_class_id")
    .eq("event_id", eventId)
    .order("order_num", { ascending: true }));

  if (!classes || classes.length === 0) {
    return (
      <div className="p-4 sm:p-8 max-w-3xl mx-auto w-full space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Race contestants</h2>
        </div>
        <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <p className="text-slate-400">You need to add at least one class to this event before you can add contestants.</p>
          <Link 
            href={`${ownerPath}/events/${eventId}/classes/new`}
            className="inline-block px-4 py-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-lg transition"
          >
            Add First Class
          </Link>
        </div>
      </div>
    );
  }


  const {data:event}=await supabase.from("events").select("competition_season_id,local_date,status,working_revision").eq("id",eventId).single();
  const {data:rosters}=event?.competition_season_id ? await readAll(supabase.from("competition_registrations").select("*").eq("season_id",event.competition_season_id)) : {data:[]};
  async function linkIdentity(f:FormData){"use server";const db=await createClient();const {error}=await db.from("entries").update({registration_id:String(f.get("registration_id"))||null}).eq("id",String(f.get("entry_id"))).in("event_class_id",classes!.map(c=>c.id)).select("id").single();if(error)redirect(`${ownerPath}/events/${eventId}/entries?error=${encodeURIComponent(error.code==='23505'?'That series registration is already linked to another contestant in this class.':error.message)}`);revalidatePath("/dashboard","layout");redirect(`${ownerPath}/events/${eventId}/entries?message=Series registration link saved`);}
  async function addEntry(formData: FormData) {
    "use server";
    const displayName = formData.get("display_name") as string;
    const classId = formData.get("event_class_id") as string;
    const drawNumber = formData.get("draw_number") as string;
    
    const supabase = await createClient();

    const orderNum = drawNumber ? Number(drawNumber) : null;
    if (orderNum !== null && (!Number.isInteger(orderNum) || orderNum < 1)) {
      redirect(`${ownerPath}/events/${eventId}/entries?error=${encodeURIComponent("Draw number must be a positive integer")}`);
    }
    const { error: dbError } = await supabase.rpc("register_race_contestant", {
      p_owner_id: trackId, p_event_id: eventId, p_class_id: classId, p_display_name: displayName,
      p_order_num: orderNum ?? undefined, p_registration_id: String(formData.get("registration_id") || "") || undefined,
    });

    
    if (dbError?.code === '23505' && dbError.message.includes('entries_registration_key')) {
       redirect(`${ownerPath}/events/${eventId}/entries?error=${encodeURIComponent('This contestant is already signed up for this class. Edit their existing entry.')}`);
    } else if (dbError && dbError.code === '23505') {
       redirect(`${ownerPath}/events/${eventId}/entries?error=duplicate_order`);
    } else if (dbError) {
       redirect(`${ownerPath}/events/${eventId}/entries?error=${encodeURIComponent(dbError.message)}`);
    }

    revalidatePath("/dashboard","layout");
    redirect(`${ownerPath}/events/${eventId}/entries?message=${encodeURIComponent("Added: "+displayName)}`);
  }

  async function updateOrderAction(formData: FormData) {
    "use server";
    const entryId = formData.get("entry_id") as string;
    const orderNum = Number(formData.get("order_num"));
    
    const supabase = await createClient();
    if (!Number.isInteger(orderNum) || orderNum < 1) redirect(`${ownerPath}/events/${eventId}/entries?error=${encodeURIComponent("Draw number must be a positive integer")}`);
    const { error: dbError } = await supabase.from("entries").update({ order_num: orderNum }).eq("id", entryId)
      .in("event_class_id",classes!.map(c => c.id)).select("id").single();
    
    if (dbError && dbError.code === '23505') {
       redirect(`${ownerPath}/events/${eventId}/entries?error=duplicate_order`);
    }
    if (dbError) redirect(`${ownerPath}/events/${eventId}/entries?error=${encodeURIComponent(dbError.message)}`);
    revalidatePath(`${ownerPath}/events/${eventId}/entries`);
    redirect(`${ownerPath}/events/${eventId}/entries?message=Changes saved`);
  }

  async function deleteEntry(formData: FormData) {
    "use server";
    const entryId = formData.get("entry_id") as string;
    const supabase = await createClient();
    const { error: dbError } = await supabase.from("entries").delete().eq("id", entryId)
      .in("event_class_id",classes!.map(c => c.id)).select("id").single();
    if (dbError) redirect(`${ownerPath}/events/${eventId}/entries?error=${encodeURIComponent(dbError.message)}`);
    revalidatePath(`${ownerPath}/events/${eventId}/entries`);
    redirect(`${ownerPath}/events/${eventId}/entries?message=Changes saved`);
  }

  const { data: entries } = await readAll(supabase
    .from("entries")
    .select("id, event_class_id, display_name, order_num, registration_id, event_classes(name)")
    .in("event_class_id", classes.map(c => c.id))
    .order("order_num", { ascending: true }));

  // Group by class
  const groupedEntries = classes.map(c => ({
    ...c,
    entries: entries?.filter(e => e.event_class_id === c.id) || []
  }));

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto w-full space-y-8">
      <h2 className="text-2xl font-bold">Add a contestant for this race</h2>
      {ownerType === 'series' && !event?.competition_season_id && <p className="p-4 border border-amber-500 rounded text-sm">This calendar event has no series season assigned. <Link href={`${ownerPath}/events/${eventId}/settings`} className="text-amber-400 underline">Assign a series season in Date &amp; status</Link> to link registered members and award series points. You can still add one-race contestants.</p>}
      <ActionFeedback error={error==='duplicate_order'?'That running-order number is already in use. Choose another number.':error} message={message}/>
      <RaceEntryForm classes={classes} registrations={rosters} raceDate={event?.local_date || ''} hasSeries={!!event?.competition_season_id} chosenClass={chosenClass} action={addEntry}/>
      {event?.competition_season_id && <RaceRegistrationCorrection entries={entries} classes={classes} registrations={rosters} action={linkIdentity}/>}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Race contestants</h2>
        <div className="flex items-center space-x-3">
          <Link 
            href={`${ownerPath}/events/${eventId}/classes/new`}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-4 py-2 rounded-lg transition"
          >
            <span>Add Class</span>
          </Link>
          <Link 
            href={`${ownerPath}/events/${eventId}/scoring`}
            className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-4 py-2 rounded-lg transition"
          >
            <Timer className="w-4 h-4" />
            <span>Enter results</span>
          </Link>
        </div>
      </div>

      <div>
         <h2 className="text-xl font-bold text-white mb-4">Current Roster (by Class)</h2>
         <div className="space-y-6">
            {groupedEntries.map(group => (
              <div key={group.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700/80">
                  <h3 className="font-bold text-white text-sm">{group.name}</h3>
                </div>
                <div className="divide-y divide-slate-800">
                  {group.entries.length === 0 && <div className="p-4 text-slate-500 text-sm italic">No entries in this class.</div>}
                  {group.entries.map(entry => (
                    <div key={entry.id} className="p-3 space-y-3 hover:bg-slate-800/30 transition">
                      <div className="flex items-center space-x-4">
                        <InlineOrderInput entryId={entry.id} defaultOrder={entry.order_num} updateAction={updateOrderAction} />
                        <span className="text-white font-medium text-sm">{entry.display_name}</span>
                      </div>
                      <form action={deleteEntry} className="pt-2 border-t">
                        <input type="hidden" name="entry_id" value={entry.id} />
                        <button type="submit" className="text-slate-500 hover:text-red-500 transition p-1.5 rounded bg-slate-800 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/30">
                          Remove contestant
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
}
