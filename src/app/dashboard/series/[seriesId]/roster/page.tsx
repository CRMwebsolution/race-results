import { readAll } from "@/lib/read-all";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ArrowLeft, UserPlus, Trash2, Edit2, Save, X } from "lucide-react";
import { redirect } from "next/navigation";

export default async function SeriesRosterPage(props: { 
  params: Promise<{ seriesId: string }>;
  searchParams: Promise<{ edit_roster_id?: string; error?: string }>;
}) {
  const { seriesId } = await props.params;
  const searchParams = await props.searchParams;
  const actionParams = searchParams;
  const editRosterId = searchParams?.edit_roster_id;

  const supabase = await createClient();

  const { data: series } = await supabase.from("series").select("*").eq("id", seriesId).single();
  
  const { data: classes } = await readAll(supabase
    .from("series_classes")
    .select("*")
    .eq("series_id", seriesId)
    .order("order_num", { ascending: true }));

  const { data: roster } = await readAll(supabase
    .from("series_rosters")
    .select("*, series_classes!series_rosters_class_scope_fkey(name)")
    .eq("series_id", seriesId)
    .order("created_at", { ascending: true }));

  const racerToEdit = roster?.find(r => r.id === editRosterId);

  async function addRacer(formData: FormData) {
    "use server";
    const displayName = formData.get("display_name") as string;
    const seriesClassId = formData.get("series_class_id") as string;
    
    const supabase = await createClient();
    
    const { error: mutationError } = await supabase.from("series_rosters").insert({
      series_id: seriesId,
      series_class_id: seriesClassId,
      display_name: displayName
    });
    if (mutationError) redirect(`/dashboard/series/${seriesId}/roster?error=${encodeURIComponent(mutationError.message)}`);
    
    revalidatePath(`/dashboard/series/${seriesId}/roster`);
  }

  async function updateRacer(formData: FormData) {
    "use server";
    const rosterId = formData.get("roster_id") as string;
    const displayName = formData.get("display_name") as string;
    const seriesClassId = formData.get("series_class_id") as string;
    
    const supabase = await createClient();
    
    const { error: mutationError } = await supabase.from("series_rosters").update({
      display_name: displayName,
      series_class_id: seriesClassId
    }).eq("id", rosterId).eq("series_id", seriesId);
    if (mutationError) redirect(`/dashboard/series/${seriesId}/roster?error=${encodeURIComponent(mutationError.message)}`);
    
    revalidatePath(`/dashboard/series/${seriesId}/roster`);
    redirect(`/dashboard/series/${seriesId}/roster`);
  }

  async function removeRacer(formData: FormData) {
    "use server";
    const rosterId = formData.get("roster_id") as string;
    
    const supabase = await createClient();
    
    const { error: mutationError } = await supabase.from("series_rosters").delete().eq("id", rosterId).eq("series_id", seriesId);
    if (mutationError) redirect(`/dashboard/series/${seriesId}/roster?error=${encodeURIComponent(mutationError.message)}`);
    
    revalidatePath(`/dashboard/series/${seriesId}/roster`);
    redirect(`/dashboard/series/${seriesId}/roster`);
  }

  // Group roster by class
  const classRosters: Record<string, typeof roster> = {};
  classes?.forEach(c => {
    classRosters[c.id] = [];
  });
  
  roster?.forEach(r => {
    if (!classRosters[r.series_class_id]) {
      classRosters[r.series_class_id] = [];
    }
    classRosters[r.series_class_id]?.push(r);
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-8">
      {actionParams.error && <p role="alert" className="p-4 text-red-300 bg-red-950 rounded">{actionParams.error}</p>}
      <div className="flex items-center space-x-3">
        <Link 
          href={`/dashboard/series/${seriesId}`}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Championship Roster</h1>
          <p className="text-sm text-slate-400">{series?.name}</p>
        </div>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          {classes?.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl text-center text-slate-400">
              <p>You must add Master Classes to your series before adding racers.</p>
              <Link href={`/dashboard/series/${seriesId}/classes`} className="inline-block mt-4 text-amber-500 hover:text-amber-400 font-bold">
                Go to Master Classes &rarr;
              </Link>
            </div>
          ) : (
            classes?.map(cls => (
              <div key={cls.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                  <div>
                    <h2 className="font-bold text-lg text-white">{cls.name}</h2>
                    <p className="text-xs text-slate-400">{classRosters[cls.id]?.length || 0} Registered Racers</p>
                  </div>
                </div>
                
                <div className="divide-y divide-slate-800/50">
                  {classRosters[cls.id]?.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-sm">No racers registered for this class.</div>
                  ) : (
                    classRosters[cls.id]?.map(racer => (
                      <div 
                        key={racer.id} 
                        className={`p-4 px-6 flex justify-between items-center transition ${
                          editRosterId === racer.id ? 'bg-slate-800/70 border-l-2 border-amber-500' : 'hover:bg-slate-800/20'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-slate-200">{racer.display_name}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Link 
                            href={`/dashboard/series/${seriesId}/roster?edit_roster_id=${racer.id}`}
                            className="text-slate-500 hover:text-amber-400 transition p-1.5 rounded hover:bg-slate-800"
                            title="Edit Racer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          <form action={removeRacer}>
                            <input type="hidden" name="roster_id" value={racer.id} />
                            <button 
                              type="submit" 
                              className="text-slate-500 hover:text-red-400 transition p-1.5 rounded hover:bg-slate-800"
                              title="Remove Racer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </form>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        <div>
          <form 
            action={editRosterId ? updateRacer : addRacer} 
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 sticky top-24"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-lg text-white flex items-center space-x-2">
                {editRosterId ? <Edit2 className="w-4 h-4 text-amber-500" /> : <UserPlus className="w-4 h-4 text-amber-500" />}
                <span>{editRosterId ? 'Edit Racer' : 'Register Racer'}</span>
              </h2>
              {editRosterId && (
                <Link href={`/dashboard/series/${seriesId}/roster`} className="text-slate-500 hover:text-slate-300">
                  <X className="w-5 h-5" />
                </Link>
              )}
            </div>

            {editRosterId && <input type="hidden" name="roster_id" value={editRosterId} />}
            
            {classes?.length === 0 && (
               <p className="text-xs text-red-400 mb-4">No classes available. Add a class first.</p>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Racer Name</label>
              <input 
                name="display_name" 
                defaultValue={racerToEdit?.display_name || ""}
                required 
                placeholder="e.g. Dale Earnhardt"
                className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-amber-500 outline-none"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Series Class</label>
              <select 
                name="series_class_id" 
                defaultValue={racerToEdit?.series_class_id || (classes?.[0]?.id || "")}
                required 
                disabled={classes?.length === 0}
                className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm disabled:opacity-50 focus:border-amber-500 outline-none"
              >
                {classes?.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>
            
            <div className="pt-2 flex items-center space-x-3">
              <button 
                type="submit" 
                disabled={classes?.length === 0}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-4 py-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {editRosterId ? (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                ) : (
                  <span>Add to Roster</span>
                )}
              </button>
            </div>
          </form>

          {editRosterId && (
            <form action={removeRacer} className="mt-3">
              <input type="hidden" name="roster_id" value={editRosterId} />
              <button
                type="submit"
                className="w-full bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-900/50 text-xs font-bold px-4 py-2 rounded-lg transition flex items-center justify-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove from Roster</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
