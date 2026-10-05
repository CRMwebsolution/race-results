import Link from "next/link";
import {
  Flag,
  Timer,
  Trophy,
  ArrowRight,
  Zap,
  Smartphone,
  FileSpreadsheet,
  CheckCircle,
  Gauge,
  Flame,
  Award,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100">
      {/* Navigation header */}
      <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
              <Flag className="w-5 h-5 text-slate-950" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-white">
              Track<span className="text-amber-500">Score</span>
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {user ? (
              <>
                <span className="hidden sm:inline text-xs text-slate-400 font-mono">
                  {user.email}
                </span>
                <Link
                  href="/dashboard"
                  className="text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl transition inline-flex items-center space-x-1.5 shadow-md shadow-amber-500/20"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-lg transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/login"
                  className="text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl transition inline-flex items-center space-x-1.5 shadow-md shadow-amber-500/20"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
          {/* Subtle background glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-5xl mx-auto px-4 text-center relative z-10 space-y-6">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wide uppercase">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Built for Track Owners & Race Promoters</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.1]">
              The Race Day Scoring System{" "}
              <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500">
                Built for Speed & Precision
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto font-normal leading-relaxed">
              Ditch the clipboards, messy spreadsheets, and radio confusion.
              Record runs on your tablet, automatically rank fastest passes and consistency,
              and deliver real-time leaderboards straight to spectators’ phones.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={user ? "/dashboard" : "/login"}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base transition flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/25"
              >
                <span>{user ? "Open Your Dashboard" : "Set Up Your Track Today"}</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#formats"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-base transition flex items-center justify-center"
              >
                See Supported Race Formats
              </a>
            </div>

            {/* Quick Proof Badges */}
            <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-medium">
              <div className="flex items-center space-x-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Works on Any Phone or Tablet</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>No Spectator App Required</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Single Event or Full Season</span>
              </div>
            </div>
          </div>
        </section>

        {/* Live Race Format Cards */}
        <section id="formats" className="max-w-6xl mx-auto px-4 py-16 border-t border-slate-800/80">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Every Racing Format Handled Automatically
            </h2>
            <p className="text-slate-400 text-sm">
              Whether you run drag passes, mud bogs, truck pulls, or consistency dial-ins, TrackScore scores each class according to official rules.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Format 1: Fastest Pass */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 transition flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-4">
                  <Timer className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Fastest Pass</h3>
                <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                  Lowest valid elapsed time wins. Automatically handles penalties, disqualifications,
                  and sorts secondary passes as tiebreakers.
                </p>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 font-mono text-xs">
                <div className="text-slate-500 text-[11px] mb-1">Example: 2-Pass Shootout</div>
                <div className="flex justify-between text-slate-300">
                  <span>Pass 1: 9.082 s</span>
                  <span>Pass 2: 9.019 s</span>
                </div>
                <div className="mt-1 pt-1 border-t border-slate-800 flex justify-between font-bold text-amber-400">
                  <span>Official Best:</span>
                  <span>9.019 s</span>
                </div>
              </div>
            </div>

            {/* Format 2: Consistency */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 transition flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
                  <Gauge className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Two-Pass Consistency</h3>
                <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                  Tests driver repeatability. The smallest difference between two passes wins, down to three decimal places (.001s).
                </p>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 font-mono text-xs">
                <div className="text-slate-500 text-[11px] mb-1">Example: Repeatability</div>
                <div className="flex justify-between text-slate-300">
                  <span>Pass 1: 9.082 s</span>
                  <span>Pass 2: 9.019 s</span>
                </div>
                <div className="mt-1 pt-1 border-t border-slate-800 flex justify-between font-bold text-blue-400">
                  <span>Difference:</span>
                  <span>0.063 s</span>
                </div>
              </div>
            </div>

            {/* Format 3: Stopped Distance */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 transition flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                  <Trophy className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Stopped Distance & Bogs</h3>
                <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                  For truck pulls and mud bogs. Completed times always beat stopped marks; greatest distance in feet/inches breaks uncompleted ties.
                </p>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 font-mono text-xs">
                <div className="text-slate-500 text-[11px] mb-1">Example: Distance Fallback</div>
                <div className="flex justify-between text-slate-300">
                  <span>Racer A: 200.0 ft</span>
                  <span>Racer B: 120.0 ft</span>
                </div>
                <div className="mt-1 pt-1 border-t border-slate-800 flex justify-between font-bold text-emerald-400">
                  <span>Leader:</span>
                  <span>Racer A (200.0 ft)</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid: What Promoters Care About */}
        <section className="max-w-6xl mx-auto px-4 py-16 border-t border-slate-800/80">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Designed for the Realities of Race Night
            </h2>
            <p className="text-slate-400 text-sm">
              We built TrackScore from the ground up to solve the actual headaches track operators face every weekend.
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
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Fast Staging-Lane Entry</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Large, touch-friendly inputs designed for phones and tablets. Type 9.019 or 200ft and hit next. It just works.
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

            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold mb-3">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Multiple Track Officials</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Invite timers, staging directors, and scorers to collaborate with track-specific roles and tamper-proof audit trails.
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold mb-3">
                <CheckCircle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Never Lose a Pass</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Smart local drafts and atomic saves protect your data even if track Wi-Fi hiccups during the action.
              </p>
            </div>
          </div>
        </section>

        {/* Call to action footer */}
        <section className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-2xl space-y-6">
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Ready to elevate your track's race night?
            </h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Start with a single event pass or manage your complete season schedule. Set up your track profile in less than two minutes.
            </p>
            <div className="pt-2">
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
      <footer className="border-t border-slate-800/80 py-8 text-center text-xs text-slate-500">
        <p className="text-slate-400 font-semibold mb-1">TrackScore — Modern Race Scoring & Standings</p>
        <p>© {new Date().getFullYear()} TrackScore. All rights reserved.</p>
      </footer>
    </div>
  );
}
