import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Flag, Calendar, ChevronRight, MapPin, Map, ArrowRight, Smartphone, FileSpreadsheet, Zap, Award, Users, CheckCircle } from "lucide-react";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state: selectedState } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Fetch tracks
  let tracksQuery = supabase.from("tracks").select("id, name, slug, state");
  if (selectedState) {
    tracksQuery = tracksQuery.eq("state", selectedState);
  }
  const { data: tracks } = await tracksQuery.order("name");

  // Fetch upcoming 3 events for each track
  const trackIds = tracks?.map((t) => t.id) || [];
  let allEvents: any[] = [];
  if (trackIds.length > 0) {
    const { data: events } = await supabase
      .from("events")
      .select("id, track_id, name, slug, local_date, status")
      .in("track_id", trackIds)
      .in("status", ["scheduled", "live"])
      .order("local_date", { ascending: true });
    
    allEvents = events || [];
  }

  const availableStates = ["AL", "AR", "CA", "FL", "GA", "IL", "IN", "KY", "LA", "MI", "MO", "MS", "NC", "NY", "OH", "OK", "PA", "SC", "TN", "TX", "VA"];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-amber-500/30 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Flag className="w-5 h-5 text-slate-950" />
            </div>
            <span className="font-black text-xl text-white tracking-tight">
              Track<span className="text-amber-500">Score</span>
            </span>
          </div>
          <div className="flex items-center space-x-4 text-sm font-medium">
            <Link href="/admin" className="text-slate-400 hover:text-white transition hidden sm:block">
              Platform Admin
            </Link>
            {user ? (
              <Link href="/dashboard" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition">
                Dashboard
              </Link>
            ) : (
              <Link href="/login" className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition">
                Track Login / Register
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {/* Top Half: Spectator Directory */}
        <section className="max-w-5xl mx-auto px-4 py-16 w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">
              Find Your Local <span className="text-amber-500">Track</span>
            </h1>
            <p className="text-lg text-slate-400">
              Follow live timing, view upcoming schedules, and check season standings.
            </p>
          </div>

          <div className="mb-12">
            <div className="flex items-center space-x-2 mb-4 text-slate-400 font-medium">
              <Map className="w-5 h-5" />
              <h2>Browse by State</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/"
                className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition ${
                  !selectedState 
                    ? "bg-amber-500 text-slate-950 border-amber-500" 
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:bg-slate-800"
                }`}
              >
                All States
              </Link>
              {availableStates.map(st => (
                <Link
                  key={st}
                  href={`/?state=${st}`}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition ${
                    selectedState === st 
                      ? "bg-amber-500 text-slate-950 border-amber-500" 
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:bg-slate-800"
                  }`}
                >
                  {st}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {!tracks || tracks.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
                <p className="text-slate-400">No tracks found matching your filter.</p>
              </div>
            ) : (
              tracks.map(track => {
                const trackEvents = allEvents.filter(e => e.track_id === track.id).slice(0, 3);
                
                return (
                  <div key={track.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 transition hover:border-amber-500/30">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <Link href={`/r/${track.slug}`} className="text-2xl font-black text-white hover:text-amber-400 transition inline-block">
                          {track.name}
                        </Link>
                        <div className="flex items-center space-x-2 text-sm text-slate-400 mt-1">
                          <MapPin className="w-4 h-4" />
                          <span>{track.state || "Location Unspecified"}</span>
                        </div>
                      </div>
                      <Link 
                        href={`/r/${track.slug}`}
                        className="hidden sm:flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-sm transition"
                      >
                        <span>Full Schedule</span>
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>

                    {trackEvents.length > 0 ? (
                      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {trackEvents.map(event => (
                          <Link 
                            key={event.id} 
                            href={`/r/${track.slug}/${event.slug}`}
                            className="block p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900 transition group"
                          >
                            <div className="flex justify-between items-start mb-2">
                              {event.status === "live" ? (
                                <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400 uppercase tracking-widest animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                  <span>Live</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                                  Scheduled
                                </span>
                              )}
                            </div>
                            <h4 className="font-bold text-slate-200 group-hover:text-white transition truncate">
                              {event.name}
                            </h4>
                            <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium mt-2">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>{event.local_date}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 text-sm text-slate-500">
                        No upcoming events scheduled.
                      </div>
                    )}
                    
                    <Link 
                      href={`/r/${track.slug}`}
                      className="sm:hidden mt-4 flex items-center justify-center space-x-2 px-4 py-2 bg-slate-800 text-white rounded-lg font-bold text-sm w-full"
                    >
                      <span>Full Schedule</span>
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Bottom Half: Track Owner Focused */}
        <section className="bg-slate-900 border-t border-slate-800 w-full mt-auto">
          <div className="max-w-6xl mx-auto px-4 py-16">
            <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
              <h2 className="text-3xl font-black text-white tracking-tight">
                Run a Track?
              </h2>
              <p className="text-slate-400">
                TrackScore is designed for the realities of race night. Set up your venue in two minutes.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold mb-3">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Live Spectator Mobile Results</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Fans view real-time leaderboard updates on their smartphones as soon as you record a pass. No app install needed.
                </p>
              </div>

              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold mb-3">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Instant Printable Result Sheets</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Generate clean, official PDF time sheets with track branding and date stamps right after the trophy presentation.
                </p>
              </div>

              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold mb-3">
                  <Award className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Season Points & Standings</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Run an entire season schedule. Automatically tally points from every event and display season-long championship standings.
                </p>
              </div>
            </div>

            <div className="mt-12 text-center">
              <Link
                href={user ? "/dashboard" : "/login"}
                className="inline-flex items-center space-x-2 px-8 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base transition shadow-xl shadow-amber-500/25"
              >
                <span>{user ? "Open Track Dashboard" : "Register Your Track Now"}</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 py-8 text-center text-xs text-slate-500">
        <p className="text-slate-400 font-semibold mb-1">TrackScore &mdash; Modern Race Scoring & Standings</p>
        <p>&copy; {new Date().getFullYear()} TrackScore. All rights reserved.</p>
      </footer>
    </div>
  );
}
