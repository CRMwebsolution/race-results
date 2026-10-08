import {ActionFeedback} from '@/components/action-feedback';
import {createClient} from '@/lib/supabase/server';
import {readAll} from '@/lib/read-all';
import {uniqueRaceSlug} from '@/lib/slug';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import Link from 'next/link';
export default async function Schedule({params,searchParams}:{params:Promise<{seriesId:string}>;searchParams:Promise<{error?:string;message?:string}>}){
 const {seriesId}=await params;const p=await searchParams;const db=await createClient();const base=`/dashboard/series/${seriesId}`;
 const {data:seasons}=await readAll(db.from("competition_seasons").select("*").eq("series_id",seriesId).order("starts_on",{ascending:false}));
 const {data:events,error}=await readAll(db.from('events').select('*').eq('series_id',seriesId).order('local_date'));if(error)throw new Error(error.message);
 async function create(f:FormData){'use server';const db=await createClient();const {data,error}=await db.from('events').insert({series_id:seriesId,track_id:null,competition_season_id:String(f.get("season_id")||'')||null,name:String(f.get('name')),slug:uniqueRaceSlug(String(f.get('name'))),venue_description:String(f.get('venue_description')),local_date:String(f.get('date')),status:'scheduled',setup_request_id:String(f.get('request_id'))}).select('id').single();if(error)redirect(`${base}/schedule?error=${encodeURIComponent(error.message)}`);revalidatePath('/dashboard','layout');redirect(f.get('open_registration')==='on'?`${base}/events/${data!.id}/entries?message=Race created. Sign up each contestant individually.`:`${base}/schedule?message=Event added to the public calendar. Add contestants whenever you are ready.`);}
 async function start(f:FormData){'use server';const id=String(f.get('event_id'));if(!events.some(e=>e.id===id))redirect(`${base}/schedule?error=Choose a race from this series.`);const db=await createClient();const {error}=await db.rpc('set_race_event_status',{p_event_id:id,p_status:'live',p_expected_revision:Number(f.get('revision'))});if(error)redirect(`${base}/schedule?error=${encodeURIComponent(error.message)}`);revalidatePath('/dashboard','layout');redirect(`${base}/events/${id}/scoring`);}
 return <main className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
  <h1 className="text-2xl font-bold">Series calendar &amp; races</h1>
  <p>Add public calendar dates without registering any contestants. Enter each venue name and location; the series organizer manages its races.</p>
  <ActionFeedback error={p.error} message={p.message}/>
  <form action={create} className="p-4 border rounded space-y-4">
   <h2 className="text-xl font-bold">Add an event to the calendar</h2>
   <input type="hidden" name="request_id" value={crypto.randomUUID()}/>
   <label className="block">Series season (optional for calendar dates)<select name="season_id" className="block w-full min-w-0 p-3 border rounded bg-slate-900"><option value="">Calendar date only · assign a season later</option>{seasons.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
   <p className="text-sm text-slate-400">Choose a series season to use its registrations and points. You can also assign it later in Date &amp; status.</p>
   <Link href={`${base}/seasons`} className="block text-amber-400">Create or manage a series season</Link>
   <label className="block">Event name<input required name="name" className="block w-full p-3 border rounded bg-slate-900"/></label>
   <label className="block">Event date<input required type="date" name="date" className="block w-full min-w-0 p-3 border rounded bg-slate-900"/></label>
   <label className="block">Venue and location<textarea required name="venue_description" placeholder="Track name, address, and directions" className="block w-full p-3 border rounded bg-slate-900"/></label>
   <label className="flex items-center gap-2"><input type="checkbox" name="open_registration"/> Open contestant registration after saving — leave unchecked to just add event to calendar</label>
   <button className="p-3 bg-amber-500 text-slate-950 rounded">Add calendar event</button>
  </form>
  <div className="grid gap-4">{events.map(e=><article key={e.id} className="p-4 border rounded space-y-2"><h2 className="text-xl font-bold">{e.name}</h2><p>{e.local_date} · {e.venue_description} · {e.status}</p><div className="flex flex-wrap gap-4">{e.status!=='completed'&&e.status!=='cancelled'&&<form action={start}><input type="hidden" name="event_id" value={e.id}/><input type="hidden" name="revision" value={e.working_revision}/><button className="p-3 bg-amber-500 text-slate-950 rounded">{e.status==='live'?'Continue race':'Start race'}</button></form>}<Link className="p-3" href={`${base}/events/${e.id}/entries`}>Add contestants</Link><Link className="p-3" href={`${base}/events/${e.id}`}>Classes &amp; rules</Link><Link href={`${base}/events/${e.id}/settings`}>Edit date, venue, and status</Link><Link href={`/s/${seriesId}/races/${e.slug}`}>Spectator page</Link><Link href={`/s/${seriesId}/races/${e.slug}/pit-display`}>Pit Display</Link></div></article>)}</div>
 </main>;
}
