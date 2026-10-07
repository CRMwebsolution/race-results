import {createClient} from '@/lib/supabase/server';
import {notFound} from 'next/navigation';
import {PublicCompetition} from '@/components/public-competition';
export default async function TrackStandings({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const db=await createClient();const {data:track}=await db.from('tracks').select('id,spectator_points_mode').eq('slug',slug).single();if(!track||track.spectator_points_mode!=='race_and_total')notFound();return <PublicCompetition trackId={track.id}/>;}
