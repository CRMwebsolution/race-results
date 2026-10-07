import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database';
import {readAll} from '@/lib/read-all';
export type RaceChampionship={name:string;eligibleEntryIds:string[];classIds:string[];rules:{rank_start:number;rank_end:number;points:number}[]};
export async function publicRaceChampionship(db:SupabaseClient<Database>,event:{competition_season_id:string|null;local_date:string},entries:{id:string;registration_id?:string|null;event_class_id:string}[],classes:{id:string;competition_class_id?:string|null}[],frozen?:{id:string;eligible:boolean}[]):Promise<RaceChampionship|undefined>{
 if(!event.competition_season_id)return undefined;
 const results=await Promise.all([db.from('competition_seasons').select('name').eq('id',event.competition_season_id).single(),readAll(db.from('competition_registrations').select('*').eq('season_id',event.competition_season_id)),readAll(db.from('competition_points_rules').select('*').eq('season_id',event.competition_season_id))]);
 for(const r of results)if(r.error)throw new Error(r.error.message);
 const [{data:season},{data:registrations},{data:rules}]=results;
 const eligibleEntryIds=entries.filter(e=>{const r=registrations.find(r=>r.id===e.registration_id);return r && (frozen?frozen.some(f=>f.id===r.id&&f.eligible):event.local_date>=r.joined_on&&(!r.left_on||event.local_date<r.left_on))&&classes.some(c=>c.id===e.event_class_id&&c.competition_class_id===r.class_id);}).map(e=>e.id);
 return {name:season!.name,eligibleEntryIds,classIds:classes.filter(c=>c.competition_class_id).map(c=>c.id),rules};
}
