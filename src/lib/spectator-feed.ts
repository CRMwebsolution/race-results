import {chronologicalRaces} from './race-order';
export type FeedRace={id:string;name:string;slug:string;local_date:string;status:string;published_revision:number|null;track_id:string|null;series_id:string|null;venue_description:string|null};
export function spectatorFeed(events:FeedRace[],tracks:{id:string;name:string;slug:string;state:string|null}[],series:{id:string;name:string}[],filters:{type?:string;state?:string;track?:string;view?:string}){
 return chronologicalRaces(events).flatMap<FeedRace&{type:'track'|'series';ownerName:string;location:string;href:string}>(e=>{
  const isSeries=!!e.series_id;
  if(filters.type==='track'&&isSeries||filters.type==='series'&&!isSeries)return [];
  if(e.status!=='scheduled'&&(e.published_revision||0)<1)return [];
  if(filters.view&&e.status!=='live'&&(filters.view==='upcoming'?e.status!=='scheduled':e.status!=='completed'))return [];
  if(isSeries){const owner=series.find(s=>s.id===e.series_id);return owner?[{...e,type:'series' as const,ownerName:owner.name,location:e.venue_description||'Venue to be announced',href:`/s/${owner.id}/races/${e.slug}`}]:[];}
  const owner=tracks.find(t=>t.id===e.track_id);
  if(!owner||filters.state&&owner.state!==filters.state||filters.track&&owner.id!==filters.track)return [];
  return [{...e,type:'track' as const,ownerName:owner.name,location:owner.state||'',href:`/r/${owner.slug}/${e.slug}`}];
 });
}
