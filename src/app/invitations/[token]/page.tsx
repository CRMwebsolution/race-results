import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {ActionFeedback} from '@/components/action-feedback';
import {redirect,notFound} from 'next/navigation';
import {revalidatePath} from 'next/cache';
export default async function Invitation({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<{error?:string}>}) {
 const {token}=await params;if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token))notFound();
 const path=`/invitations/${token}`,query=await searchParams,db=await createClient(),{data:{user}}=await db.auth.getUser();
 async function accept(){'use server';const db=await createClient();const {data,error}=await db.rpc('accept_race_staff_invitation',{p_token:token});if(error)redirect(`${path}?error=${encodeURIComponent(error.message)}`);const target=(data as {path?:string})?.path;if(!target?.startsWith('/dashboard/'))throw new Error('Invitation destination unavailable');revalidatePath('/dashboard','layout');redirect(target);}
 return <main className="max-w-xl mx-auto w-full p-4 sm:p-8 space-y-6"><Link href="/" className="text-amber-400">← Back</Link><h1 className="text-2xl font-bold">Race staff invitation</h1><p>Accept to help with the race. Use the same email address the organizer invited.</p><ActionFeedback error={query.error}/>{user?<><p className="break-words">Signed in as {user.email}</p><form action={accept}><button className="p-3 rounded bg-amber-500 text-slate-950 font-bold">Accept invitation</button></form><form action="/auth/signout" method="post"><button className="p-3 border rounded">Sign out to use a different account</button></form></>:<div className="flex flex-wrap gap-3"><Link href={`/login?next=${encodeURIComponent(path)}`} className="p-3 bg-amber-500 text-slate-950 rounded">Sign in</Link><Link href={`/register?next=${encodeURIComponent(path)}`} className="p-3 border rounded">Create account</Link></div>}</main>;
}
