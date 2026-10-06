import {judgeConfig} from "@/scoring/multi-judge";
import { scoreClass } from '@/scoring';
export const formats = [['fastest_pass','Fastest pass'],['consistency','Consistency'],['combined_time','Combined times'],['stopped_distance','Distance'],['judged_points','Judged points']] as const;
export function scoringFromForm(form: FormData) {
 const type=String(form.get('scoring_type') || 'fastest_pass');
 const config={ decimals:Number(form.get('decimals') ?? 3), requiredPasses:Number(form.get('requiredPasses') || 2), requiredOrdinals:[Number(form.get('pass1') || 1),Number(form.get('pass2') || 2)] };
 const rubric=Array.from({length:5},(_,i)=>({key:String(form.get(`category_key_${i}`)||`category_${i}`),label:String(form.get(`category_${i}`)||""),max:Number(form.get(`category_max_${i}`)||0)})).filter(r=>r.label.trim());
 const judged={judgeCount:Number(form.get("judgeCount")||1),judgedRounds:Number(form.get("judgedRounds")||1),aggregation:String(form.get("aggregation")||"sum"),rubric:rubric.length?rubric:[{key:"total",label:"Total",max:100}]};
 if(type==="judged_points")judgeConfig(judged);
 const check=scoreClass(type,[],config);
 if(check.details.error) throw new Error(String(check.details.error));
 return {scoring_type:type as import('@/types/database').Database['public']['Enums']['scoring_type'],scoring_config:{...config,...judged}};
}
export function ScoringFields({type='fastest_pass',config={}}:{type?:string;config?:unknown}) {
 const c=(config || {}) as Record<string,any>;
 return <fieldset className="space-y-3"><legend className="font-bold">Scoring rules</legend>
 <label className="block">Format<select name="scoring_type" defaultValue={type} className="block w-full p-3 bg-slate-950 border rounded">{formats.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
 <label className="block">Time precision<select name="decimals" defaultValue={c.decimals ?? 3} className="block w-full p-3 bg-slate-950 border rounded">{[0,1,2,3].map(n=><option key={n} value={n}>{n} decimal places</option>)}</select></label>
 <label className="block">Passes required for combined times<input name="requiredPasses" type="number" min="1" max="100" defaultValue={c.requiredPasses ?? 2} className="block w-full p-3 bg-slate-950 border rounded"/></label>
 <div className="grid grid-cols-2 gap-3">{[0,1].map(i=><label key={i}>Consistency pass {i+1}<input name={i?'pass2':'pass1'} type="number" min="1" max="100" defaultValue={c.requiredOrdinals?.[i] ?? i+1} className="block w-full p-3 bg-slate-950 border rounded"/></label>)}</div>
 <details><summary className="p-3 border rounded">Judge scoring settings</summary><div className="space-y-3 py-3"><label className="block">Required judges<input type="number" name="judgeCount" min="1" max="20" defaultValue={c.judgeCount??1} className="block w-full p-3 bg-slate-950 border rounded"/></label><label className="block">Judged rounds<input type="number" name="judgedRounds" min="1" max="100" defaultValue={c.judgedRounds??1} className="block w-full p-3 bg-slate-950 border rounded"/></label><label>Aggregation<select name="aggregation" defaultValue={c.aggregation??"sum"} className="block w-full p-3 bg-slate-950 border rounded"><option value="sum">Sum all judges</option><option value="average">Average judges per round</option></select></label><p>Categories (leave unused rows blank; default is Total, maximum 100).</p>{Array.from({length:5},(_,i)=><div key={i} className="grid grid-cols-2 gap-3"><input type="hidden" name={`category_key_${i}`} value={c.rubric?.[i]?.key || `category_${i}`}/><label>Category {i+1}<input name={`category_${i}`} defaultValue={c.rubric?.[i]?.label??(i===0?"Total":"")} className="block w-full p-3 bg-slate-950 border rounded"/></label><label>Maximum<input name={`category_max_${i}`} type="number" step="0.001" min="0.001" defaultValue={c.rubric?.[i]?.max??(i===0?100:"")} className="block w-full p-3 bg-slate-950 border rounded"/></label></div>)}</div></details>
 </fieldset>;
}
