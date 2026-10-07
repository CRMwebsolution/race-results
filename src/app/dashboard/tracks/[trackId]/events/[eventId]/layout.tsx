import {spectatorRacePath} from '@/lib/spectator-path';
import {RaceNav} from '@/components/race-nav';
import {createClient} from '@/lib/supabase/server';
import {raceContext,RaceParams} from '@/lib/race-context';
import {redirect,notFound} from 'next/navigation';
import Link from 'next/link';
export default async function EventLayout({children,params}:{children:React.ReactNode;params:Promise<RaceParams>}){
 const {ownerId,ownerType,ownerColumn,ownerPath,eventId}=raceContext(await params);const db=await createClient();
 const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const {data:event}=await db.from('events').select('*').eq('id',eventId).eq(ownerColumn,ownerId).single();if(!event)notFound();
 const {data:allowed}=await db.rpc('can_edit_race',{p_event_id:eventId});if(!allowed)redirect('/dashboard');
 const {data:owner}=ownerType==='series'?await db.from('series').select('name').eq('id',ownerId).single():await db.from('tracks').select('name,slug').eq('id',ownerId).single();
 const publicPath=spectatorRacePath({ownerType,ownerId,eventSlug:event.slug,trackSlug:(owner as {slug?:string})?.slug});if(!publicPath)notFound();
 return <main className="flex-1 min-w-0 bg-slate-950"><header className="p-4 border-b space-y-3"><Link href={ownerPath} className="text-amber-400">{owner?.name}</Link><h1 className="text-2xl font-bold">{event.name}</h1><p>{event.local_date} · {event.status}{ownerType==='series'&&event.venue_description?` · ${event.venue_description}`:''}</p><RaceNav base={`${ownerPath}/events/${eventId}`} publicPath={publicPath} eventName={event.name}/></header>{children}</main>;
}
