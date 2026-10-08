import {createClient} from '@/lib/supabase/server';
import {readAll} from '@/lib/read-all';
import {raceContext,RaceParams} from '@/lib/race-context';
import {ActionFeedback} from '@/components/action-feedback';
import {InvitationLink} from '@/components/invitation-link';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import Link from 'next/link';
const input='block w-full p-3 bg-slate-950 text-white border rounded';
export default async function RaceStaff({params,searchParams}:{params:Promise<RaceParams>;searchParams:Promise<{error?:string;message?:string}>}) {
 const {eventId,ownerPath}=raceContext(await params),path=`${ownerPath}/events/${eventId}/staff`;
 const db=await createClient(),feedback=await searchParams;
 const {data:canManage}=await db.rpc('can_manage_race',{p_event_id:eventId});
 if(!canManage)redirect(`${ownerPath}/events/${eventId}/scoring`);
 const [{data:invites,error:ie},{data:staff,error:se},{data:classes,error:ce}]=await Promise.all([
  readAll(db.from('race_staff_invitations').select('*').eq('event_id',eventId).order('created_at',{ascending:false})),
  readAll(db.from('race_staff').select('*').eq('event_id',eventId).eq('active',true),['event_id','user_id']),
  readAll(db.from('event_classes').select('id,name').eq('event_id',eventId).eq('scoring_type','judged_points').order('order_num'))
 ]);
 if(ie||se||ce)throw new Error((ie||se||ce)!.message);
 async function invite(f:FormData){'use server';const db=await createClient();const {error}=await db.rpc('create_race_staff_invitation',{p_event_id:eventId,p_email:String(f.get('email')||''),p_role:String(f.get('role')),p_class_id:String(f.get('class_id')||'')||undefined,p_judge_label:String(f.get('label')||'')});if(error)redirect(`${path}?error=${encodeURIComponent(error.message)}`);revalidatePath(path);redirect(`${path}?message=Invitation created. Copy the link or open an email draft to share it.`);}
 async function cancel(f:FormData){'use server';const db=await createClient();const id=String(f.get('id'));if(!invites.some(i=>i.id===id))redirect(`${path}?error=Choose an invitation for this race.`);const {error}=await db.rpc('cancel_race_staff_invitation',{p_invitation_id:id});if(error)redirect(`${path}?error=${encodeURIComponent(error.message)}`);revalidatePath(path);redirect(`${path}?message=Invitation cancelled.`);}
 async function remove(f:FormData){'use server';const db=await createClient();const {error}=await db.rpc('remove_race_staff',{p_event_id:eventId,p_user_id:String(f.get('user_id'))});if(error)redirect(`${path}?error=${encodeURIComponent(error.message)}`);revalidatePath('/dashboard','layout');redirect(`${path}?message=Race access removed.`);}
 return <div className="p-4 sm:p-8 max-w-3xl space-y-6"><Link href={`${ownerPath}/events/${eventId}/settings`} className="text-amber-400">← Back to Date &amp; status</Link><h1 className="text-2xl font-bold">Staff &amp; judge invitations</h1><ActionFeedback {...feedback}/><p>Invite someone to this race. Scorers can register contestants and enter results. Judges enter scores for their assigned class. Only the organizer can manage race settings or complete the race.</p>
  <form action={invite} className="border rounded-xl p-4 space-y-4"><h2 className="text-xl font-bold">Create invitation</h2><label className="block">Email<input type="email" name="email" required className={input}/></label><label className="block">Role<select name="role" className={input}><option value="official">Scorer / registration helper</option>{classes.length>0&&<option value="judge">Judge</option>}</select></label>{classes.length>0&&<details><summary className="cursor-pointer">Judge class and label (required for judges)</summary><div className="space-y-3 pt-3"><label className="block">Class<select name="class_id" className={input}><option value="">Choose judged class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="block">Public judge label<input name="label" placeholder="e.g., Judge 1" className={input}/></label></div></details>}<p className="text-sm text-slate-400">They must accept with this email address. Links expire after seven days. Creating the link does not send an email; copy it to share, or open an email draft and send it from your mail app.</p><button className="p-3 bg-amber-500 text-slate-950 rounded font-bold">Create invitation link</button></form>
  {classes.length>0&&<Link href={`${ownerPath}/events/${eventId}/judging`} className="block text-amber-400">Manage judge assignments and scores →</Link>}
  {/* Request-time expiry on a dynamic server page. */}
  {/* eslint-disable-next-line react-hooks/purity */}
  <section className="space-y-3"><h2 className="text-xl font-bold">Invitations</h2>{!invites.length&&<p>No invitations yet.</p>}{invites.map(i=>{const state=i.accepted_at?'Accepted':i.revoked_at?'Cancelled':new Date(i.expires_at).getTime()<=Date.now()?'Expired':'Pending';return <article key={i.id} className="border rounded-xl p-4 space-y-3"><p className="font-bold break-words">{i.email} · {i.role==='judge'?'Judge':'Scorer'}</p><p>{state}{i.class_id?` · ${classes.find(c=>c.id===i.class_id)?.name||'Class'} · ${i.judge_label}`:''}</p>{state==='Pending'&&<><InvitationLink token={i.token} email={i.email}/><form action={cancel}><input type="hidden" name="id" value={i.id}/><button className="p-3 text-red-400 border rounded">Cancel invitation</button></form></>}</article>;})}</section>
  <section className="space-y-3"><h2 className="text-xl font-bold">Current race staff</h2>{!staff.length&&<p>No invited staff have accepted yet.</p>}{staff.map(s=><article key={s.user_id} className="border rounded p-4 space-y-3"><p className="break-words">{invites.find(i=>i.accepted_by===s.user_id)?.email||'Race staff'} · {s.role==='judge'?'Judge':'Scorer'}</p><form action={remove}><input type="hidden" name="user_id" value={s.user_id}/><button className="p-3 text-red-400 border rounded">Remove race access</button></form></article>)}</section>
 </div>;
}
