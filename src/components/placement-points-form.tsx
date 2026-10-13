"use client";

import { useState } from "react";

export type PlacementRuleData = {
  id?: string;
  rank_start?: number;
  rank_end?: number;
  points?: number;
};

export function PlacementRuleInputs({
  rule,
}: {
  rule?: PlacementRuleData;
}) {
  const initialStart = rule?.rank_start ?? 1;
  const initialEnd = rule?.rank_end ?? initialStart;
  const initialPoints = rule?.points ?? 50;

  const initialIsAndBelow = initialEnd >= 999;
  const initialIsMulti = !initialIsAndBelow && initialEnd > initialStart;

  const [startRank, setStartRank] = useState<number>(initialStart);
  const [points, setPoints] = useState<number>(initialPoints);
  const [isMultiRank, setIsMultiRank] = useState<boolean>(initialIsMulti);
  const [throughRank, setThroughRank] = useState<number>(initialIsMulti ? initialEnd : initialStart + 1);
  const [isAndBelow, setIsAndBelow] = useState<boolean>(initialIsAndBelow);

  function handleMultiChange(checked: boolean) {
    setIsMultiRank(checked);
    if (checked) {
      setIsAndBelow(false);
      if (throughRank <= startRank) {
        setThroughRank(startRank + 1);
      }
    }
  }

  function handleAndBelowChange(checked: boolean) {
    setIsAndBelow(checked);
    if (checked) {
      setIsMultiRank(false);
    }
  }

  const effectiveEnd = isAndBelow ? 999 : isMultiRank ? Math.max(startRank, throughRank) : startRank;

  return (
    <div className="space-y-4">
      <input type="hidden" name="id" value={rule?.id || ""} />
      <input type="hidden" name="rank_start" value={startRank} />
      <input type="hidden" name="rank_end" value={effectiveEnd} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-300">
          Rank
          <input
            type="number"
            min="1"
            required
            value={startRank}
            onChange={(e) => {
              const val = Math.max(1, Number(e.target.value) || 1);
              setStartRank(val);
              if (throughRank <= val) setThroughRank(val + 1);
            }}
            placeholder="e.g. 1"
            className="block w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-300">
          Point Value
          <input
            name="points"
            type="number"
            min="0"
            required
            value={points}
            onChange={(e) => setPoints(Math.max(0, Number(e.target.value) || 0))}
            placeholder="e.g. 50"
            className="block w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
          />
        </label>
      </div>

      <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2.5">
        <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isMultiRank}
            onChange={(e) => handleMultiChange(e.target.checked)}
            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-slate-900 border-slate-700"
          />
          <span className="font-semibold">Multi-rank (range of ranks gets this amount of points)</span>
        </label>

        {isMultiRank && (
          <div className="pl-6 pt-1">
            <label className="block text-xs font-semibold text-amber-300">
              Through Rank:
              <input
                type="number"
                min={startRank + 1}
                required={isMultiRank}
                value={throughRank}
                onChange={(e) => setThroughRank(Math.max(startRank + 1, Number(e.target.value) || startRank + 1))}
                className="block w-36 mt-1 p-2 bg-slate-900 border border-amber-500/50 rounded-lg text-white font-mono text-sm"
              />
            </label>
            <p className="text-[11px] text-slate-400 mt-1">
              Ranks {startRank} through {throughRank} each earn {points} points.
            </p>
          </div>
        )}

        <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isAndBelow}
            onChange={(e) => handleAndBelowChange(e.target.checked)}
            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-slate-900 border-slate-700"
          />
          <span className="font-semibold">This rank and below get this amount of points</span>
        </label>
      </div>

      <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-200 flex items-center justify-between">
        <span>Rule Summary:</span>
        <strong className="font-bold">
          {isAndBelow
            ? `Rank ${startRank} & below \u2192 ${points} pts`
            : isMultiRank
            ? `Ranks ${startRank}\u2013${throughRank} \u2192 ${points} pts`
            : `Rank ${startRank} \u2192 ${points} pts`}
        </strong>
      </div>
    </div>
  );
}
