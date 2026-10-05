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

  // Fetch track memberships with tenant-scoped RLS
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
        shorthand,
        slug,
        timezone,
        created_at
      )
    `)
    .order("created_at", { ascending: false });

  const validMemberships = (trackMemberships ?? []).filter(
    (m): m is typeof m & { tracks: TrackInfo } => Boolean(m.tracks)
  );

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
                Track<span className="text-amber-500">Score</span>
              </span>
            </Link>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              Official Dashboard
            </span>
          </div>

          <div className="flex items-center space-x-4">
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
        <CreateTrackForm />

        {/* Tracks & Venues Section */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          <h4 className="font-bold text-white text-base">{track.name}</h4>
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

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <div className="text-xs font-mono text-slate-400 flex items-center space-x-1.5">
                        <span className="text-slate-500">Live URL:</span>
                        <span className="text-amber-400">/r/{track.slug}</span>
                      </div>

                      <Link
                        href={`/r/${track.slug}`}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center space-x-1.5 border border-slate-700"
                      >
                        <span>Spectator View</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
