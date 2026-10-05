"use client";

import { useActionState, useState } from "react";
import { PlusCircle, Loader2, CheckCircle2 } from "lucide-react";
import { createOrganizationAndTrack, type ActionState } from "./actions";

export function CreateTrackForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const res = await createOrganizationAndTrack(prev, formData);
      if (res.success) {
        setIsOpen(false);
      }
      return res;
    },
    {}
  );

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">Register New Track & Organization</h3>
          <p className="text-sm text-slate-400">
            Creates an organization, track profile, owner memberships, and an initial audit event in one transaction.
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
          <span>Track and organization created successfully!</span>
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
                Organization Name
              </label>
              <input
                name="orgName"
                type="text"
                required
                placeholder="e.g. Carolina Motorsports Group"
                className="w-full px-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Track Name
              </label>
              <input
                name="trackName"
                type="text"
                required
                placeholder="e.g. Coastal Plains Raceway"
                className="w-full px-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Track URL Slug
              </label>
              <input
                name="trackSlug"
                type="text"
                required
                placeholder="e.g. coastal-plains"
                pattern="^[a-z0-9-]+$"
                title="Lowercase letters, numbers, and hyphens only"
                className="w-full px-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Timezone
              </label>
              <select
                name="timezone"
                defaultValue="America/New_York"
                className="w-full px-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition flex items-center space-x-2 disabled:opacity-50"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isPending ? "Creating Transaction..." : "Save Track & Organization"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
