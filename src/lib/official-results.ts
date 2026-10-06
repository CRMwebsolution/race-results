import type {createClient} from '@/lib/supabase/server';
import type {Score} from '@/scoring';
export type OfficialRow={id:string;final_rank:number|null;score?:Score;tied?:boolean};
export async function officialResult(db:Awaited<ReturnType<typeof createClient>>,eventId:string,version?:number){
 let q=db.from('event_result_versions').select('*').eq('event_id',eventId).order('version',{ascending:false}).limit(1);if(version)q=q.eq('version',version);
 const {data,error}=await q.maybeSingle();if(error)throw new Error(error.message);return data;
}
