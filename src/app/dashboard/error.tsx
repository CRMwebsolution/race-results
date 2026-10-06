"use client";
export default function DashboardError({ reset }: { reset: () => void }) {
  return <div className="p-6 space-y-4" role="alert"><h2 className="text-xl font-bold">This page could not load or save its data.</h2><p>Please retry. Your previously saved records are still stored.</p><button onClick={reset} className="px-4 py-3 rounded bg-amber-500 text-slate-950">Retry</button></div>;
}
