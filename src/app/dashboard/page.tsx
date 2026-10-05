import { redirect } from "next/navigation";
import Link from "next/link";
import { Flag, Building2, MapPin, Shield, User, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CreateTrackForm } from "./create-track-form";
import { TenantIsolationVerifier } from "./tenant-isolation-verifier";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Fetch organization memberships with tenant-scoped RLS
  const { data: orgMemberships } = await supabase
    .from("organization_memberships")
    .select(`
      id,
      role,
      active,
      created_at,
      organizations (
        id,
        name,
        billing_email,
        created_at
      )
    `)
    .order("created_at", { ascending: false });

  // 2. Fetch track memberships with tenant-scoped RLS
  const { data: trackMemberships } = await supabase
    .from("track_memberships")
    .select(`
      id,
      role,
      active,
      created_at,
      tracks (
        id,
        organization_id,
        name,
        slug,
        timezone,
        created_at
      )
    `)
    .order("created_at", { ascending: false });

  // 3. Fetch recent audit events accessible to the caller
  const { data: auditLogs } = await supabase
    .from("audit_events")
    .select("id, action, target_type, target_id, created_at, after_data")
    .order("created_at", { ascending: false })
    .limit(5);

  const accessibleOrgIds = (orgMemberships ?? [])
    .map((m) => (m.organizations as { id: string } | null)?.id)
    .filter((id): id is string => Boolean(id));

  return (
    <div className="flex-1 flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                <Flag className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-lg tracking-tight text-white">
                Track<span className="text-amber-500">Score</span>
              </span>
            </Link>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              Phase One Scaffolding
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-400">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-mono">{user.email}</span>
            </div>

            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 space-y-8">
        {/* Welcome Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-amber-950/20 border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Race Official Dashboard
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Authenticated as <span className="text-amber-400 font-mono">{user.email}</span> • Tenant isolation active
              </p>
            </div>
            <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl w-fit">
              <Shield className="w-3.5 h-3.5" />
              <span>Row Level Security Enforced</span>
            </div>
          </div>
        </div>

        {/* Create Track & Organization Form */}
        <CreateTrackForm />

        {/* Tenant Entities: Organizations & Tracks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Organizations Column */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center space-x-2.5 mb-4">
              <Building2 className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-white">Your Organizations</h2>
            </div>

            {!orgMemberships || orgMemberships.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">
                No organizations yet. Register your first track and organization above.
              </p>
            ) : (
              <div className="space-y-3">
                {orgMemberships.map((m) => {
                  const org = m.organizations as {
                    id: string;
                    name: string;
                    billing_email: string;
                    created_at: string;
                  } | null;
                  if (!org) return null;
                  return (
                    <div
                      key={m.id}
                      className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-semibold text-white text-sm">{org.name}</h4>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          {org.billing_email}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono mt-1">
                          ID: {org.id}
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 capitalize">
                        {m.role}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tracks Column */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center space-x-2.5 mb-4">
              <MapPin className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-white">Your Tracks & Venues</h2>
            </div>

            {!trackMemberships || trackMemberships.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">
                No tracks configured yet. Add your first track using the form above.
              </p>
            ) : (
              <div className="space-y-3">
                {trackMemberships.map((m) => {
                  const track = m.tracks as {
                    id: string;
                    name: string;
                    slug: string;
                    timezone: string;
                  } | null;
                  if (!track) return null;
                  return (
                    <div
                      key={m.id}
                      className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-semibold text-white text-sm">{track.name}</h4>
                        <p className="text-xs text-amber-400 font-mono mt-0.5">
                          /{track.slug} • {track.timezone}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono mt-1">
                          ID: {track.id}
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 capitalize">
                        {m.role}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Tenant Isolation Verification Component */}
        <TenantIsolationVerifier userOrgs={accessibleOrgIds} />

        {/* Audit Log Trail */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center space-x-2.5 mb-4">
            <History className="w-5 h-5 text-slate-400" />
            <h2 className="text-base font-bold text-white">Recent Audit Events</h2>
          </div>

          {!auditLogs || auditLogs.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">
              No audit events recorded for your organization yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Target</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="text-slate-300 hover:bg-slate-950/40">
                      <td className="py-2.5 px-3 text-amber-400 font-semibold">{log.action}</td>
                      <td className="py-2.5 px-3">{log.target_type}</td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate">
                        {JSON.stringify(log.after_data)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
