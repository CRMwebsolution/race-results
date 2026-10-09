import {ThemeToggle} from '@/components/theme-toggle';
import {createClient} from '@/lib/supabase/server';
import {readAll} from '@/lib/read-all';
import {chronologicalRaces} from '@/lib/race-order';
import {PublicCompetition} from '@/components/public-competition';
import {notFound} from 'next/navigation';
import Link from 'next/link';
export default async function PublicSeries({params}:{params:Promise<{seriesId:string}>}){
 const {seriesId}=await params;const db=await createClient();const {data:series}=await db.from('series').select('*').eq('id',seriesId).single();if(!series)notFound();
 const {data:events,error}=await readAll(db.from('events').select('*').eq('series_id',seriesId).in('status',['live','completed']).order('local_date'));if(error)throw new Error(error.message);
 const {data:classes}=await readAll(db.from('series_classes').select('*').eq('series_id',seriesId).order('order_num'));
 return <main className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8"><Link href="/?type=series" className="text-amber-400">All traveling series</Link><header className="space-y-3"><p className="uppercase text-amber-400">Traveling series</p><h1 className="text-3xl font-bold">{series.name}</h1><p>{series.description}</p><ThemeToggle/></header><section className="space-y-4"><h2 className="text-2xl font-bold">Series races and overall results</h2>{chronologicalRaces(events).map(e=><Link key={e.id} href={`/s/${seriesId}/races/${e.slug}`} className="block p-4 border rounded"><h3 className="text-xl font-bold">{e.name}</h3><p>{e.local_date} · {e.status}</p><p>{e.venue_description}</p></Link>)}</section><PublicCompetition seriesId={seriesId}/><section className="space-y-3"><h2 className="text-2xl font-bold">Classes and rules</h2>{classes.map(c=><article key={c.id} className="p-4 border rounded"><h3 className="font-bold">{c.name}</h3><p>{c.rules_text}</p><p>{c.entry_fee_text}</p></article>)}</section></main>;
}

