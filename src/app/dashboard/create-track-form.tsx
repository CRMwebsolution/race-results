"use client";

import { useActionState, useState } from "react";
import { PlusCircle, Loader2, CheckCircle2, Globe } from "lucide-react";
import { registerTrackAction, type ActionState } from "./actions";
import { generateTrackSlug } from "@/lib/slug";

export function CreateTrackForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [trackName, setTrackName] = useState("");
  const [shorthand, setShorthand] = useState("");

  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const res = await registerTrackAction(prev, formData);
      if (res.success) {
        setIsOpen(false);
        setTrackName("");
        setShorthand("");
      }
      return res;
    },
    {}
  );

  const previewSlug = generateTrackSlug(trackName, shorthand);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">Register New Track</h3>
          <p className="text-sm text-slate-400">
            Configure your race venue, public link, and timezone.
          </p>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition flex items-center space-x-1.5"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{isOpen ? "Close Form" : "New Track"}</span>
        </button>
      </div>

      {state.success && (
        <div className="mb-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Track registered successfully!</span>
        </div>
      )}

      {state.error && (
        <div className="mb-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          <span>{state.error}</span>
        </div>
      )}

      {isOpen && (
        <form action={formAction} className="mt-4 pt-4 border-t border-slate-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Track Name <span className="text-amber-400">*</span>
              </label>
              <input
                name="trackName"
                type="text"
                required
                value={trackName}
                onChange={(e) => setTrackName(e.target.value)}
                placeholder="e.g. Coastal Plains Raceway"
                className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Shorthand Name <span className="text-slate-500 font-normal normal-case">(optional)</span>
              </label>
              <input
                name="shorthand"
                type="text"
                value={shorthand}
                onChange={(e) => setShorthand(e.target.value)}
                placeholder="e.g. CPR"
                className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Timezone
              </label>
              <select
                name="timezone"
                defaultValue="America/New_York"
                className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                State
              </label>
              <select
                name="state"
                className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                defaultValue="TX"
              >
                <option value="">Select State</option>
                {["AL", "AR", "CA", "FL", "GA", "IL", "IN", "KY", "LA", "MI", "MO", "MS", "NC", "NY", "OH", "OK", "PA", "SC", "TN", "TX", "VA"].map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            {/* Live Auto-populated Slug Preview */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Public Spectator URL
              </label>
              <div className="px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-slate-400 text-sm flex items-center space-x-1.5 font-mono">
                <Globe className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-slate-500">/r/</span>
                <span className="text-amber-400 font-semibold">{previewSlug || "your-track-slug"}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {shorthand.trim()
                  ? "Auto-generated from shorthand name."
                  : "Auto-generated from track name with hyphens."}
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isPending || !trackName.trim()}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition flex items-center space-x-2 disabled:opacity-50 shadow-md shadow-amber-500/20"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isPending ? "Registering..." : "Register Track"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
