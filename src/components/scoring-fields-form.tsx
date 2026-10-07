'use client';
import {useState} from 'react';
const formats=[['fastest_pass','Fastest pass'],['consistency','Consistency'],['combined_time','Combined times'],['stopped_distance','Distance'],['judged_points','Judged points']];
const field='block w-full min-w-0 p-3 bg-slate-950 border rounded';
export function ScoringFields({type='fastest_pass',config={}}:{type?:string;config?:unknown}){
 const [format,setFormat]=useState(type);const c=(config||{}) as Record<string,any>;
 return <fieldset className="space-y-4 min-w-0"><legend className="font-bold">Class scoring rules</legend>
 <label className="block">Format<select name="scoring_type" value={format} onChange={e=>setFormat(e.target.value)} className={field}>{formats.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
 {format!=='judged_points'&&<label className="block">Time precision<select name="decimals" defaultValue={c.decimals??3} className={field}>{[0,1,2,3].map(n=><option key={n} value={n}>{n} decimal places</option>)}</select></label>}
 {format==='combined_time'&&<label className="block">Passes required for combined times<input name="requiredPasses" type="number" min="1" max="100" defaultValue={c.requiredPasses??2} className={field}/></label>}
 {format==='consistency'&&<div className="grid sm:grid-cols-2 gap-3">{[0,1].map(i=><label key={i}>Consistency pass {i+1}<input name={i?'pass2':'pass1'} type="number" min="1" max="100" defaultValue={c.requiredOrdinals?.[i]??i+1} className={field}/></label>)}</div>}
 {format==='judged_points'&&<div className="space-y-3"><h3 className="font-semibold">Judge scoring settings</h3><label className="block">Required judges<input type="number" name="judgeCount" min="1" max="20" defaultValue={c.judgeCount??1} className={field}/></label><label className="block">Judged rounds<input type="number" name="judgedRounds" min="1" max="100" defaultValue={c.judgedRounds??1} className={field}/></label><label className="block">Aggregation<select name="aggregation" defaultValue={c.aggregation??'sum'} className={field}><option value="sum">Sum all judges</option><option value="average">Average judges per round</option></select></label><p>Scoring categories. Leave unused rows blank.</p>{Array.from({length:5},(_,i)=><div key={i} className="grid sm:grid-cols-2 gap-3"><input type="hidden" name={`category_key_${i}`} value={c.rubric?.[i]?.key||`category_${i}`}/><label>Category {i+1}<input name={`category_${i}`} defaultValue={c.rubric?.[i]?.label??(i===0?'Total':'')} className={field}/></label><label>Maximum<input name={`category_max_${i}`} type="number" step="0.001" min="0.001" defaultValue={c.rubric?.[i]?.max??(i===0?100:'')} className={field}/></label></div>)}</div>}
 </fieldset>;
}
