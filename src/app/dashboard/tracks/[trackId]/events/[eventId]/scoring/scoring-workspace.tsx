"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { saveAttempt } from "./actions";
import { parseAttemptInput, ParsedAttempt } from "@/scoring/parser";
import { scoreClass, rankEntries, compareRankedEntries } from "@/scoring";
import { CheckCircle2, Loader2, Download, Printer, ExternalLink, Users } from "lucide-react";
import Link from "next/link";

type EventType = { id: string; name: string; working_revision: number; status: string };
type ClassType = { id: string; name: string; scoring_type: string; scoring_version?: number; scoring_config: any; order_num: number };
type EntryType = { id: string; event_class_id: string; display_name: string; seed: number | null; order_num: number };
type AttemptType = { id: string; event_class_id: string; entry_id: string; ordinal: number; status: string; elapsed_ms: number | null; distance_mm: number | null; penalty_ms: number; raw_input: string | null; save_version: number };

// We want to map DB types to the Scoring Engine types
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

export function ScoringWorkspace({
  trackId,
  trackSlug,
  eventSlug,
  event,
  classes,
  initialEntries,
  initialAttempts,
}: {
  trackId: string;
  trackSlug?: string;
  eventSlug?: string;
  event: EventType;
  classes: ClassType[];
  initialEntries: EntryType[];
  initialAttempts: AttemptType[];
}) {
  const [activeClassId, setActiveClassId] = useState<string>(classes[0]?.id || "");
  const [localAttempts, setLocalAttempts] = useState<AttemptType[]>(initialAttempts);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [cellErrors, setCellErrors] = useState<Record<string,string>>({});
  const [drafts, setDrafts] = useState<Record<string,string>>({});
  const [draftStorageReady, setDraftStorageReady] = useState(false);
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  const busyCells = useRef(new Set<string>());
  const acknowledgedRevision = useRef(event.working_revision);
  const confirmedAttempts = useRef(initialAttempts);
  const [visibleColumns, setVisibleColumns] = useState(2);

  const draftStorageKey = `raceholler:drafts:${trackId}:${event.id}`;
  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(draftStorageKey) ?? "{}");
      if (stored && typeof stored === "object" && !Array.isArray(stored)) {
        setDrafts(Object.fromEntries(Object.entries(stored).filter(([, value]) => typeof value === "string")) as Record<string,string>);
      }
    } catch { /* Storage may be unavailable; keep the in-memory draft. */ }
    setDraftStorageReady(true);
  }, [draftStorageKey]);
  useEffect(() => {
    if (!draftStorageReady) return;
    try {
      if (Object.keys(drafts).length) sessionStorage.setItem(draftStorageKey,JSON.stringify(drafts));
      else sessionStorage.removeItem(draftStorageKey);
    } catch { /* The scoring grid still retains draft input. */ }
  }, [draftStorageReady, draftStorageKey, drafts]);

  // Sync when initial data changes from server revalidation
  useEffect(() => {
    if (pendingSaves === 0 && event.working_revision >= acknowledgedRevision.current) {
      setLocalAttempts(initialAttempts);
      confirmedAttempts.current = initialAttempts;
      acknowledgedRevision.current = event.working_revision;
    }
  }, [initialAttempts, event.working_revision, pendingSaves]);

  useEffect(() => {
    if (!classes.some(c => c.id === activeClassId)) setActiveClassId(classes[0]?.id ?? "");
  }, [classes, activeClassId]);

  const activeClass = classes.find((c) => c.id === activeClassId);
  const activeEntries = initialEntries.filter((e) => e.event_class_id === activeClassId);

  // Compute ranks and scores for the active class
  const rankedEntries = useMemo(() => {
    if (!activeClass) return [];

    const attemptsForClass = localAttempts.filter((a) => a.event_class_id === activeClass.id);

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
        orderNum: entry.order_num || 999, // default if missing
        entryId: entry.id,
        attempts: entryAttempts,
      };
    });

    return rankEntries(entriesWithScore).sort((a, b) => a.orderNum - b.orderNum);

  }, [activeClass, activeEntries, localAttempts]);

  const handleInputBlur = async (entryId: string, ordinal: number, rawInput: string) => {
    if (!activeClass || event.status === "completed") return;
    const classId = activeClass.id;
    const key = `${entryId}:${ordinal}`;
    if (busyCells.current.has(key)) return;
    const previous = confirmedAttempts.current.find(a => a.entry_id === entryId && a.ordinal === ordinal);
    const parsed: ParsedAttempt = parseAttemptInput(rawInput, previous?.penalty_ms ?? 0);
    if (parsed.error) {
      setCellErrors(prev => ({ ...prev, [key]: parsed.error! }));
      return;
    }
    busyCells.current.add(key);
    setSavingCells(new Set(busyCells.current));
    setPendingSaves(s => s + 1);
    try {
      const result = await saveAttempt(trackId, event.id, classId, entryId, ordinal,
        rawInput, parsed.penaltyMs, previous?.save_version ?? 0);
      if (!result.success) throw new Error(result.error);
      const saved = result.attempt;
      const next = confirmedAttempts.current.filter(a => !(a.entry_id === entryId && a.ordinal === ordinal));
      next.push(saved);
      confirmedAttempts.current = next;
      acknowledgedRevision.current = Math.max(acknowledgedRevision.current, result.working_revision);
      setLocalAttempts(next);
      setDrafts(prev => { const next = { ...prev }; delete next[key]; return next; });
      setCellErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
    } catch (error) {
      setCellErrors(prev => ({ ...prev, [key]: error instanceof Error ? error.message : "Save failed. Try again." }));
    } finally {
      busyCells.current.delete(key);
      setSavingCells(new Set(busyCells.current));
      setPendingSaves(s => s - 1);
    }
  };

  const handleExportCSV = () => {
    if (!activeClass) return;
    const header = "Rank,Draw #,Racer,Score,Ties\n";
    const rows = [...rankedEntries].sort(compareRankedEntries).map(r => {
      const rowRank = r.rank == null ? "-" : r.tied ? `T${r.rank}` : r.rank;
      return `${rowRank},${r.orderNum},"${r.entry.display_name.replaceAll('"','""')}","${r.score.label}","${r.score.tieBreakers.join(", ")}"`;
    }).join("\n");
    
    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeClass.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_results.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* Top action bar */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between print:hidden">
        <div className="flex items-center space-x-4">
          <select
            value={activeClassId}
            onChange={(e) => setActiveClassId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg py-2 px-3 text-sm focus:ring-amber-500 focus:border-amber-500"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.scoring_type.replace(/_/g, " ")})
              </option>
            ))}
          </select>
          <span className="text-sm font-medium text-slate-400">
            {pendingSaves > 0 ? (
              <span className="flex items-center space-x-1.5 text-amber-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </span>
            ) : Object.keys(cellErrors).length ? (
              <span className="text-red-400">Unsaved changes</span>
            ) : Object.keys(drafts).length ? (
              <span className="text-amber-400">Editing — not saved yet</span>
            ) : (
              <span className="flex items-center space-x-1.5 text-emerald-500">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{event.status === "live" ? "Saved · live event" : event.status === "completed" ? "Final results · locked" : "Saved · unpublished"}</span>
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Link 
              href={`/dashboard/tracks/${trackId}/events/${event.id}/entries`} 
              className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition text-sm mr-2"
            >
              <Users className="w-4 h-4" />
              <span>Manage Roster</span>
            </Link>
            {trackSlug && eventSlug && (
              <a href={`/r/${trackSlug}/${eventSlug}`} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-lg border border-amber-500/20 transition text-sm font-bold mr-2">
                <ExternalLink className="w-4 h-4" />
                <span>Live Site</span>
              </a>
            )}
            <button onClick={handleExportCSV} className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition text-sm">
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
            <button onClick={() => window.print()} className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition text-sm">
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
          </div>
          
          <div className="flex items-center space-x-2 bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button onClick={() => setVisibleColumns(Math.max(1, visibleColumns - 1))} className="px-2 py-1 hover:bg-slate-700 rounded text-slate-300">- Col</button>
            <span className="text-sm text-slate-400 font-mono px-2">{visibleColumns}</span>
            <button onClick={() => setVisibleColumns(Math.min(100, visibleColumns + 1))} className="px-2 py-1 hover:bg-slate-700 rounded text-slate-300">+ Col</button>
          </div>
        </div>
      </div>

      {/* Grid */}
      {Object.keys(cellErrors).length > 0 && <p role="alert" className="p-4 text-red-400">{[...new Set(Object.values(cellErrors))].join(" · ")} Your input is retained; retry the highlighted pass or refresh after a conflict.</p>}
      <div className="flex-1 overflow-auto bg-[#0B1120] p-4 print:hidden">
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-800/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 w-16 text-center">Rank</th>
                <th className="px-4 py-3 w-16 text-center">Order</th>
                <th className="px-4 py-3">Racer / Entry</th>
                {Array.from({ length: visibleColumns }).map((_, i) => (
                  <th key={i} className="px-4 py-3 w-32">Pass {i + 1}</th>
                ))}
                <th className="px-4 py-3 w-40 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {rankedEntries.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns + 4} className="px-4 py-8 text-center text-slate-500">
                    No entries in this class yet.
                  </td>
                </tr>
              ) : (
                rankedEntries.map((row) => (
                  <tr key={row.entryId} className="hover:bg-slate-800/30 transition group">
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full font-bold text-xs ${
                          row.rank === 1 && row.score.eligible
                            ? "bg-amber-500 text-amber-950"
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
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500 font-mono text-xs">
                       {row.orderNum !== 999 ? row.orderNum : "-"}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">
                      {row.entry.display_name}
                    </td>
                    {Array.from({ length: visibleColumns }).map((_, i) => {
                      const ordinal = i + 1;
                      const attempt = row.attempts.find((a) => a.ordinal === ordinal);
                      const key = `${row.entryId}:${ordinal}`;
                      return (
                        <td key={ordinal} className="px-2 py-2">
                          <input
                            type="text"
                            value={drafts[key] ?? attempt?.rawInput ?? ""}
                            onChange={e => {
                              const value = e.target.value;
                              setDrafts(prev => { const next = { ...prev }; if (value === (attempt?.rawInput ?? "")) delete next[key]; else next[key] = value; return next; });
                              if (value === (attempt?.rawInput ?? "")) setCellErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
                            }}
                            disabled={savingCells.has(key) || event.status === "completed"}
                            aria-label={`${row.entry.display_name}, pass ${ordinal}`}
                            aria-invalid={Boolean(cellErrors[key])}
                            title={cellErrors[key]}
                            onBlur={(e) => {
                              if (e.target.value !== (attempt?.rawInput || "")) {
                                handleInputBlur(row.entryId, ordinal, e.target.value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.currentTarget.blur();
                              }
                            }}
                            placeholder="-"
                            className={`w-full bg-slate-950/50 border ${cellErrors[key] ? "border-red-500" : "border-slate-700/50"} rounded px-2 py-1.5 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition font-mono text-sm text-center disabled:opacity-50`}
                          />
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right">
                      {row.score.eligible ? (
                        <span className="font-mono font-bold text-amber-400">
                          {row.score.label}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic text-xs">
                          {row.score.label || "No score"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print-only Table Sorted by Rank */}
      <div className="hidden print:block p-8 bg-white text-black w-full">
        <h1 className="text-2xl font-bold mb-1">{event.name}</h1>
        <h2 className="text-lg font-semibold text-gray-700 mb-6">{activeClass?.name} Results</h2>
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
            {[...rankedEntries]
              .sort(compareRankedEntries)
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
