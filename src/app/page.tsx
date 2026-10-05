import Link from "next/link";
import { Flag, ShieldCheck, Timer, Trophy, ArrowRight, Zap, Database } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Navigation header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 font-bold">
              <Flag className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-white">
              Track<span className="text-amber-500">Score</span>
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-md transition"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-lg transition inline-flex items-center space-x-1.5 shadow-sm shadow-amber-500/20"
            >
              <span>Go to App</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero section */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-16 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold tracking-wide uppercase">
            <Zap className="w-3.5 h-3.5" />
            <span>Phase One Foundation Ready</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
            Official race scoring with{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
              zero compromise
            </span>
          </h1>

          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Deterministic versioned scoring contracts, strict PostgreSQL Row-Level Security,
            and tenant-isolated venues designed for race tracks, mud bogs, pulls, and timed events.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/25"
            >
              <span>Open Authenticated Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold transition flex items-center justify-center"
            >
              Sign In or Register
            </Link>
          </div>
        </div>

        {/* Phase One Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <Timer className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Fastest Pass & Consistency</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Pure TypeScript scoring engine supporting lowest timed completions, stopped distance fallback,
              and two-pass consistency rounded to three decimals.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Strict Tenant Isolation</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Row Level Security enforced on every exposed table. Verified track & organization memberships
              guarantee zero cross-tenant data leaks.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Audit-Ready State</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Every save and mutation is traceable with before/after snapshots and immutable identifiers.
              Preserves raw input separately from calculated scores.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        TrackScore SaaS • Phase One Build • Specification: docs/PRODUCT_BLUEPRINT.md
      </footer>
    </div>
  );
}
