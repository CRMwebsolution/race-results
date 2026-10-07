import { readAll } from "@/lib/read-all";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NewSeriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  // Fetch user's organizations
  const { data: myOrgs } = await readAll(supabase
    .from("organization_memberships")
    .select("organization_id, organizations(name)")
    .order("created_at", { ascending: false }));

  const orgList = myOrgs?.map(o => ({
    id: o.organization_id,
    name: (o.organizations as any).name
  })) || [];

  async function createSeries(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || "";
    const orgId = formData.get("organization_id") as string;
    const orgName = (formData.get("org_name") as string) || "";
    
    const supabase = await createClient();

    const isNewOrg = orgId === "new_org";

    const { data, error } = await supabase.rpc("create_series_with_organization", {
      p_series_name: name,
      p_series_description: description,
      p_org_id: isNewOrg ? undefined : orgId,
      p_org_name: isNewOrg ? orgName : undefined,
    });

    if (error || !data) {
      console.error("Failed to create series:", error);
      redirect(`/dashboard/series/new?error=${encodeURIComponent(error?.message || "Failed to create series")}`);
    }

    const seriesId = (data as any).series_id;
    revalidatePath(`/dashboard`);
    redirect(`/dashboard/series/${seriesId}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4 sm:p-8">
      <div className="flex items-center space-x-3">
        <Link 
          href={`/dashboard`}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Create Series</h1>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}
      
      <form action={createSeries} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Series Name</label>
          <input 
            name="name"
            required
            type="text" 
            placeholder="e.g. 2026 Southern Mud Tour"
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
          />
        </div>
        
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Description (Optional)</label>
          <textarea 
            name="description"
            placeholder="e.g. The premier mud racing tour across the southeast."
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
            rows={3}
          />
        </div>

        {orgList.length === 0 ? (
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Promoter / Organization Name</label>
            <p className="text-[11px] text-slate-500 mb-2">You don&apos;t have an organization yet. We&apos;ll create one for you to host this series under.</p>
            <input type="hidden" name="organization_id" value="new_org" />
            <input 
              name="org_name"
              required
              type="text" 
              placeholder="e.g. RedLine Mud Racing Series"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Owning Organization</label>
            <select 
              name="organization_id" 
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
              required
            >
              {orgList.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>
        )}
        
        <div className="pt-4 mt-4 border-t border-slate-800 flex justify-end">
          <button 
            type="submit" 
            className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-6 py-2.5 rounded-xl transition"
          >
            Create Series
          </button>
        </div>
      </form>
    </div>
  );
}
