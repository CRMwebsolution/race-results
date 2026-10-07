import {judgeConfig} from "@/scoring/multi-judge";
import { scoreClass } from '@/scoring';
export {scoringFormats as formats} from '@/scoring/formats';
export function scoringFromForm(form: FormData) {
 const type=String(form.get('scoring_type') || 'fastest_pass');
 const config={ decimals:Number(form.get('decimals') ?? 3), requiredPasses:Number(form.get('requiredPasses') || 2), requiredOrdinals:[Number(form.get('pass1') || 1),Number(form.get('pass2') || 2)] };
 const rubric=Array.from({length:5},(_,i)=>({key:String(form.get(`category_key_${i}`)||`category_${i}`),label:String(form.get(`category_${i}`)||""),max:Number(form.get(`category_max_${i}`)||0)})).filter(r=>r.label.trim());
 const judged={judgeCount:Number(form.get("judgeCount")||1),judgedRounds:Number(form.get("judgedRounds")||1),aggregation:String(form.get("aggregation")||"sum"),rubric:rubric.length?rubric:[{key:"total",label:"Total",max:100}]};
 if(type==="judged_points")judgeConfig(judged);
 const check=scoreClass(type,[],{...config,...judged});
 if(check.details.error) throw new Error(String(check.details.error));
 return {scoring_type:type as import('@/types/database').Database['public']['Enums']['scoring_type'],scoring_config:{...config,...judged}};
}
export {ScoringFields} from './scoring-fields-form';
