import {calculateSeries, type Snapshot, type Bonus, type Standing} from './calculate';
import type {Registration,ChampionshipClass,ChampionshipRule,PointsChange} from '@/types/competitions';
export type CompetitionInput={events:{id:string;name:string;status:string;local_date:string}[];snapshots:Snapshot[];registrations:Registration[];classes:ChampionshipClass[];rules:ChampionshipRule[];bonuses:Bonus[];changes:PointsChange[]};
export function calculateCompetition(input:CompetitionInput){
 const names=input.registrations.map(r=>({id:r.id,display_name:r.display_name+(r.vehicle_name?` · ${r.vehicle_name}`:'')}));
 const snapshots=input.snapshots.map(s=>{
  const date=input.events.find(e=>e.id===s.event_id)?.local_date||'';
  const frozen=(s.payload as typeof s.payload&{registrations?:Array<{id:string;eligible:boolean}>}).registrations;
  const entries=s.payload.entries.map(e=>{
   const r=input.registrations.find(r=>r.id===e.registration_id || (r.legacy_roster_id&&r.legacy_roster_id===e.series_roster_id));
   const eligible=r && (frozen ? frozen.some(f=>f.id===r.id&&f.eligible) : date>=r.joined_on&&(!r.left_on||date<r.left_on));
   return {...e,series_racer_id:eligible?r!.id:null};
  });
  const results=s.payload.results.map(r=>({...r}));
  for(const classId of new Set(entries.map(e=>e.event_class_id))){
   const eligible=entries.filter(e=>e.event_class_id===classId&&e.series_racer_id&&results.some(r=>r.id===e.id&&r.final_rank!=null)).sort((a,b)=>results.find(r=>r.id===a.id)!.final_rank-results.find(r=>r.id===b.id)!.final_rank);
   let lastOverall:number|null=null,lastPoints=0;
   eligible.forEach((e,i)=>{const result=results.find(r=>r.id===e.id)!;const overall=result.final_rank;const pointsRank=overall===lastOverall?lastPoints:i+1;lastOverall=overall;lastPoints=pointsRank;result.final_rank=pointsRank;});
  }
  return {...s,payload:{...s.payload,entries,results,classes:s.payload.classes.map(c=>({...c,series_class_id:c.competition_class_id||input.classes.find(cc=>cc.series_class_id===c.series_class_id)?.id||null}))}};
 });
 const payload=calculateSeries({events:input.events,snapshots,rules:input.rules,bonuses:input.bonuses,awards:[],racers:names,classes:input.classes});
 payload.warnings=payload.warnings.filter(w=>!w.startsWith('Unlinked historical'));
 for(const r of input.registrations){if(!payload.standings.some(s=>s.racerId===r.id))payload.standings.push({racerId:r.id,classId:r.class_id,name:names.find(n=>n.id===r.id)!.display_name,className:input.classes.find(c=>c.id===r.class_id)?.name||'Class',total:0,rank:0,tied:false,breakdown:[]});}
 const groups=new Map<string,PointsChange[]>();
 for(const c of input.changes){if(c.event_id&&!input.events.some(e=>e.id===c.event_id&&e.status==='completed'))continue;const key=`${c.registration_id}:${c.event_id||'season'}`;groups.set(key,[...(groups.get(key)||[]),c]);}
 for(const changes of groups.values()){
  changes.sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
  const first=changes[0],row=payload.standings.find(s=>s.racerId===first.registration_id);if(!row)continue;
  const eventId=first.event_id||'season';let b=row.breakdown.find(b=>b.eventId===eventId);
  if(!b){b={eventId,eventName:first.event_id?input.events.find(e=>e.id===first.event_id)!.name:'Season awards / signup bonuses',placement:0,bonuses:[],adjustments:[],total:0};row.breakdown.push(b);}
  let total=b.total;
  for(const c of changes){const next=c.mode==='override'?c.points:total+c.points;b.adjustments.push({id:c.id,reason:`${c.mode==='override'?'Set race points':'Adjustment'}: ${c.reason}`,points:next-total,actorId:c.actor_id});total=next;}
  b.total=total;
 }
 for(const row of payload.standings)row.total=row.breakdown.reduce((sum,b)=>sum+b.total,0);
 for(const classId of new Set(payload.standings.map(s=>s.classId))){const rows=payload.standings.filter(s=>s.classId===classId).sort((a,b)=>b.total-a.total||a.racerId.localeCompare(b.racerId));rows.forEach((r,i)=>{r.rank=i&&r.total===rows[i-1].total?rows[i-1].rank:i+1;r.tied=(i>0&&r.total===rows[i-1].total)||(i+1<rows.length&&r.total===rows[i+1].total);});}
 payload.standings.sort((a,b)=>a.className.localeCompare(b.className)||a.rank-b.rank||a.racerId.localeCompare(b.racerId));
 payload.policy='Overall race ranks determine prizes. Series points ranks include only eligible registered entries. Eligibility is retained with official race results. Manual amendments retain explanations and history.';
 return payload;
}
