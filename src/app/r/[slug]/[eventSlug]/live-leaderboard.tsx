"use client";
import {ResultSort} from "@/components/result-sort";
import {sortResults,passCount,ResultOrder} from "@/lib/race-order";

import { useEffect, useState, useMemo, useRef, useTransition } from "react";
import { watchPublicEvent } from "@/lib/event-sync";
import { createClient } from "@/lib/supabase/client";
import { scoreClass, rankEntries, compareRankedEntries } from "@/scoring";
import { Loader2, RefreshCw, Printer } from "lucide-react";
import { useRouter } from "next/navigation";

type EventType = { id: string; name: string; status: string; published_revision: number | null };
type ClassType = { id: string; name: string; scoring_type: string; scoring_version?: number; scoring_config: any; order_num: number };
type EntryType = { id: string; event_class_id: string; display_name: string; seed: number | null; order_num: number };
type AttemptType = { id: string; event_class_id: string; entry_id: string; ordinal: number; status: string; elapsed_ms: number | null; distance_mm: number | null; penalty_ms: number; raw_input: string | null };

type ScoreEngineAttempt = {
  id: string;
  entryId: string;
  ordinal: number;
  status: "valid" | "dq" | "dnf" | "dns" | "no_time";
  elapsedMs: number | null;
  distanceMm: number | null;
  penaltyMs: number;
  rawInput?: string | null;
};

export function LiveLeaderboard({
  event,
  classes,
  initialEntries,
  initialAttempts,
}: {
  event: EventType;
  classes: ClassType[];
  initialEntries: EntryType[];
  initialAttempts: AttemptType[];
}) {
  const [sortOrder,setSortOrder]=useState<ResultOrder>("rank");
  const [reverse,setReverse]=useState(false);
  const [activeClassId, setActiveClassId] = useState<string>(classes[0]?.id || "");
  const [connected, setConnected] = useState(false);
  const [isRefreshing, startTransition] = useTransition();
  const currentEvent = useRef(event);
  currentEvent.current = event;
  const router = useRouter();

  useEffect(() => {
    return watchPublicEvent(createClient(), event.id, () => currentEvent.current,
      () => startTransition(() => router.refresh()), setConnected);
  }, [event.id, router]);

  useEffect(() => {
    if (!classes.some(c => c.id === activeClassId)) setActiveClassId(classes[0]?.id ?? "");
  }, [classes, activeClassId]);

  const activeClass = classes.find((c) => c.id === activeClassId);
  const activeEntries = initialEntries.filter((e) => e.event_class_id === activeClassId);

  const rankedEntries = useMemo(() => {
    if (!activeClass) return [];

    const attemptsForClass = initialAttempts.filter((a) => a.event_class_id === activeClass.id);

    const entriesWithScore = activeEntries.map((entry) => {
      const entryAttempts: ScoreEngineAttempt[] = attemptsForClass
        .filter((a) => a.entry_id === entry.id)
        .map((a) => ({
          id: a.id,
          entryId: a.entry_id,
          ordinal: a.ordinal,
          status: a.status as "valid" | "dq" | "dnf" | "dns" | "no_time",
          elapsedMs: a.elapsed_ms,
          distanceMm: a.distance_mm,
          penaltyMs: a.penalty_ms,
          rawInput: a.raw_input,
        }));

      const score = scoreClass(activeClass.scoring_type, entryAttempts, activeClass.scoring_config, activeClass.scoring_version);

      return {
        entry,
        score,
        seed: entry.seed,
        orderNum: entry.order_num,
        entryId: entry.id,
        attempts: entryAttempts,
      };
    });

    return rankEntries(entriesWithScore);

  }, [activeClass, activeEntries, initialAttempts]);

  const sortedRows=sortResults(rankedEntries,sortOrder,reverse);
  const displayRows=sortedRows;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-xl font-bold text-white">{event.name}</h2>
          {event.status === "live" && (
            <div className="flex items-center space-x-2 mt-1">
              <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400 uppercase tracking-widest animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>{connected ? "Live updates connected" : "Checking for updates"}</span>
              </span>
              {isRefreshing && <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />}
            </div>
          )}
        </div>
      </div>

      {/* Class selector */}
      <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar space-x-2 print:hidden">
        {classes.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveClassId(c.id)}
            className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition ${
              activeClassId === c.id
                ? "bg-amber-500 text-amber-950"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <ResultSort order={sortOrder} reverse={reverse} passes={passCount(activeClass?.scoring_config,initialAttempts)} onOrder={setSortOrder} onReverse={setReverse}/>
      <p className="px-4 text-xs text-slate-400">Display order: {sortOrder} {reverse ? "(reversed)" : ""}</p>
      {/* Leaderboard */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
          <h3 className="font-bold text-white">{activeClass?.name} Leaderboard</h3>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => window.print()}
              className="text-slate-500 hover:text-slate-300 transition flex items-center space-x-1 text-sm font-medium"
              title="Print Results"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={() => startTransition(() => router.refresh())}
              className="text-slate-500 hover:text-slate-300 transition"
              title="Force refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-800/50">
          {rankedEntries.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No entries to show.
            </div>
          ) : (
            displayRows.map((row) => (
              <div key={row.entryId} className="p-4 flex items-center space-x-4 hover:bg-slate-800/30 transition">
                <div className="w-10 flex-shrink-0 flex justify-center">
                  <span
                    className={`inline-flex items-center justify-center min-w-[1.75rem] h-7 px-1.5 rounded-full font-bold text-xs ${
                      row.rank === 1 && row.score.eligible
                        ? "bg-amber-500 text-amber-950 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                        : row.rank === 2 && row.score.eligible
                        ? "bg-slate-300 text-slate-800"
                        : row.rank === 3 && row.score.eligible
                        ? "bg-amber-700 text-white"
                        : row.tied
                        ? "bg-blue-500 text-blue-950"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {row.rank == null ? "-" : row.tied ? `T${row.rank}` : row.rank}
                  </span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-base truncate">
                    {row.entry.display_name}
                  </p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">
                    {row.attempts.map(a => a.rawInput || "-").join(" | ")}
                  </p>
                </div>

                <div className="text-right">
                  {row.score.eligible ? (
                    <div className="font-mono font-bold text-amber-400 text-lg">
                      {row.score.label}
                    </div>
                  ) : (
                    <div className="text-slate-500 italic text-sm">
                      {row.score.label || "No score"}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Print-only Table Sorted by Rank */}
      <div className="hidden print:block p-8 bg-white text-black w-full">
        <h1 className="text-2xl font-bold mb-1">{event.name}</h1>
        <h2 className="text-lg font-semibold text-gray-700 mb-6">{activeClass?.name} Results · Order: {sortOrder} {reverse ? "reversed" : ""}</h2>
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-900 uppercase text-xs font-bold text-gray-600">
              <th className="py-2 pr-4 w-16">Rank</th>
              <th className="py-2 pr-4 w-16">Draw</th>
              <th className="py-2 pr-4">Racer</th>
              <th className="py-2 text-right">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300">
            {displayRows
              .map((row) => (
              <tr key={row.entryId}>
                <td className="py-2 pr-4 font-bold">{row.rank == null ? "-" : row.tied ? `T${row.rank}` : row.rank}</td>
                <td className="py-2 pr-4 text-gray-500">{row.orderNum !== 999 ? row.orderNum : "-"}</td>
                <td className="py-2 pr-4 font-medium">{row.entry.display_name}</td>
                <td className="py-2 text-right font-mono font-bold">
                  {row.score.eligible ? row.score.label : <span className="text-gray-400 font-normal italic">{row.score.label || "No score"}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
