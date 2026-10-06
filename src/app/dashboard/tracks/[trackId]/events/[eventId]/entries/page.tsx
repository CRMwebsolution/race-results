import { readAll } from "@/lib/read-all";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Timer, Trash2, AlertCircle } from "lucide-react";
import { InlineOrderInput } from "./InlineOrderInput";

export default async function ManageEntriesPage({ params, searchParams }: { params: Promise<{ trackId: string; eventId: string }>, searchParams: Promise<{ error?: string }> }) {
  const { trackId, eventId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: classes } = await readAll(supabase
    .from("event_classes")
    .select("id, name, order_num")
    .eq("event_id", eventId)
    .order("order_num", { ascending: true }));

  if (!classes || classes.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto w-full space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Manage Roster</h2>
        </div>
        <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <p className="text-slate-400">You need to add at least one class to this event before you can add contestants.</p>
          <Link 
            href={`/dashboard/tracks/${trackId}/events/${eventId}/classes/new`}
            className="inline-block px-4 py-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-lg transition"
          >
            Add First Class
          </Link>
        </div>
      </div>
    );
  }


  const {data:event}=await supabase.from("events").select("series_id").eq("id",eventId).single();
  const {data:rosters}=event?.series_id ? await readAll(supabase.from("series_rosters").select("*").eq("series_id",event.series_id)) : {data:[]};
  async function importRoster(){"use server";const db=await createClient();const {error}=await db.rpc("import_series_roster",{p_event_id:eventId});if(error)redirect(`?error=${encodeURIComponent(error.message)}`);revalidatePath("/dashboard/tracks","layout");redirect(`/dashboard/tracks/${trackId}/events/${eventId}/entries`);}
  async function linkIdentity(f:FormData){"use server";const db=await createClient();const {error}=await db.from("entries").update({series_roster_id:String(f.get("roster_id"))}).eq("id",String(f.get("entry_id"))).in("event_class_id",classes!.map(c=>c.id)).select("id").single();if(error)redirect(`?error=${encodeURIComponent(error.message)}`);revalidatePath("/dashboard/tracks","layout");redirect(`/dashboard/tracks/${trackId}/events/${eventId}/entries`);}
  async function addEntry(formData: FormData) {
    "use server";
    const displayName = formData.get("display_name") as string;
    const classId = formData.get("event_class_id") as string;
    const drawNumber = formData.get("draw_number") as string;
    
    const supabase = await createClient();

    const orderNum = drawNumber ? Number(drawNumber) : null;
    if (orderNum !== null && (!Number.isInteger(orderNum) || orderNum < 1)) {
      redirect(`/dashboard/tracks/${trackId}/events/${eventId}/entries?error=${encodeURIComponent("Draw number must be a positive integer")}`);
    }
    const { error: dbError } = await supabase.rpc("create_race_entry", {
      p_track_id: trackId, p_event_id: eventId, p_class_id: classId, p_display_name: displayName,
      p_order_num: orderNum,
    } as unknown as import("@/types/database").Database["public"]["Functions"]["create_race_entry"]["Args"]);

    
    if (dbError && dbError.code === '23505') {
       redirect(`/dashboard/tracks/${trackId}/events/${eventId}/entries?error=duplicate_order`);
    } else if (dbError) {
       redirect(`/dashboard/tracks/${trackId}/events/${eventId}/entries?error=${encodeURIComponent(dbError.message)}`);
    }

    redirect(`/dashboard/tracks/${trackId}/events/${eventId}/entries`);
  }

  async function updateOrderAction(formData: FormData) {
    "use server";
    const entryId = formData.get("entry_id") as string;
    const orderNum = Number(formData.get("order_num"));
    
    const supabase = await createClient();
    if (!Number.isInteger(orderNum) || orderNum < 1) redirect(`/dashboard/tracks/${trackId}/events/${eventId}/entries?error=${encodeURIComponent("Draw number must be a positive integer")}`);
    const { error: dbError } = await supabase.from("entries").update({ order_num: orderNum }).eq("id", entryId)
      .in("event_class_id",classes!.map(c => c.id)).select("id").single();
    
    if (dbError && dbError.code === '23505') {
       redirect(`/dashboard/tracks/${trackId}/events/${eventId}/entries?error=duplicate_order`);
    }
    if (dbError) redirect(`/dashboard/tracks/${trackId}/events/${eventId}/entries?error=${encodeURIComponent(dbError.message)}`);
    revalidatePath(`/dashboard/tracks/${trackId}/events/${eventId}/entries`);
    redirect(`/dashboard/tracks/${trackId}/events/${eventId}/entries`);
  }

  async function deleteEntry(formData: FormData) {
    "use server";
    const entryId = formData.get("entry_id") as string;
    const supabase = await createClient();
    const { error: dbError } = await supabase.from("entries").delete().eq("id", entryId)
      .in("event_class_id",classes!.map(c => c.id)).select("id").single();
    if (dbError) redirect(`/dashboard/tracks/${trackId}/events/${eventId}/entries?error=${encodeURIComponent(dbError.message)}`);
    revalidatePath(`/dashboard/tracks/${trackId}/events/${eventId}/entries`);
    redirect(`/dashboard/tracks/${trackId}/events/${eventId}/entries`);
  }

  const { data: entries } = await readAll(supabase
    .from("entries")
    .select("id, event_class_id, display_name, order_num, event_classes(name)")
    .in("event_class_id", classes.map(c => c.id))
    .order("order_num", { ascending: true }));

  // Group by class
  const groupedEntries = classes.map(c => ({
    ...c,
    entries: entries?.filter(e => e.event_class_id === c.id) || []
  }));

  return (
    <div className="p-8 max-w-3xl mx-auto w-full space-y-8">
      {event?.series_id&&<form action={importRoster}><button className="p-3 rounded bg-amber-500 text-slate-950">Import series roster (keeps existing entries)</button></form>}
      {event?.series_id && <details className="p-4 border rounded"><summary>Link existing racers to series identities</summary><p>Choose matching class/roster records deliberately. The database rejects cross-class links.</p><form action={linkIdentity} className="space-y-3"><label>Event racer<select name="entry_id" className="block p-3 bg-slate-900 border rounded">{entries.map(e=><option key={e.id} value={e.id}>{e.display_name} · {classes.find(c=>c.id===e.event_class_id)?.name}</option>)}</select></label><label>Series roster identity<select name="roster_id" className="block p-3 bg-slate-900 border rounded">{rosters.map(r=><option key={r.id} value={r.id}>{r.display_name} · {r.series_class_id}</option>)}</select></label><button className="p-3 border rounded">Link identity</button></form></details>}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Manage Roster</h2>
        <div className="flex items-center space-x-3">
          <Link 
            href={`/dashboard/tracks/${trackId}/events/${eventId}/classes/new`}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-4 py-2 rounded-lg transition"
          >
            <span>Add Class</span>
          </Link>
          <Link 
            href={`/dashboard/tracks/${trackId}/events/${eventId}/scoring`}
            className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-4 py-2 rounded-lg transition"
          >
            <Timer className="w-4 h-4" />
            <span>Scoring Workspace</span>
          </Link>
        </div>
      </div>

      {error && error !== 'duplicate_order' && <p role="alert" className="text-red-400">{error}</p>}
      {error === 'duplicate_order' && (
        <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg flex items-center space-x-3 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-bold">Error: Another contestant in that class already has that exact Draw / Order Number. Please pick a different number.</span>
        </div>
      )}

      <div>
        <form action={addEntry} className="space-y-4 bg-slate-900 p-5 border border-slate-800 rounded-xl">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-[2]">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Display Name / Number</label>
              <input name="display_name" required className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Draw Order (Opt)</label>
              <input name="draw_number" type="number" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm" placeholder="Auto" />
            </div>
            <div className="flex-[2]">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Class</label>
              <select name="event_class_id" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm">
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-lg text-sm w-full transition">
            Add to Roster
          </button>
        </form>
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
                    <div key={entry.id} className="p-3 flex items-center justify-between hover:bg-slate-800/30 transition">
                      <div className="flex items-center space-x-4">
                        <InlineOrderInput entryId={entry.id} defaultOrder={entry.order_num} updateAction={updateOrderAction} />
                        <span className="text-white font-medium text-sm">{entry.display_name}</span>
                      </div>
                      <form action={deleteEntry}>
                        <input type="hidden" name="entry_id" value={entry.id} />
                        <button type="submit" className="text-slate-500 hover:text-red-500 transition p-1.5 rounded bg-slate-800 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/30">
                          <Trash2 className="w-4 h-4" />
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
