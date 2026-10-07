import {createClient} from '@/lib/supabase/server';
import {readAll} from '@/lib/read-all';
import {SeriesStandings} from './series-standings';
import type {calculateSeries} from '@/championship/calculate';
export async function PublicCompetition({trackId,seriesId,selected}:{trackId?:string;seriesId?:string;selected?:string}){
 const db=await createClient();const {data:seasons,error}=await readAll(db.from('competition_seasons').select('*').eq(seriesId?'series_id':'track_id',(seriesId||trackId)!).order('starts_on',{ascending:false}));if(error)throw new Error(error.message);
 return <section className="space-y-6">{!seasons.length&&<p>No championship season announced.</p>}{seasons.filter(s=>!selected||s.id===selected).map(s=><SeasonStandings key={s.id} seasonId={s.id} name={s.name}/>)}</section>;
}
async function SeasonStandings({seasonId,name}:{seasonId:string;name:string}){
 const db=await createClient();const {data:version,error}=await db.from('competition_result_versions').select('*').eq('season_id',seasonId).eq('is_current',true).order('version',{ascending:false}).limit(1).maybeSingle();if(error)throw new Error(error.message);
 return <section className="space-y-3"><h2 className="text-2xl font-bold">{name}</h2>{version?<SeriesStandings payload={version.payload as unknown as ReturnType<typeof calculateSeries>}/>:<p>The organizer has not published current championship standings.</p>}</section>;
}
