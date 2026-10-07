import {Attempt,adjustedTime,Score} from '@/scoring/types';
export function chronologicalRaces<T extends {id:string;status:string;local_date:string}>(events:T[]):T[]{return [...events].sort((a,b)=>Number(b.status==='live')-Number(a.status==='live')||a.local_date.localeCompare(b.local_date)||a.id.localeCompare(b.id));}
export type ResultOrder='run'|'rank'|'name'|`pass:${number}`;
export function sortResults<T extends {entryId:string;orderNum:number;rank:number|null;score:Score;attempts:Attempt[];entry?:{display_name:string}}>(rows:T[],order:ResultOrder,reverse=false):T[]{
 if(order==='name')return [...rows].sort((a,b)=>(a.entry?.display_name||'').localeCompare(b.entry?.display_name||'',undefined,{numeric:true,sensitivity:'base'})*(reverse?-1:1)||a.orderNum-b.orderNum||a.entryId.localeCompare(b.entryId));
 const pass=order.startsWith('pass:')?Number(order.split(':')[1]):null;
 const metric=(row:T):[number,number]|null=>{
  if(order==='run')return [0,row.orderNum];if(order==='rank')return row.rank===null?null:[0,row.rank];
  const a=row.attempts.find(a=>a.ordinal===pass);if(!a||a.status!=='valid')return null;
  if(a.points!==undefined)return [0,-a.points];
  const time=adjustedTime(a);if(time!==null)return [0,time];if(a.distanceMm!==null)return [1,-a.distanceMm];return null;
 };
 return [...rows].sort((a,b)=>{const x=metric(a),y=metric(b);if(!x||!y)return x?-1:y?1:a.orderNum-b.orderNum||a.entryId.localeCompare(b.entryId);return (x[0]-y[0]||(x[1]-y[1])*(reverse?-1:1))||a.orderNum-b.orderNum||a.entryId.localeCompare(b.entryId);});
}
export function passCount(config:any,attempts:{ordinal:number}[]){return Math.min(100,Math.max(2,Number(config?.requiredPasses)||0,Number(config?.judgedRounds)||0,...(config?.requiredOrdinals||[]),...attempts.map(a=>a.ordinal)));}
