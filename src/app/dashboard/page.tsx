import {readAll} from "@/lib/read-all";
import {modeFeatures} from "@/lib/account-mode";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Flag, MapPin, Shield, User, ExternalLink, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CreateTrackForm } from "./create-track-form";

type TrackInfo = {
  id: string;
  organization_id: string;
  name: string;
  shorthand: string | null;
  slug: string;
  timezone: string;
  created_at: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const features=modeFeatures(user.user_metadata.operating_mode);
  // Fetch track memberships with tenant-scoped RLS
  const { data: trackMemberships } = await readAll(supabase
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
        shorthand,
        slug,
        timezone,
        created_at
      )
    `)
    .eq("user_id", user.id)
    .eq("active", true)
    .order("created_at", { ascending: false }));

  const validMemberships = (trackMemberships ?? []).filter(
    (m): m is typeof m & { tracks: TrackInfo } => Boolean(m.tracks)
  );

  const { data: memberships } = await readAll(supabase.from("organization_memberships")
    .select("organization_id").eq("user_id", user.id).eq("active", true)
    .in("role", ["owner", "admin"]));
  const organizationIds = (memberships ?? []).map(m => m.organization_id);
  // Series have public read policies; management listings need explicit scope.
  const { data: mySeries } = organizationIds.length ? await readAll(supabase
    .from("series")
    .select("id, name, description, created_at, organization_id")
    .in("organization_id", organizationIds)
    .order("created_at", { ascending: false })) : { data: [] };

  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");

  return (
    <div className="flex-1 flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/dashboard" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                <Flag className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-lg tracking-tight text-white">
                Race<span className="text-amber-500">Holler</span>
              </span>
            </Link>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              Official Dashboard
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {isPlatformAdmin && (
              <Link
                href="/admin"
                className="text-xs font-bold text-rose-500 hover:text-rose-400 transition bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20"
              >
                Platform Admin
              </Link>
            )}
            <Link
              href="/"
              className="text-xs font-medium text-slate-400 hover:text-white transition hidden sm:inline"
            >
              Public Site
            </Link>
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
                Signed in as <span className="text-amber-400 font-mono">{user.email}</span>
              </p>
            </div>
            <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl w-fit">
              <Shield className="w-3.5 h-3.5" />
              <span>Verified Official Access</span>
            </div>
          </div>
        </div>

        {/* Register New Track Form */}
        {!user.user_metadata.operating_mode && <p className="p-4 border border-amber-500 rounded">Tailor your dashboard: <Link href="/dashboard/settings" className="text-amber-400">choose how you run races</Link>.</p>}
        {(() => {
          const trackSection = <>
        {features.tracks && validMemberships.length === 0 && <CreateTrackForm />}

        {/* Tracks & Venues Section */}
        {(features.tracks || validMemberships.length > 0) && <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2.5">
              <MapPin className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold text-white">Your Tracks & Venues</h2>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {validMemberships.length} {validMemberships.length === 1 ? "Track" : "Tracks"}
            </span>
          </div>

          {validMemberships.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-xl bg-slate-950/40 border border-dashed border-slate-800">
              <MapPin className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-300">No race tracks configured yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Register your first racing venue using the form above to start scoring events and publishing live spectator times.
              </p>
            </div>
          ) : (
            <div className={`grid grid-cols-1 gap-4 ${validMemberships.length > 1 ? "md:grid-cols-2" : ""}`}>
              {validMemberships.map((membership) => {
                const track = membership.tracks;
                return (
                  <div
                    key={membership.id}
                    className="p-5 rounded-xl bg-slate-950/70 border border-slate-800/90 hover:border-slate-700/80 transition flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <h4 className="font-bold text-white text-xl">{track.name}</h4>
                          {track.shorthand && (
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                              {track.shorthand}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 capitalize shrink-0">
                          {membership.role}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>{track.timezone}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                      <div className="text-xs font-mono text-slate-400 flex items-center space-x-1.5">
                        <span className="text-slate-500">Live URL:</span>
                        <span className="text-amber-400">/r/{track.slug}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/r/${track.slug}`}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center space-x-1.5 border border-slate-700"
                        >
                          <span>Spectator</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </Link>
                        <Link
                          href={`/dashboard/tracks/${track.id}`}
                          className="text-sm font-bold px-4 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition"
                        >
                          Manage Track
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {validMemberships.length > 0 && <div className="mt-4"><CreateTrackForm compact /></div>}
        </div>

        }
</>;
          const seriesSection = <>
        {/* Your Series Section */}
        {(features.series || (mySeries?.length ?? 0) > 0) && <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center space-x-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>
              <h2 className="text-lg font-bold text-white">Your Series</h2>
            </div>
            <Link 
              href="/dashboard/series/new"
              className={`text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center gap-1 ${(mySeries?.length ?? 0) > 0 ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700" : "bg-amber-500 hover:bg-amber-400 text-slate-950"}`}
            >
              <span>{(mySeries?.length ?? 0) > 0 ? "+ Create another series" : "Create Series"}</span>
            </Link>
          </div>

          {mySeries?.length === 0 || !mySeries ? (
            <div className="text-center py-12 px-4 rounded-xl bg-slate-950/40 border border-dashed border-slate-800">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 mx-auto mb-3"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>
              <h3 className="text-sm font-semibold text-slate-300">No series created yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Create a series to manage classes, points, and rules across multiple race dates or venues.
              </p>
            </div>
          ) : (
            <div className={`grid grid-cols-1 gap-4 ${mySeries.length > 1 ? "md:grid-cols-2" : ""}`}>
              {mySeries.map((series) => (
                <div
                  key={series.id}
                  className="p-5 rounded-xl bg-slate-950/70 border border-slate-800/90 hover:border-slate-700/80 transition flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-xl">{series.name}</h4>
                    {series.description && (
                      <p className="text-xs text-slate-400 line-clamp-2">{series.description}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end">
                    <Link
                      href={`/dashboard/series/${series.id}`}
                      className="text-sm font-bold px-4 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition"
                    >
                      Manage Series &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        }
</>;
          return validMemberships.length === 0 && (mySeries?.length ?? 0) > 0
            ? <>{seriesSection}{trackSection}</>
            : <>{trackSection}{seriesSection}</>;
        })()}
      </main>
    </div>
  );
}
