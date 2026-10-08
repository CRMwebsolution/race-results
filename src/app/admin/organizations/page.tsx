import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function grantAccess(form: FormData) {
  "use server";
  const supabase = await createClient();
  const expiry = String(form.get("expires") || "");
  const quota = Number(form.get("credits"));
  const expires=expiry ? new Date(expiry + "T23:59:59Z") : null;
  if(expires && !Number.isFinite(expires.valueOf())) redirect("/admin/organizations?error=Choose+a+valid+expiration+date");
  if (!Number.isSafeInteger(quota) || quota < 0) redirect("/admin/organizations?error=Enter+a+whole+number+of+credits");
  const { error } = await supabase.rpc("admin_grant_entitlement", {
    p_org_id: String(form.get("orgId")), p_tier: String(form.get("tier")),
    p_quota: quota, p_end_date: (expires?.toISOString() || null) as any,
    p_reason: String(form.get("reason") || ""), p_limits_exempt: form.get("exempt") === "on",
  });
  if (error) redirect("/admin/organizations?error=" + encodeURIComponent(error.message));
  revalidatePath("/", "layout");
  redirect("/admin/organizations?success=Access+updated");
}

export default async function AdminOrganizationsPage({ searchParams }: { searchParams: Promise<{error?: string; success?: string}> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: admin, error: adminError } = await supabase.rpc("is_platform_admin");
  if (adminError || !admin) redirect("/dashboard");
  const { data: orgs, error } = await supabase.from("organizations")
    .select("id,name,active_tier,event_quota,subscription_end_date,limits_exempt,tracks(id,name),series(id,name)").order("name");
  return <div className="space-y-6 max-w-5xl mx-auto">
    <h1 className="text-2xl font-bold">Account access</h1>
    <p>Grant plans without payment across the owning account’s tracks and series. These grants are recorded with your reason.</p>
    {(params.error || error) && <p role="alert" className="text-red-400">{params.error || error?.message}</p>}
    {params.success && <p role="status" className="text-emerald-400">{params.success}</p>}
    {orgs?.map(org => <section key={org.id} className="rounded-xl border border-slate-700 p-5 space-y-3">
      <h2 className="font-bold text-xl">{org.name}</h2>
      <p>{org.tracks.map(t => t.name).concat(org.series.map(s => s.name)).join(" · ") || "No assets yet"}</p>
      <p>{org.active_tier.replace("_"," ")} · {org.event_quota} credits remaining
        {org.subscription_end_date && " · Expires " + new Date(org.subscription_end_date).toLocaleDateString("en-US", {timeZone:"UTC"})}
        {org.limits_exempt && " · Limits waived"}</p>
      <form action={grantAccess} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="orgId" value={org.id}/>
        <label>Plan<select name="tier" defaultValue={org.active_tier} className="block rounded border p-2 bg-slate-800 text-white">
          <option value="free">Free</option><option value="event_pass">Event Pass</option>
          <option value="standard">Standard</option><option value="premium">Premium</option>
        </select></label>
        <label>Remaining credits<input className="block rounded border p-2 bg-slate-800 text-white" name="credits" type="number" min="0" step="1" defaultValue={org.event_quota} required/></label>
        <label>Expires (UTC)<input className="block rounded border p-2 bg-slate-800 text-white" name="expires" type="date" defaultValue={org.subscription_end_date?.slice(0,10)}/></label>
        <label className="flex gap-2"><input type="checkbox" name="exempt" defaultChecked={org.limits_exempt}/>Waive event and asset limits</label>
        <label>Reason<input className="block rounded border p-2 bg-slate-800 text-white" name="reason" required placeholder="Why access is being granted"/></label>
        <button className="rounded bg-amber-500 text-black px-4 py-2 font-bold">Save access</button>
      </form>
    </section>)}
  </div>;
}
