type Class = {id:string;order_num:number};
type Activity = {event_class_id:string;updated_at?:string|null};
export function latestScoringClass(classes:Class[], attempts:Activity[], judges:Activity[]=[]):string {
 const ordered=[...classes].sort((a,b)=>a.order_num-b.order_num || a.id.localeCompare(b.id));
 const known=new Set(ordered.map(c=>c.id));
 let latest=Number.NEGATIVE_INFINITY, selected=ordered[0]?.id || "";
 for(const row of [...attempts,...judges]) {
  const timestamp=row.updated_at ? Date.parse(row.updated_at) : Number.NaN;
  if(known.has(row.event_class_id) && Number.isFinite(timestamp) && timestamp>latest) {
   latest=timestamp;selected=row.event_class_id;
  }
 }
 return selected;
}
