"use client";
import type {OfficialRow} from "@/lib/official-results";
import {JudgeInput,judgeRoundAttempts} from "@/scoring/multi-judge";
import {SortHeading} from "@/components/sort-heading";
import {sortResults,passCount,ResultOrder} from "@/lib/race-order";

import { useEffect, useState, useMemo, useRef, useTransition } from "react";
import { watchPublicEvent } from "@/lib/event-sync";
import { createClient } from "@/lib/supabase/client";
import { scoreClass, rankEntries } from "@/scoring";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type EventType = { id: string; name: string; status: string; published_revision: number | null; spectator_points_mode?: string };
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

export function PitDisplay({
  event,
  classes,
  initialEntries,
  initialAttempts,
  judgeScores=[], latestClassId, officialResults, officialVersion,
}: {
  event: EventType;
  classes: ClassType[];
  initialEntries: EntryType[];
  initialAttempts: AttemptType[];
  judgeScores?:JudgeInput[];
  latestClassId: string;
  officialResults?:OfficialRow[];officialVersion?:number;
}) {
  const [sortOrder,setSortOrder]=useState<ResultOrder>("rank");
  const [reverse,setReverse]=useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [following, setFollowing] = useState(true);
  const activeClassId=following || !classes.some(c=>c.id===selectedClassId) ? latestClassId || classes[0]?.id || "" : selectedClassId;
  const [connected, setConnected] = useState(false);
  const [isRefreshing, startTransition] = useTransition();
  const currentEvent = useRef(event);
  currentEvent.current = event;
  
  const router = useRouter();

  useEffect(() => {
    return watchPublicEvent(createClient(), event.id, () => currentEvent.current,
      () => startTransition(() => {
        router.refresh(); 
      }), setConnected);
  }, [event.id, router]);

  const activeClass = classes.find((c) => c.id === activeClassId);
  const activeEntries = initialEntries.filter((e) => e.event_class_id === activeClassId);

  const rankedEntries = useMemo(() => {
    if (!activeClass) return [];

    const attemptsForClass = initialAttempts.filter((a) => a.event_class_id === activeClass.id);

    const entriesWithScore = activeEntries.map((entry) => {
      const judges=judgeScores.filter(s=>s.entryId===entry.id);
      const entryAttempts: ScoreEngineAttempt[] = activeClass.scoring_type==="judged_points" ? judgeRoundAttempts(entry.id,judges,activeClass.scoring_config) : attemptsForClass
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

      const official=officialResults?.find(r=>r.id===entry.id);
      const score = officialResults ? (official?.score ?? {eligible:official?.final_rank!=null,primary:null,direction:"asc" as const,tieBreakers:[],label:official?.final_rank!=null ? `Official rank ${official.final_rank} (original score not retained)` : "Unranked",details:{}}) : scoreClass(activeClass.scoring_type, entryAttempts, activeClass.scoring_config, activeClass.scoring_version,judges);

      return {
        entry,
        score,
        seed: entry.seed,
        orderNum: entry.order_num,
        entryId: entry.id,
        attempts: entryAttempts,
        rank: official?.final_rank ?? null,
        tied: official?.tied ?? false,
      };
    });

    return officialResults ? entriesWithScore : rankEntries(entriesWithScore);
  }, [activeClass, activeEntries, initialAttempts, judgeScores, officialResults]);

  const displayRows=sortResults(rankedEntries,sortOrder,reverse);
  
  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8 font-sans flex flex-col space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-amber-500 uppercase">{event.name}</h1>
          <div className="flex items-center space-x-3 mt-2 text-xl">
            <span className="font-bold text-slate-300">PIT DISPLAY</span>
            {event.status === "live" && (
              <span className="flex items-center space-x-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-sm font-bold text-red-400 uppercase tracking-widest animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span>{connected ? "LIVE" : "CONNECTING..."}</span>
              </span>
            )}
            {isRefreshing && <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />}
          </div>
        </div>
      </div>

      {officialResults && <p className="text-xl text-emerald-400">Official results · Version {officialVersion}</p>}
      {event.status === "live" && !connected && <p role="status" className="text-slate-300">Checking for updates. This display will reconnect automatically.</p>}
      {/* Class Selector - Huge tap targets */}
      <div className="flex flex-wrap gap-3">
        {event.status==='live' && <button onClick={()=>setFollowing(true)} aria-pressed={following} className="px-6 py-4 rounded-xl text-2xl font-bold border border-amber-500 text-amber-400">{following ? "Following live class" : "Follow live class"}</button>}
        {classes.map((c) => (
          <button
            key={c.id}
            onClick={() => { setSelectedClassId(c.id); setFollowing(false); }}
            className={`px-6 py-4 rounded-xl text-2xl font-bold uppercase tracking-wider transition ${
              activeClassId === c.id
                ? "bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)] scale-105"
                : "bg-slate-900 text-slate-400 border-2 border-slate-800 hover:text-white hover:border-slate-600"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="flex-1 bg-slate-950 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table aria-label={`${activeClass?.name||'Race'} results`} className="w-full text-left whitespace-nowrap">
            <thead className="bg-slate-900 sticky top-0 z-10">
              <tr className="text-2xl text-slate-400 uppercase tracking-wider">
                <SortHeading<ResultOrder> label="Rank" value="rank" order={sortOrder} reverse={reverse} onOrder={setSortOrder} onReverse={setReverse} className="p-6 cursor-pointer hover:text-white transition" />
                <SortHeading<ResultOrder> label="Draw" value="run" order={sortOrder} reverse={reverse} onOrder={setSortOrder} onReverse={setReverse} className="p-6 cursor-pointer hover:text-white transition" />
                <SortHeading<ResultOrder> label="Racer" value="name" order={sortOrder} reverse={reverse} onOrder={setSortOrder} onReverse={setReverse} className="p-6 cursor-pointer hover:text-white transition" />
                {Array.from({length:passCount(activeClass?.scoring_config,initialAttempts)},(_,i)=><th key={i} className="p-6">Pass {i+1}</th>)}
                <th className="p-6 text-right" scope="col">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {displayRows.map((row, index) => (
                <tr data-testid="result-row" key={row.entryId} className={`transition ${index % 2 === 0 ? 'bg-slate-950' : 'bg-slate-900/50'} hover:bg-slate-800`}>
                  <td className="p-6 text-4xl font-black text-amber-500">{row.rank==null?'—':`${row.tied?'T':''}${row.rank}`}</td>
                  <td className="p-6 text-3xl font-bold text-slate-500">{row.orderNum}</td>
                  <td className="p-6 text-4xl font-extrabold tracking-tight">{row.entry.display_name}</td>
                  {Array.from({length:passCount(activeClass?.scoring_config,initialAttempts)},(_,i)=><td key={i} className="p-6 text-3xl font-mono text-slate-300">{row.attempts.find(a=>a.ordinal===i+1)?.rawInput||'—'}</td>)}
                  <td className="p-6 text-4xl font-mono font-black text-right text-emerald-400">{row.score.label||'—'}</td>
                </tr>
              ))}
              {!displayRows.length&&<tr><td colSpan={passCount(activeClass?.scoring_config,initialAttempts)+4} className="p-12 text-center text-3xl text-slate-500 font-bold uppercase tracking-widest">No entries yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
