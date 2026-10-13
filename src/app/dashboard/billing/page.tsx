import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CreditCard, Zap, Check } from "lucide-react";
import { displayPrice } from "@/lib/billing/catalog";

type AccountOverview = {
  user_id: string;
  email: string;
  full_name: string | null;
  active_tier: string;
  remaining_credits: number;
  subscription_end_date: string | null;
  limits_exempt: boolean;
  season_active: boolean;
  tracks: { id: string; name: string; slug: string }[];
  series: { id: string; name: string }[];
  organizations: { id: string; name: string }[];
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; canceled?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: overviewData, error: overviewError } = await supabase.rpc("account_billing_overview");

  let overview: AccountOverview;
  if (!overviewError && overviewData) {
    overview = overviewData as unknown as AccountOverview;
  } else {
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    overview = {
      user_id: user.id,
      email: user.email || "",
      full_name: profile?.full_name || null,
      active_tier: profile?.active_tier || "free",
      remaining_credits: profile?.event_quota || 0,
      subscription_end_date: profile?.subscription_end_date || null,
      limits_exempt: profile?.limits_exempt || false,
      season_active: !!(
        profile?.limits_exempt ||
        (profile?.subscription_end_date && new Date(profile.subscription_end_date) > new Date())
      ),
      tracks: [],
      series: [],
      organizations: [],
    };
  }

  const primaryOrgId = overview.organizations?.[0]?.id || "";

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-12 pb-24">
      <div>
        <h1 className="text-3xl font-extrabold text-white flex items-center space-x-3">
          <CreditCard className="w-8 h-8 text-amber-500" />
          <span>Billing & Access</span>
        </h1>
        <p className="text-slate-400 mt-2">
          Manage access across your tracks and series. Purchases are one-time; season passes do not renew automatically. Buying a different season plan replaces your current season plan. Buying the same plan adds one year. Event Passes preserve your season plan.
        </p>
      </div>

      {params.error && <p role="alert" className="text-red-400">{params.error}</p>}
      {params.success && (
        <p role="status" className="text-emerald-400">
          Payment received. Your access updates after payment confirmation; refresh if it is still processing.
        </p>
      )}
      {params.canceled && <p role="status" className="text-slate-400">Checkout canceled. No purchase was completed.</p>}

      <div className="space-y-12">
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="p-6 sm:p-10 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {overview.full_name ? `${overview.full_name}'s Account` : overview.email}
              </h2>

              <div className="flex flex-wrap items-center gap-4">
                <span
                  className={`px-4 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase border ${
                    overview.active_tier === "premium"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : overview.active_tier === "standard"
                      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      : "bg-slate-800 text-slate-300 border-slate-700"
                  }`}
                >
                  {overview.active_tier.replace("_", " ")} Plan
                </span>

                {!overview.limits_exempt && !overview.season_active ? (
                  <span className="text-slate-400 text-sm font-medium flex items-center">
                    <span className="w-2 h-2 rounded-full bg-slate-500 mr-2"></span>
                    {overview.remaining_credits} event passes remaining
                  </span>
                ) : (
                  <span className="text-emerald-400 text-sm font-medium flex items-center">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
                    {overview.limits_exempt
                      ? "Limits waived by admin"
                      : "Season Pass · Expires " +
                        new Date(overview.subscription_end_date!).toLocaleDateString("en-US", {
                          timeZone: "UTC",
                        })}
                  </span>
                )}
              </div>

              {(overview.tracks.length > 0 || overview.series.length > 0) && (
                <div className="text-xs text-slate-400 mt-4">
                  <span className="font-semibold text-slate-300">Associated Assets: </span>
                  {overview.tracks.map((t) => t.name).concat(overview.series.map((s) => s.name)).join(" · ")}
                </div>
              )}
            </div>
          </div>

          <div className="p-6 sm:p-10 bg-slate-950">
            {!overview.season_active && overview.subscription_end_date && (
              <p role="status" className="mb-4 text-amber-400">
                Season Pass expired on{" "}
                {new Date(overview.subscription_end_date).toLocaleDateString("en-US", {
                  timeZone: "UTC",
                })}
                . Existing records stay available to you. Renew or use an Event Pass to begin another race.
              </p>
            )}

            <h3 className="text-xl font-bold text-white mb-6">Upgrade your plan</h3>
            <div className="grid md:grid-cols-3 gap-6">
              {/* Event Pass */}
              <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col hover:border-slate-600 transition">
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-white mb-2">Event Pass</h4>
                  <p className="text-slate-400 text-sm mb-6">Perfect for single events or one-off races.</p>
                  <div className="text-3xl font-black text-white mb-6">
                    {displayPrice("event_pass")} <span className="text-sm font-medium text-slate-500">/ event</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-start text-sm text-slate-300">
                      <Check className="w-4 h-4 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Adds 1 credit, used when an event first goes live
                    </li>
                    <li className="flex items-start text-sm text-slate-300">
                      <Check className="w-4 h-4 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Supports 1 Track & 1 Series
                    </li>
                    <li className="flex items-start text-sm text-slate-300">
                      <Check className="w-4 h-4 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Public results for 30 days after completion
                    </li>
                  </ul>
                </div>
                <form action="/api/checkout" method="POST">
                  {primaryOrgId && <input type="hidden" name="orgId" value={primaryOrgId} />}
                  <input type="hidden" name="tier" value="event_pass" />
                  <button
                    type="submit"
                    className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition"
                  >
                    Buy Event Pass
                  </button>
                </form>
              </div>

              {/* Standard */}
              <div className="relative bg-slate-900 border-2 border-blue-500/30 rounded-2xl p-6 flex flex-col hover:border-blue-500/50 transition">
                <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-3">
                  <span className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                    POPULAR
                  </span>
                </div>
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-white mb-2">Standard</h4>
                  <p className="text-slate-400 text-sm mb-6">For dedicated Track owners OR Series promoters.</p>
                  <div className="text-3xl font-black text-white mb-6">
                    {displayPrice("standard")} <span className="text-sm font-medium text-slate-500">/ season</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-start text-sm text-slate-300">
                      <Check className="w-4 h-4 text-blue-500 mr-2 shrink-0 mt-0.5" /> Unlimited Events
                    </li>
                    <li className="flex items-start text-sm text-slate-300">
                      <Check className="w-4 h-4 text-blue-500 mr-2 shrink-0 mt-0.5" /> Up to 3 Tracks OR 3 Series
                    </li>
                    <li className="flex items-start text-sm text-slate-300">
                      <Check className="w-4 h-4 text-blue-500 mr-2 shrink-0 mt-0.5" /> Extended calendar-year archiving
                    </li>
                  </ul>
                </div>
                <form action="/api/checkout" method="POST">
                  {primaryOrgId && <input type="hidden" name="orgId" value={primaryOrgId} />}
                  <input type="hidden" name="tier" value="standard" />
                  <button
                    type="submit"
                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                  >
                    Buy Standard Season Pass
                  </button>
                </form>
              </div>

              {/* Premium */}
              <div className="relative bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-6 flex flex-col hover:border-amber-500 transition shadow-[0_0_30px_rgba(245,158,11,0.1)]">
                <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-3">
                  <span className="bg-amber-500 text-amber-950 text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center">
                    <Zap className="w-3 h-3 mr-1" /> PRO
                  </span>
                </div>
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-white mb-2">Premium</h4>
                  <p className="text-slate-400 text-sm mb-6">The ultimate package for managing both tracks and series.</p>
                  <div className="text-3xl font-black text-white mb-6">
                    {displayPrice("premium")} <span className="text-sm font-medium text-slate-500">/ season</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-start text-sm text-slate-300">
                      <Check className="w-4 h-4 text-amber-500 mr-2 shrink-0 mt-0.5" /> Unlimited Events
                    </li>
                    <li className="flex items-start text-sm text-slate-300">
                      <Check className="w-4 h-4 text-amber-500 mr-2 shrink-0 mt-0.5" /> Up to 3 Tracks AND 3 Series
                    </li>
                    <li className="flex items-start text-sm text-slate-300">
                      <Check className="w-4 h-4 text-amber-500 mr-2 shrink-0 mt-0.5" /> Full ecosystem integration
                    </li>
                  </ul>
                </div>
                <form action="/api/checkout" method="POST">
                  {primaryOrgId && <input type="hidden" name="orgId" value={primaryOrgId} />}
                  <input type="hidden" name="tier" value="premium" />
                  <button
                    type="submit"
                    className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-xl transition shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                  >
                    Buy Premium Season Pass
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
