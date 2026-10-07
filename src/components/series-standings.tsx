import type {calculateSeries, Standing} from '@/championship/calculate';

export function SeriesStandings({payload,current=true}:{payload:ReturnType<typeof calculateSeries>;current?:boolean}) {
 const classes=new Map<string,{name:string;rows:Standing[]}>();
 for(const row of payload.standings) {
  const group=classes.get(row.classId)||{name:row.className,rows:[]};
  group.rows.push(row);classes.set(row.classId,group);
 }
 return <section className="space-y-6">
  <h2 className="text-2xl font-bold">Series standings</h2>
  {!current&&<p role="alert" className="text-amber-300">Archived standings. Results, schedule or rules changed; rebuild before using these totals as current.</p>}
  <p className="text-sm text-slate-400">{payload.policy.replace(/championship/gi,'Series')}</p>
  {payload.warnings?.map(w=><p key={w} className="text-amber-300 text-sm">{w}</p>)}
  {[...classes].map(([id,group])=><section key={id} aria-label={`${group.name} points standings`} className="space-y-3">
   <h3 className="text-xl font-bold border-b border-slate-700 pb-2">{group.name}</h3>
   {[...group.rows].sort((a,b)=>a.rank-b.rank||a.name.localeCompare(b.name)).map(r=><details key={r.racerId} className="p-4 border rounded bg-slate-900">
    <summary className="cursor-pointer font-bold">{r.tied?'T':''}{r.rank}. {r.name} · {r.total} pts</summary>
    <div className="space-y-3 pt-4">{r.breakdown.map(b=><div key={b.eventId}><h4 className="font-bold">{b.eventName}: {b.total} pts</h4><p>Placement: {b.placement}</p>{b.bonuses.map(a=><p key={a.ruleId}>Bonus: {a.points} · {a.reason}</p>)}{b.adjustments.map(a=><p key={a.id}>Adjustment: {a.points} · {a.reason}</p>)}</div>)}</div>
   </details>)}
  </section>)}
  {!payload.standings.length&&<p>No eligible linked official results yet.</p>}
 </section>;
}
