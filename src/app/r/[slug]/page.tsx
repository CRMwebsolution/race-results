import {readAll} from '@/lib/read-all';
import {chronologicalRaces} from '@/lib/race-order';
import {createClient} from '@/lib/supabase/server';
import {notFound} from 'next/navigation';
import Link from 'next/link';
export default async function Track({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const db=await createClient();const {data:track}=await db.from('tracks').select('id').eq('slug',slug).single();if(!track)notFound();const {data:events}=await readAll(db.from('events').select('id,name,slug,local_date,status,published_revision').eq('track_id',track.id).in('status',['live','completed']).order('local_date'));return <section className="space-y-4"><h1 className="text-2xl font-bold">Races & results</h1>{chronologicalRaces(events).filter(e=>e.status==='live'||(e.published_revision||0)>0).map(e=><Link key={e.id} href={`/r/${slug}/${e.slug}`} className="block p-5 border rounded-xl bg-slate-900"><p className="text-amber-400 uppercase text-xs">{e.status}</p><h2 className="font-bold text-xl">{e.name}</h2><p>{e.local_date}</p></Link>)}</section>;}

