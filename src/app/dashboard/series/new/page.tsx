import { readAll } from "@/lib/read-all";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreateSeriesForm } from "./create-series-form";
import { TipBubble } from "@/components/tip-provider";

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

    const pointsMode = (formData.get("points_mode") as string) || "championship";
    const trackPoints = pointsMode !== "none";

    const { data, error } = await db.rpc("create_series_with_organization", {
      p_series_name: name,
      p_series_description: description,
      p_org_id: isNewOrg ? undefined : orgId,
      p_org_name: isNewOrg ? orgName : undefined,
      p_track_points: trackPoints,
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
      <div className="flex items-center space-x-3 mb-4">
        <Link 
          href="/dashboard"
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-white">Create Racing Series</h1>
          <p className="text-sm text-slate-400">Launch a multi-event points championship or traveling racing tour.</p>
        </div>
      </div>

      <TipBubble title="Create Series · Step 2">
        <p className="text-xs text-amber-200/90 leading-relaxed">
          <strong className="text-white">Step 2:</strong> Fill out the creation form below. This establishes the series name and creates the organization running the series. When finished, click <strong className="text-amber-400">&ldquo;Create Series&rdquo;</strong> to open your Series Management Hub.
        </p>
      </TipBubble>

      <CreateSeriesForm orgList={orgList} action={createSeries} />
    </div>
  );
}
