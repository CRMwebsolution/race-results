import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database';
import {readAll} from '@/lib/read-all';
import {calculateCompetition} from './competition';
import type {Snapshot,Bonus} from './calculate';
export async function loadCompetition(db:SupabaseClient<Database>,seasonId:string){
 const {data:season,error}=await db.from('competition_seasons').select('*').eq('id',seasonId).single();if(error||!season)throw new Error(error?.message||'Season unavailable');
 const results=await Promise.all([
 readAll(db.from('events').select('*').eq('competition_season_id',seasonId).order('local_date')),
 readAll(db.from('competition_registrations').select('*').eq('season_id',seasonId).order('created_at')),
 readAll(db.from('competition_classes').select('*').eq('season_id',seasonId).order('name')),
 readAll(db.from('competition_points_rules').select('*').eq('season_id',seasonId).order('rank_start')),
 readAll(db.from('competition_bonuses').select('*').eq('season_id',seasonId)),
 readAll(db.from('competition_points_changes').select('*').eq('season_id',seasonId).order('created_at')),
 ]);
 for(const r of results)if(r.error)throw new Error(r.error.message);
 const [{data:events},{data:registrations},{data:classes},{data:rules},{data:bonuses},{data:changes}]=results;
 const ids=events.filter(e=>e.status==='completed').map(e=>e.id);
 const {data:history,error:historyError}=ids.length?await readAll(db.from('event_result_versions').select('*').in('event_id',ids).order('version',{ascending:false})):{data:[],error:null};if(historyError)throw new Error(historyError.message);
 const snapshots=history.filter((v,i,a)=>a.findIndex(x=>x.event_id===v.event_id)===i) as unknown as Snapshot[];
 const input={events,registrations,classes,rules,bonuses:bonuses as Bonus[],changes,snapshots};
 return {season,input,payload:calculateCompetition(input)};
}
