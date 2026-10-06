import { readAll } from "@/lib/read-all";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { redirect } from "next/navigation";

export default async function SeriesSettingsPage({ params, searchParams }: { params: Promise<{ seriesId: string }>; searchParams: Promise<{error?: string}> }) {
  const { seriesId } = await params;
  const actionParams = await searchParams;
  const supabase = await createClient();

  const { data: series } = await supabase.from("series").select("*").eq("id", seriesId).single();
  
  if (!series) redirect("/dashboard");

  // Fetch organizations user is a member of to allow ownership transfer
  const { data: memberships } = await readAll(supabase
    .from("organization_memberships")
    .select("organizations(id, name)"));

  async function updateSeries(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const organizationId = formData.get("organization_id") as string;
    
    const supabase = await createClient();
    
    const { error: mutationError } = await supabase.from("series").update({
      name,
      description,
      organization_id: organizationId
    }).eq("id", seriesId);
    if (mutationError) redirect(`/dashboard/series/${seriesId}/settings?error=${encodeURIComponent(mutationError.message)}`);
    
    revalidatePath(`/dashboard/series/${seriesId}`);
    revalidatePath(`/dashboard/series/${seriesId}/settings`);
    redirect(`/dashboard/series/${seriesId}`);
  }

  async function deleteSeries() {
    "use server";
    const supabase = await createClient();
    
    const { error: mutationError } = await supabase.from("series").delete().eq("id", seriesId);
    if (mutationError) redirect(`/dashboard/series/${seriesId}/settings?error=${encodeURIComponent(mutationError.message)}`);
    
    revalidatePath("/dashboard");
    redirect("/dashboard");
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 p-8">
      <div className="flex items-center space-x-3 mb-8">
        <Link 
          href={`/dashboard/series/${seriesId}`}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Series Settings</h1>
          <p className="text-sm text-slate-400">Update series information</p>
        </div>
      </div>
      
      <form action={updateSeries} className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Series Name</label>
          <input 
            name="name" 
            defaultValue={series.name}
            required 
            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition outline-none"
          />
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Public Description / About</label>
          <textarea 
            name="description" 
            defaultValue={series.description || ""}
            rows={4}
            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Series Owner (Organization)</label>
          <select 
            name="organization_id" 
            defaultValue={series.organization_id}
            required 
            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition outline-none"
          >
            {memberships?.map((m: any) => (
              <option key={m.organizations.id} value={m.organizations.id}>
                {m.organizations.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-2">Transferring ownership will move this series to another organization you are a member of.</p>
        </div>
        
        <div className="pt-4 flex justify-end">
          <button type="submit" className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-6 py-3 rounded-xl transition">
            <Save className="w-5 h-5" />
            <span>Save Changes</span>
          </button>
        </div>
      </form>

      <div className="bg-red-950/20 border border-red-900/40 rounded-2xl p-8 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-red-400 flex items-center space-x-2">
            <Trash2 className="w-5 h-5" />
            <span>Danger Zone</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Permanently delete this championship series, including all master classes, points configurations, and rosters.
          </p>
        </div>

        <form action={deleteSeries}>
          <button 
            type="submit" 
            className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-3 rounded-xl transition flex items-center space-x-2 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete This Series</span>
          </button>
        </form>
      </div>
    </div>
  );
}
