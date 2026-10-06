import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {ScoringFields,scoringFromForm} from '@/components/scoring-fields';
export default async function NewClassPage({params,searchParams}:{params:Promise<{trackId:string;eventId:string}>;searchParams:Promise<{error?:string}>}) {
 const {trackId,eventId}=await params;const {error}=await searchParams;
 async function save(f:FormData){'use server';const db=await createClient();const rules=scoringFromForm(f);const {error}=await db.rpc('create_event_class',{p_event_id:eventId,p_name:String(f.get('name')),p_type:rules.scoring_type,p_config:rules.scoring_config});if(error)redirect(`/dashboard/tracks/${trackId}/events/${eventId}/classes/new?error=${encodeURIComponent(error.message)}`);redirect(`/dashboard/tracks/${trackId}/events/${eventId}`);}
 return <main className="p-4 sm:p-8 max-w-2xl w-full mx-auto space-y-6"><h1 className="text-2xl font-bold">Add event class</h1>{error&&<p role="alert">{error}</p>}<form action={save} className="space-y-4"><label className="block">Name<input name="name" required className="block w-full p-3 bg-slate-900 border rounded"/></label><ScoringFields/><button className="p-3 bg-amber-500 text-slate-950 rounded">Create class</button></form></main>;
}
