import { readAll } from "@/lib/read-all";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreateSeriesForm } from "./create-series-form";

export default async function NewSeriesPage() {
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
    
    const db = await createClient();
    const isNewOrg = orgId === "new_org";

    const { data, error } = await db.rpc("create_series_with_organization", {
      p_series_name: name,
      p_series_description: description,
      p_org_id: isNewOrg ? undefined : orgId,
      p_org_name: isNewOrg ? orgName : undefined,
    });

    if (error || !data) {
      console.error("Failed to create series:", error);
      return { error: error?.message || "Failed to create series" };
    }

    const seriesId = (data as any).series_id;
    revalidatePath("/dashboard");
    redirect("/dashboard/series/" + seriesId);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-8">
      <div className="flex items-center space-x-3 mb-8">
        <Link 
          href="/dashboard"
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Create Series</h1>
      </div>

      <CreateSeriesForm orgList={orgList} action={createSeries} />
    </div>
  );
}
