import {Score} from './types';
export type JudgeInput={assignmentId:string;entryId:string;ordinal:number;values:Record<string,number>};
export type JudgeConfig={judgeCount:number;judgedRounds:number;aggregation:'sum'|'average';rubric:{key:string;label:string;max:number}[]};
export function judgeConfig(raw:unknown):JudgeConfig {
 const c=(raw||{}) as Partial<JudgeConfig>;
 const config={judgeCount:c.judgeCount??1,judgedRounds:c.judgedRounds??1,aggregation:c.aggregation??'sum',rubric:c.rubric??[{key:'total',label:'Total',max:100}]};
 if(!Number.isInteger(config.judgeCount)||config.judgeCount<1||config.judgeCount>20||!Number.isInteger(config.judgedRounds)||config.judgedRounds<1||config.judgedRounds>100||!['sum','average'].includes(config.aggregation)||!Array.isArray(config.rubric)||!config.rubric.length||config.rubric.length>10||new Set(config.rubric.map(r=>r.key)).size!==config.rubric.length||config.rubric.some(r=>!r.key||!r.label||!Number.isFinite(r.max)||r.max<=0))throw new Error('Invalid judge count, rounds, aggregation or category limits');
 return config as JudgeConfig;
}
export function scoreMultiJudge(scores:JudgeInput[],raw:unknown):Score{
 const missing=(label:string,error=false):Score=>({eligible:false,group:'none',primary:null,direction:'desc',tieBreakers:[],label,details:error?{error:label}:{missingJudges:true}});
 let c:JudgeConfig;try{c=judgeConfig(raw);}catch(e){return missing((e as Error).message,true);}
 let total=0;
 for(let round=1;round<=c.judgedRounds;round++){
  const submitted=scores.filter(s=>s.ordinal===round);
  if(submitted.length!==c.judgeCount||new Set(submitted.map(s=>s.assignmentId)).size!==c.judgeCount)return missing(`Round ${round}: ${submitted.length}/${c.judgeCount} judges`);
  let points=0;
  for(const s of submitted){if(Object.keys(s.values).length!==c.rubric.length)return missing('Missing or extra categories',true);for(const category of c.rubric){const v=s.values[category.key];if(!Number.isFinite(v)||v<0||v>category.max)return missing(`Invalid ${category.label} points`,true);points+=v;}}
  total+=c.aggregation==='average'?points/c.judgeCount:points;
 }
 total=Math.round(total*1000)/1000;
 return {eligible:true,group:'timed',primary:total,direction:'desc',tieBreakers:[],label:`${total.toFixed(3).replace(/\.?0+$/,'')} pts`,details:{aggregation:c.aggregation,judgeCount:c.judgeCount,rounds:c.judgedRounds,total}};
}
export function judgeInput(rows:{assignment_id:string;entry_id:string;ordinal:number;values:unknown}[]):JudgeInput[]{return rows.map(s=>({assignmentId:s.assignment_id,entryId:s.entry_id,ordinal:s.ordinal,values:s.values as Record<string,number>}));}

export function judgeRoundAttempts(entryId:string,scores:JudgeInput[],config:unknown){
 const c=judgeConfig(config);return Array.from({length:c.judgedRounds},(_,i)=>{const score=scoreMultiJudge(scores.filter(s=>s.ordinal===i+1).map(s=>({...s,ordinal:1})),{...c,judgedRounds:1});return {id:`judge:${entryId}:${i+1}`,entryId,ordinal:i+1,status:score.eligible?'valid' as const:'no_time' as const,elapsedMs:null,distanceMm:null,penaltyMs:0,points:score.primary??undefined,rawInput:score.label};});
}
