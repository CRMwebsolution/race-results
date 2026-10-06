import { scoreClass } from '@/scoring';
export const formats = [['fastest_pass','Fastest pass'],['consistency','Consistency'],['combined_time','Combined times'],['stopped_distance','Distance'],['judged_points','Judged points']] as const;
export function scoringFromForm(form: FormData) {
 const type=String(form.get('scoring_type') || 'fastest_pass');
 const config={ decimals:Number(form.get('decimals') ?? 3), requiredPasses:Number(form.get('requiredPasses') || 2), requiredOrdinals:[Number(form.get('pass1') || 1),Number(form.get('pass2') || 2)] };
 const check=scoreClass(type,[],config);
 if(check.details.error) throw new Error(String(check.details.error));
 return {scoring_type:type as import('@/types/database').Database['public']['Enums']['scoring_type'],scoring_config:config};
}
export function ScoringFields({type='fastest_pass',config={}}:{type?:string;config?:unknown}) {
 const c=(config || {}) as Record<string,any>;
 return <fieldset className="space-y-3"><legend className="font-bold">Scoring rules</legend>
 <label className="block">Format<select name="scoring_type" defaultValue={type} className="block w-full p-3 bg-slate-950 border rounded">{formats.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
 <label className="block">Time precision<select name="decimals" defaultValue={c.decimals ?? 3} className="block w-full p-3 bg-slate-950 border rounded">{[0,1,2,3].map(n=><option key={n} value={n}>{n} decimal places</option>)}</select></label>
 <label className="block">Passes required for combined times<input name="requiredPasses" type="number" min="1" max="100" defaultValue={c.requiredPasses ?? 2} className="block w-full p-3 bg-slate-950 border rounded"/></label>
 <div className="grid grid-cols-2 gap-3">{[0,1].map(i=><label key={i}>Consistency pass {i+1}<input name={i?'pass2':'pass1'} type="number" min="1" max="100" defaultValue={c.requiredOrdinals?.[i] ?? i+1} className="block w-full p-3 bg-slate-950 border rounded"/></label>)}</div>
 </fieldset>;
}
