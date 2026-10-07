import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {readAll} from '@/lib/read-all';
export async function AssignedRaces(){
 const db=await createClient(),{data:{user}}=await db.auth.getUser();if(!user)return null;
 const {data,error}=await readAll(db.from('race_staff').select('role,events(id,name,local_date,status,track_id,series_id)').eq('user_id',user.id).eq('active',true));
 if(error)throw new Error(error.message);if(!data.length)return null;
 return <section className="p-4 sm:p-6 rounded-xl border bg-slate-900 space-y-4"><h2 className="text-xl font-bold">Races you help with</h2><div className="grid gap-3 sm:grid-cols-2">{data.map(row=>{const e=row.events;if(!e)return null;const path=`/dashboard/${e.series_id?'series/'+e.series_id:'tracks/'+e.track_id}/events/${e.id}/${row.role==='judge'?'judging':'scoring'}`;return <Link key={e.id} href={path} className="p-4 border rounded-lg space-y-2"><h3 className="font-bold">{e.name}</h3><p>{e.local_date} · {e.status}</p><p className="text-amber-400">{row.role==='judge'?'Enter judge scores':'Enter results / register contestants'} →</p></Link>;})}</div></section>;
}
