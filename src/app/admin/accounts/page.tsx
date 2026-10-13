import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserPlus, Gift, ShieldAlert, Search } from "lucide-react";
import { AdminDeleteButton } from "@/components/admin/admin-delete-button";

async function grantAccountAccess(form: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) redirect("/dashboard");

  const userId = String(form.get("userId") || "");
  const tier = String(form.get("tier") || "free");
  const quota = Number(form.get("credits"));
  const expiry = String(form.get("expires") || "");
  const reason = String(form.get("reason") || "").trim();
  const exempt = form.get("exempt") === "on";

  if (!userId) redirect("/admin/accounts?error=Missing+user+account+ID");
  if (!Number.isSafeInteger(quota) || quota < 0) {
    redirect("/admin/accounts?error=Enter+a+whole+number+of+credits");
  }
  if (!reason) {
    redirect("/admin/accounts?error=Please+provide+a+reason+for+this+grant");
  }

  const expires = expiry ? new Date(expiry + "T23:59:59Z") : null;
  if (expires && !Number.isFinite(expires.valueOf())) {
    redirect("/admin/accounts?error=Choose+a+valid+expiration+date");
  }

  const { error } = await supabase.rpc("admin_grant_account_entitlement", {
    p_user_id: userId,
    p_tier: tier,
    p_quota: quota,
    p_end_date: expires ? expires.toISOString() : null,
    p_reason: reason,
    p_limits_exempt: exempt,
  });

  if (error) {
    redirect("/admin/accounts?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/", "layout");
  redirect("/admin/accounts?success=Account+access+updated+successfully");
}

async function createAccountAction(form: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) redirect("/dashboard");

  const email = String(form.get("email") || "").trim().toLowerCase();
  const fullName = String(form.get("fullName") || "").trim();
  const phone = String(form.get("phone") || "").trim();
  const tier = String(form.get("tier") || "free");
  const credits = Number(form.get("credits") || 0);
  const deliveryMode = String(form.get("deliveryMode") || "invite");
  const tempPassword = String(form.get("tempPassword") || "").trim();

  if (!email || !email.includes("@")) {
    redirect("/admin/accounts?error=Valid+email+address+is+required");
  }

  const adminClient = createAdminClient();
  let createdUserId: string | null = null;

  try {
    if (deliveryMode === "password") {
      if (!tempPassword || tempPassword.length < 6) {
        redirect("/admin/accounts?error=Temporary+password+must+be+at+least+6+characters");
      }
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName || null,
          phone: phone || null,
        },
      });
      if (error) throw error;
      createdUserId = data.user.id;
    } else {
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName || null,
          phone: phone || null,
        },
      });
      if (error) throw error;
      createdUserId = data.user.id;
    }
  } catch (err: any) {
    console.error("Failed to create user account:", err);
    redirect("/admin/accounts?error=" + encodeURIComponent(err.message || "Failed to create user account"));
  }

  // If initial credits or tier were set, apply them to the new account
  if (createdUserId && (credits > 0 || tier !== "free")) {
    const { error: grantErr } = await supabase.rpc("admin_grant_account_entitlement", {
      p_user_id: createdUserId,
      p_tier: tier,
      p_quota: credits,
      p_end_date: tier in ["standard", "premium"] ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null,
      p_reason: "Initial account creation grant by admin",
      p_limits_exempt: false,
    });
    if (grantErr) {
      console.warn("User created, but initial grant failed:", grantErr);
    }
  }

  revalidatePath("/", "layout");
  redirect("/admin/accounts?success=Account+created+successfully+for+" + encodeURIComponent(email));
}

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_platform_admin");
  if (adminError || !isAdmin) redirect("/dashboard");

  const query = (params.q || "").toLowerCase().trim();

  // Fetch accounts/profiles
  let profilesQuery = supabase
    .from("profiles")
    .select(`
      id,
      email,
      full_name,
      phone,
      active_tier,
      event_quota,
      subscription_end_date,
      limits_exempt,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (query) {
    profilesQuery = profilesQuery.or(`email.ilike.%${query}%,full_name.ilike.%${query}%,phone.ilike.%${query}%`);
  }

  const { data: profiles, error: profilesError } = await profilesQuery;

  // Fetch owned tracks & series for context
  const { data: tracks } = await supabase.from("tracks").select("id, name, slug, organization_id");
  const { data: seriesList } = await supabase.from("series").select("id, name, organization_id");
  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select("organization_id, user_id, role")
    .eq("role", "owner");

  // Map user_id to owned tracks & series
  const userOrgMap = new Map<string, Set<string>>();
  for (const m of memberships || []) {
    if (!userOrgMap.has(m.user_id)) userOrgMap.set(m.user_id, new Set());
    userOrgMap.get(m.user_id)!.add(m.organization_id);
  }

  const userTracksMap = new Map<string, string[]>();
  const userSeriesMap = new Map<string, string[]>();

  for (const [userId, orgIds] of userOrgMap.entries()) {
    const userTracks = (tracks || [])
      .filter((t) => orgIds.has(t.organization_id))
      .map((t) => t.name);
    const userSeries = (seriesList || [])
      .filter((s) => orgIds.has(s.organization_id))
      .map((s) => s.name);

    if (userTracks.length > 0) userTracksMap.set(userId, userTracks);
    if (userSeries.length > 0) userSeriesMap.set(userId, userSeries);
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <div>
        <h1 className="text-3xl font-extrabold text-white flex items-center space-x-3">
          <Gift className="w-8 h-8 text-amber-500" />
          <span>Accounts & Credits</span>
        </h1>
        <p className="text-slate-400 mt-2">
          Manage user accounts, view active plans, create accounts on behalf of promoters, and donate starter event credits directly to accounts.
        </p>
      </div>

      {params.error && (
        <div className="p-4 bg-red-950/60 border border-red-800 text-red-200 rounded-2xl flex items-center space-x-3">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
          <p>{params.error}</p>
        </div>
      )}

      {params.success && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800 text-emerald-200 rounded-2xl">
          {params.success}
        </div>
      )}

      {/* CREATE NEW ACCOUNT SECTION */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <h2 className="text-xl font-bold text-white flex items-center space-x-2 mb-2">
          <UserPlus className="w-5 h-5 text-amber-400" />
          <span>Create New Account</span>
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          Manually register a user account for a promoter, with optional starter credits or complimentary season pass.
        </p>

        <form action={createAccountAction} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="promoter@speedway.com"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Full Name
            </label>
            <input
              type="text"
              name="fullName"
              placeholder="John Smith"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              placeholder="(704) 555-0199"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Initial Plan Tier
            </label>
            <select
              name="tier"
              defaultValue="free"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
            >
              <option value="free">Free</option>
              <option value="event_pass">Event Pass</option>
              <option value="standard">Standard Season Pass</option>
              <option value="premium">Premium Season Pass</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Initial Starter Credits
            </label>
            <input
              type="number"
              name="credits"
              min="0"
              step="1"
              defaultValue="0"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Account Activation
            </label>
            <select
              name="deliveryMode"
              defaultValue="invite"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
            >
              <option value="invite">Send Email Invite Link</option>
              <option value="password">Set Temporary Password</option>
            </select>
          </div>

          <div className="md:col-span-2 lg:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Temporary Password (if selected above)
            </label>
            <input
              type="text"
              name="tempPassword"
              placeholder="e.g. Raceholler2026!"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl transition shadow-lg flex items-center justify-center space-x-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Account</span>
            </button>
          </div>
        </form>
      </section>

      {/* ACCOUNTS DIRECTORY */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-bold text-white">
            Promoter Accounts ({profiles?.length || 0})
          </h2>

          <form method="GET" className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              name="q"
              defaultValue={params.q || ""}
              placeholder="Search email, name, phone..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </form>
        </div>

        {profilesError && (
          <p className="text-red-400 text-sm">Failed to load profiles: {profilesError.message}</p>
        )}

        <div className="space-y-4">
          {profiles?.map((profile) => {
            const ownedTracks = userTracksMap.get(profile.id) || [];
            const ownedSeries = userSeriesMap.get(profile.id) || [];

            return (
              <div
                key={profile.id}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-md transition hover:border-slate-700 space-y-4"
              >
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-lg font-bold text-white">
                        {profile.full_name || profile.email}
                      </span>
                      {profile.full_name && (
                        <span className="text-sm text-slate-400">({profile.email})</span>
                      )}
                      {profile.phone && (
                        <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md font-mono">
                          {profile.phone}
                        </span>
                      )}
                      <span
                        className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                          profile.active_tier === "premium"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : profile.active_tier === "standard"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                            : "bg-slate-800 text-slate-300 border-slate-700"
                        }`}
                      >
                        {profile.active_tier.replace("_", " ")}
                      </span>
                    </div>

                    <div className="text-xs font-mono text-slate-500 mt-1">
                      ID: {profile.id}
                    </div>

                    <div className="text-sm text-slate-400 mt-2 flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-amber-400">
                        {profile.event_quota} credits available
                      </span>
                      {profile.subscription_end_date && (
                        <span>
                          · Expires:{" "}
                          {new Date(profile.subscription_end_date).toLocaleDateString("en-US", {
                            timeZone: "UTC",
                          })}
                        </span>
                      )}
                      {profile.limits_exempt && (
                        <span className="text-emerald-400 font-medium">· Limits waived</span>
                      )}
                    </div>

                    <div className="text-xs text-slate-400 mt-2">
                      {ownedTracks.length > 0 && (
                        <span className="mr-3">
                          🏁 <strong className="text-slate-300">Tracks:</strong>{" "}
                          {ownedTracks.join(", ")}
                        </span>
                      )}
                      {ownedSeries.length > 0 && (
                        <span>
                          🏆 <strong className="text-slate-300">Series:</strong>{" "}
                          {ownedSeries.join(", ")}
                        </span>
                      )}
                      {ownedTracks.length === 0 && ownedSeries.length === 0 && (
                        <span className="text-slate-500 italic">No tracks or series created yet</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <AdminDeleteButton
                      itemType="account"
                      itemId={profile.id}
                      expectedName={profile.email}
                      itemLabel={profile.full_name ? `${profile.full_name} (${profile.email})` : profile.email}
                      buttonLabel="Delete Account"
                    />
                  </div>
                </div>

                {/* INLINE DONATION / GRANT FORM */}
                <div className="pt-4 border-t border-slate-800/80">
                  <form action={grantAccountAccess} className="flex flex-wrap items-end gap-3 text-xs">
                    <input type="hidden" name="userId" value={profile.id} />

                    <div>
                      <label className="block font-semibold text-slate-400 mb-1">Plan</label>
                      <select
                        name="tier"
                        defaultValue={profile.active_tier}
                        className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="free">Free</option>
                        <option value="event_pass">Event Pass</option>
                        <option value="standard">Standard</option>
                        <option value="premium">Premium</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-400 mb-1">Credits</label>
                      <input
                        type="number"
                        name="credits"
                        min="0"
                        step="1"
                        defaultValue={profile.event_quota}
                        required
                        className="w-20 bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-400 mb-1">Expires (UTC)</label>
                      <input
                        type="date"
                        name="expires"
                        defaultValue={profile.subscription_end_date?.slice(0, 10)}
                        className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 pb-2">
                      <input
                        type="checkbox"
                        name="exempt"
                        id={`exempt-${profile.id}`}
                        defaultChecked={profile.limits_exempt}
                        className="rounded bg-slate-950 border-slate-700 text-amber-500"
                      />
                      <label htmlFor={`exempt-${profile.id}`} className="text-slate-300">
                        Waive limits
                      </label>
                    </div>

                    <div className="flex-1 min-w-[200px]">
                      <label className="block font-semibold text-slate-400 mb-1">Reason *</label>
                      <input
                        type="text"
                        name="reason"
                        required
                        placeholder="e.g. Free starter trial credits"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <button
                      type="submit"
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-lg transition"
                    >
                      Save Access
                    </button>
                  </form>
                </div>
              </div>
            );
          })}

          {profiles && profiles.length === 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
              No promoter accounts found matching your query.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
