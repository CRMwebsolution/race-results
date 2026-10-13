import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";

async function grantAccess(form: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: admin } = await supabase.rpc("is_platform_admin");
  if (!admin) redirect("/dashboard");

  const expiry = String(form.get("expires") || "");
  const quota = Number(form.get("credits"));
  const expires = expiry ? new Date(expiry + "T23:59:59Z") : null;

  if (expires && !Number.isFinite(expires.valueOf())) {
    redirect("/admin/organizations?error=Choose+a+valid+expiration+date");
  }
  if (!Number.isSafeInteger(quota) || quota < 0) {
    redirect("/admin/organizations?error=Enter+a+whole+number+of+credits");
  }

  const { error } = await supabase.rpc("admin_grant_entitlement", {
    p_org_id: String(form.get("orgId")),
    p_tier: String(form.get("tier")),
    p_quota: quota,
    p_end_date: expires?.toISOString() || null,
    p_reason: String(form.get("reason") || ""),
    p_limits_exempt: form.get("exempt") === "on",
  });

  if (error) redirect("/admin/organizations?error=" + encodeURIComponent(error.message));
  revalidatePath("/", "layout");
  redirect("/admin/organizations?success=Access+updated");
}

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: admin, error: adminError } = await supabase.rpc("is_platform_admin");
  if (adminError || !admin) redirect("/dashboard");

  const { data: orgs, error } = await supabase
    .from("organizations")
    .select(`
      id,
      name,
      billing_email,
      active_tier,
      event_quota,
      subscription_end_date,
      limits_exempt,
      billing_owner_id,
      tracks(id, name),
      series(id, name),
      organization_memberships(role, active, user_id, profiles(email, full_name))
    `)
    .order("name");

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center space-x-3">
            <Building2 className="w-8 h-8 text-amber-500" />
            <span>Organizations</span>
          </h1>
          <p className="text-slate-400 mt-2">
            Inspect organizational entities, affiliated tracks, series, and owner accounts.
          </p>
        </div>

        <Link
          href="/admin/accounts"
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition flex items-center space-x-2 text-sm shadow-md"
        >
          <span>Manage Promoter Accounts</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {(params.error || error) && (
        <p role="alert" className="text-red-400 p-4 bg-red-950/60 border border-red-800 rounded-xl">
          {params.error || error?.message}
        </p>
      )}
      {params.success && (
        <p role="status" className="text-emerald-400 p-4 bg-emerald-950/60 border border-emerald-800 rounded-xl">
          {params.success}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6">
        {orgs?.map((org) => {
          // Find owner profile
          const ownerMembership = (org.organization_memberships as any[])?.find(
            (m) => m.role === "owner" && m.active
          );
          const ownerProfile = ownerMembership?.profiles;

          return (
            <section
              key={org.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                <div>
                  <h2 className="font-bold text-xl text-white">{org.name}</h2>
                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                    <span>Org ID: <span className="font-mono text-slate-500">{org.id}</span></span>
                    {ownerProfile && (
                      <span>
                        · Owner: <strong className="text-slate-200">{ownerProfile.full_name || ownerProfile.email}</strong>
                        {ownerProfile.full_name && ` (${ownerProfile.email})`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                      org.active_tier === "premium"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : org.active_tier === "standard"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                        : "bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    {org.active_tier.replace("_", " ")}
                  </span>
                  <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                    {org.event_quota} credits
                  </span>
                </div>
              </div>

              <div className="text-sm text-slate-300">
                <span className="text-slate-400">Assets: </span>
                {org.tracks.map((t) => t.name).concat(org.series.map((s) => s.name)).join(" · ") || (
                  <span className="text-slate-500 italic">No assets yet</span>
                )}
                {org.subscription_end_date &&
                  " · Expires " +
                    new Date(org.subscription_end_date).toLocaleDateString("en-US", {
                      timeZone: "UTC",
                    })}
                {org.limits_exempt && " · Limits waived"}
              </div>

              <form action={grantAccess} className="flex flex-wrap items-end gap-3 pt-3 border-t border-slate-800 text-xs">
                <input type="hidden" name="orgId" value={org.id} />
                <label className="text-slate-400">
                  Plan
                  <select
                    name="tier"
                    defaultValue={org.active_tier}
                    className="block rounded-lg border border-slate-700 p-2 bg-slate-950 text-white mt-1"
                  >
                    <option value="free">Free</option>
                    <option value="event_pass">Event Pass</option>
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                  </select>
                </label>
                <label className="text-slate-400">
                  Credits
                  <input
                    className="block rounded-lg border border-slate-700 p-2 bg-slate-950 text-white w-20 mt-1"
                    name="credits"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={org.event_quota}
                    required
                  />
                </label>
                <label className="text-slate-400">
                  Expires (UTC)
                  <input
                    className="block rounded-lg border border-slate-700 p-2 bg-slate-950 text-white mt-1"
                    name="expires"
                    type="date"
                    defaultValue={org.subscription_end_date?.slice(0, 10)}
                  />
                </label>
                <label className="flex items-center gap-2 pb-2 text-slate-300">
                  <input
                    type="checkbox"
                    name="exempt"
                    defaultChecked={org.limits_exempt}
                    className="rounded bg-slate-950 border-slate-700 text-amber-500"
                  />
                  Waive limits
                </label>
                <label className="flex-1 min-w-[200px] text-slate-400">
                  Reason
                  <input
                    className="block w-full rounded-lg border border-slate-700 p-2 bg-slate-950 text-white mt-1 placeholder-slate-600"
                    name="reason"
                    required
                    placeholder="Why access is being granted"
                  />
                </label>
                <button className="rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 font-bold transition">
                  Save access
                </button>
              </form>
            </section>
          );
        })}
      </div>
    </div>
  );
}
