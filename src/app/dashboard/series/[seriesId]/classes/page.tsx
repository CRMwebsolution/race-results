import { readAll } from "@/lib/read-all";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ArrowLeft, Plus, Edit2, Save, X, Trash2 } from "lucide-react";
import { redirect } from "next/navigation";

export default async function SeriesClassesPage(props: { params: Promise<{ seriesId: string }>, searchParams: Promise<{ edit_class_id?: string; error?: string }> }) {
  const { seriesId } = await props.params;
  const searchParams = await props.searchParams;
  const actionParams = searchParams;
  const editClassId = searchParams?.edit_class_id;
  
  const supabase = await createClient();

  const { data: series } = await supabase.from("series").select("*").eq("id", seriesId).single();
  
  const { data: classes } = await readAll(supabase
    .from("series_classes")
    .select("*")
    .eq("series_id", seriesId)
    .order("order_num", { ascending: true }));

  const classToEdit = classes?.find(c => c.id === editClassId);

  async function addMasterClass(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const entryFeeText = formData.get("entry_fee_text") as string;
    const rulesText = formData.get("rules_text") as string;
    
    const supabase = await createClient();
    
    const { data: existing } = await supabase.from("series_classes").select("order_num").eq("series_id", seriesId).order("order_num", { ascending: false }).limit(1);
    const nextOrder = existing && existing.length > 0 ? existing[0].order_num + 1 : 1;
    
    const { error: mutationError } = await supabase.from("series_classes").insert({
      series_id: seriesId,
      name,
      entry_fee_text: entryFeeText || null,
      rules_text: rulesText || null,
      order_num: nextOrder
    });
    if (mutationError) redirect(`/dashboard/series/${seriesId}/classes?error=${encodeURIComponent(mutationError.message)}`);
    
    revalidatePath(`/dashboard/series/${seriesId}/classes`);
    revalidatePath(`/dashboard/series/${seriesId}`);
  }

  async function updateMasterClass(formData: FormData) {
    "use server";
    const id = formData.get("class_id") as string;
    const name = formData.get("name") as string;
    const entryFeeText = formData.get("entry_fee_text") as string;
    const rulesText = formData.get("rules_text") as string;
    
    const supabase = await createClient();
    
    const { error: mutationError } = await supabase.from("series_classes").update({
      name,
      entry_fee_text: entryFeeText || null,
      rules_text: rulesText || null,
    }).eq("id", id).eq("series_id", seriesId);
    if (mutationError) redirect(`/dashboard/series/${seriesId}/classes?error=${encodeURIComponent(mutationError.message)}`);
    
    revalidatePath(`/dashboard/series/${seriesId}/classes`);
    revalidatePath(`/dashboard/series/${seriesId}`);
    redirect(`/dashboard/series/${seriesId}/classes`);
  }

  async function deleteMasterClass(formData: FormData) {
    "use server";
    const id = formData.get("class_id") as string;
    const supabase = await createClient();

    const { error: mutationError } = await supabase.from("series_classes").delete().eq("id", id).eq("series_id", seriesId);
    if (mutationError) redirect(`/dashboard/series/${seriesId}/classes?error=${encodeURIComponent(mutationError.message)}`);

    revalidatePath(`/dashboard/series/${seriesId}/classes`);
    revalidatePath(`/dashboard/series/${seriesId}`);
    redirect(`/dashboard/series/${seriesId}/classes`);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-8">
      {actionParams.error && <p role="alert" className="p-4 text-red-300 bg-red-950 rounded">{actionParams.error}</p>}
      <div className="flex items-center space-x-3">
        <Link 
          href={`/dashboard/series/${seriesId}`}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Master Classes</h1>
          <p className="text-sm text-slate-400">{series?.name}</p>
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="font-bold text-lg text-white">Configured Classes</h2>
          
          {classes?.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl text-center text-slate-400">
              No master classes defined. Add one to the right.
            </div>
          ) : (
            <div className="space-y-3">
              {classes?.map(cls => (
                <div key={cls.id} className={`border p-4 rounded-xl flex flex-col space-y-3 transition ${editClassId === cls.id ? 'bg-slate-800 border-amber-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-200">{cls.name}</h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      {cls.entry_fee_text && (
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 mr-1">
                          {cls.entry_fee_text}
                        </span>
                      )}
                      <Link 
                        href={`/dashboard/series/${seriesId}/classes?edit_class_id=${cls.id}`}
                        className="p-1.5 text-slate-500 hover:text-amber-400 transition rounded hover:bg-slate-800"
                        title="Edit Class"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      <form action={deleteMasterClass}>
                        <input type="hidden" name="class_id" value={cls.id} />
                        <button
                          type="submit"
                          className="p-1.5 text-slate-500 hover:text-red-400 transition rounded hover:bg-slate-800"
                          title="Delete Class"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </form>
                    </div>
                  </div>
                  {cls.rules_text && (
                    <div className="text-xs text-slate-400 bg-slate-950 p-2 rounded border border-slate-800">
                      <strong>Rules:</strong> {cls.rules_text}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div>
          <form action={editClassId ? updateMasterClass : addMasterClass} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 sticky top-24">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-lg text-white flex items-center space-x-2">
                {editClassId ? <Edit2 className="w-4 h-4 text-amber-500" /> : <Plus className="w-4 h-4 text-amber-500" />}
                <span>{editClassId ? 'Edit Master Class' : 'Add Master Class'}</span>
              </h2>
              {editClassId && (
                <Link href={`/dashboard/series/${seriesId}/classes`} className="text-slate-500 hover:text-slate-300">
                  <X className="w-5 h-5" />
                </Link>
              )}
            </div>
            
            {editClassId && <input type="hidden" name="class_id" value={editClassId} />}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Class Name</label>
              <input 
                name="name" 
                defaultValue={classToEdit?.name || ""}
                required 
                placeholder="e.g. Pro Mod"
                className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Entry Fee (Optional)</label>
              <input 
                name="entry_fee_text" 
                defaultValue={classToEdit?.entry_fee_text || ""}
                placeholder="e.g. $50 or $50 + $10 Insurance"
                className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Class Rules / Notes (Optional)</label>
              <textarea 
                name="rules_text" 
                defaultValue={classToEdit?.rules_text || ""}
                placeholder="e.g. DOT tires only. Helmet required. Max engine size 500cc."
                rows={3}
                className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm"
              />
            </div>
            
            <div className="pt-2 flex items-center space-x-3">
              <button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-4 py-2.5 rounded-lg transition flex items-center justify-center space-x-2">
                {editClassId ? <><Save className="w-4 h-4" /><span>Save Changes</span></> : <span>Create Master Class</span>}
              </button>
            </div>
          </form>
          {editClassId && (
            <form action={deleteMasterClass} className="mt-3">
              <input type="hidden" name="class_id" value={editClassId} />
              <button 
                type="submit" 
                className="w-full bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-900/50 text-xs font-bold px-4 py-2 rounded-lg transition flex items-center justify-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Master Class</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
