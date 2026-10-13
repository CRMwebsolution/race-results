"use client";

import { useState } from "react";
import { createEvent } from "./actions";
import { Loader2, Calendar as CalendarIcon, Flag } from "lucide-react";
import { TipHighlight, GuidedStepBadge } from "@/components/tip-provider";

export function CreateEventForm({ trackId }: { trackId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);
    try {
      const result = await createEvent(trackId, formData);
      if (result?.error) {
        setError(result.error);
      }
    } catch (e: any) {
        if (e.message === "NEXT_REDIRECT") throw e;
      setError("An unexpected error occurred.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
            <label className="block text-sm font-medium text-slate-300">
              What would you like to do?
            </label>
            <GuidedStepBadge step="9" label="Decide public or draft" />
          </div>
          <select name="purpose" defaultValue="calendar" className="block w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-white">
            <option value="calendar">Add a public calendar date (Scheduled)</option>
            <option value="setup">Set up a race now (Draft - hidden)</option>
          </select>
          <p className="text-xs text-slate-400 mt-1.5">Add dates now without entering any contestants. You can open registration and enter results later.</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
            <label htmlFor="name" className="block text-sm font-medium text-slate-300">
              Event Name
            </label>
            <GuidedStepBadge step="10" label="Fill out event name" />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Flag className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="text"
              name="name"
              id="name"
              required
              placeholder="e.g., Spring Mud Bog 2026"
              className="block w-full pl-10 bg-slate-950 border border-slate-800 rounded-lg py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition sm:text-sm"
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            This forms the public URL. E.g., /r/track-slug/spring-mud-bog-2026
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
            <label htmlFor="local_date" className="block text-sm font-medium text-slate-300">
              Race Date
            </label>
            <GuidedStepBadge step="11" label="Pick race date" />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <CalendarIcon className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="date"
              name="local_date"
              id="local_date"
              required
              className="block w-full pl-10 bg-slate-950 border border-slate-800 rounded-lg py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition sm:text-sm [color-scheme:dark]"
            />
          </div>
        </div>
      </div>

      <div className="pt-2">
        <TipHighlight step="12" label='"Save event"' className="w-full">
          <button
            type="submit"
            disabled={isPending}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-amber-950 bg-amber-500 hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-amber-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <span className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Event...</span>
              </span>
            ) : (
              "Save event"
            )}
          </button>
        </TipHighlight>
      </div>
    </form>
  );
}

