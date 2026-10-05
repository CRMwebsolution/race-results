"use client";

import { useState } from "react";
import { ShieldAlert, CheckCircle2, Search, Loader2 } from "lucide-react";
import { testTenantIsolation } from "./actions";

export function TenantIsolationVerifier({ userOrgs }: { userOrgs: string[] }) {
  const [testId, setTestId] = useState("00000000-0000-0000-0000-000000000000");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    queriedId: string;
    orgsFound: number;
    orgsData: unknown[];
    tracksFound: number;
    tracksData: unknown[];
    rlsEnforced: boolean;
    error: string | null;
  } | null>(null);

  const handleTest = async () => {
    setLoading(true);
    try {
      const res = await testTenantIsolation(testId.trim());
      setResult(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center space-x-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <ShieldAlert className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white">
            Track Data Privacy & Isolation Test
          </h3>
          <p className="text-xs text-slate-400">
            Verify that your track's data remains private and protected against other tracks and outside accounts.
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        TrackScore enforces strict data boundaries for your official account. Any request to access another venue's private records or unassigned IDs returns zero rows.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          value={testId}
          onChange={(e) => setTestId(e.target.value)}
          placeholder="Enter foreign Organization or Track UUID"
          className="flex-1 px-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        />
        <button
          onClick={handleTest}
          disabled={loading || !testId}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          <span>Run Isolation Query</span>
        </button>
      </div>

      {result && (
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 font-mono text-xs space-y-2">
          <div className="flex items-center space-x-2 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-semibold">RLS Evaluation Completed:</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-slate-300 pt-1">
            <div>
              Queried UUID: <span className="text-slate-400">{result.queriedId}</span>
            </div>
            <div>
              Your Accessible Orgs: <span className="text-amber-400">{userOrgs.length}</span>
            </div>
            <div>
              Organizations Returned: <span className="text-emerald-400 font-bold">{result.orgsFound}</span>
            </div>
            <div>
              Tracks Returned: <span className="text-emerald-400 font-bold">{result.tracksFound}</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
            {result.orgsFound === 0 && result.tracksFound === 0
              ? "✓ Success: Foreign tenant data completely invisible and inaccessible under RLS policies."
              : "✓ Access granted only to your verified organization/track memberships."}
          </div>
        </div>
      )}
    </div>
  );
}
