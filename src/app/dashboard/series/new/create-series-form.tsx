"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export function CreateSeriesForm({ orgList, action }: { orgList: {id: string, name: string}[], action: any }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState(orgList.length > 0 ? orgList[0].id : "new_org");
  const [pointsMode, setPointsMode] = useState<"championship" | "none">("championship");

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);
    try {
      const result = await action(formData);
      if (result?.error) setError(result.error);
    } catch (e: any) {
      if (e?.message === "NEXT_REDIRECT") throw e;
      setError("An unexpected error occurred.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Series Name</label>
        <input 
          name="name"
          required
          type="text" 
          placeholder="e.g. 2026 Southern Mud Tour"
          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-amber-500/50 outline-none"
        />
      </div>
      
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Description (Optional)</label>
        <textarea 
          name="description"
          placeholder="e.g. The premier mud racing tour across the southeast."
          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-amber-500/50 outline-none"
          rows={3}
        />
      </div>

      <div className="pt-2">
        <label className="block text-sm font-semibold text-slate-300 mb-2">Owning Organization</label>
        <p className="text-xs text-slate-500 mb-3">Series and tracks can be managed under the same organization for shared billing, or kept completely separate.</p>
        <select 
          name="organization_id" 
          value={selectedOrg}
          onChange={(e) => setSelectedOrg(e.target.value)}
          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm mb-3 focus:ring-2 focus:ring-amber-500/50 outline-none"
          required
        >
          {orgList.map(org => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
          <option value="new_org">Create a new organization...</option>
        </select>

        {selectedOrg === "new_org" && (
          <div className="mt-4 p-4 bg-slate-950/50 border border-slate-800 rounded-xl animate-in fade-in zoom-in-95">
            <label className="block text-xs font-semibold text-slate-400 mb-2">New Organization Name</label>
            <input 
              name="org_name"
              required
              type="text" 
              placeholder="e.g. RedLine Mud Racing Series"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500/50 outline-none"
            />
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-slate-800">
        <label className="block text-sm font-semibold text-slate-300 mb-2">Points &amp; Standings Mode</label>
        <p className="text-xs text-slate-500 mb-3">Choose whether this series tracks championship points across races, or just focuses on race-day results.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${pointsMode === "championship" ? "bg-amber-500/10 border-amber-500/50 text-white" : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"}`}>
            <div className="flex items-center space-x-2.5 mb-2">
              <input 
                type="radio" 
                name="points_mode" 
                value="championship" 
                checked={pointsMode === "championship"} 
                onChange={() => setPointsMode("championship")}
                className="text-amber-500 focus:ring-amber-500 w-4 h-4"
              />
              <span className="font-bold text-sm text-slate-200">Track Season Points</span>
            </div>
            <p className="text-xs text-slate-400">
              Calculate points per race, manage seasons, and publish overall series championship standings.
            </p>
          </label>

          <label className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${pointsMode === "none" ? "bg-amber-500/10 border-amber-500/50 text-white" : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"}`}>
            <div className="flex items-center space-x-2.5 mb-2">
              <input 
                type="radio" 
                name="points_mode" 
                value="none" 
                checked={pointsMode === "none"} 
                onChange={() => setPointsMode("none")}
                className="text-amber-500 focus:ring-amber-500 w-4 h-4"
              />
              <span className="font-bold text-sm text-slate-200">Races &amp; Results Only</span>
            </div>
            <p className="text-xs text-slate-400">
              Skip championship points. Just organize traveling race meets, classes, and individual event results.
            </p>
          </label>
        </div>
      </div>
      
      <div className="pt-6 mt-2 border-t border-slate-800 flex justify-end">
        <button 
          type="submit" 
          disabled={isPending}
          className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-8 py-3 rounded-xl transition disabled:opacity-50 flex items-center"
        >
          {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Create Series
        </button>
      </div>
    </form>
  );
}
