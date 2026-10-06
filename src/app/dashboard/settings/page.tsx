import {createClient} from '@/lib/supabase/server';
import {accountModes,validMode} from '@/lib/account-mode';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
export default async function AccountSettings({searchParams}:{searchParams:Promise<{error?:string;message?:string}>}) {
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');const p=await searchParams;
 async function save(f:FormData){'use server';const mode=f.get('mode');if(!validMode(mode))redirect('?error=Choose an account mode');const db=await createClient();const {error}=await db.auth.updateUser({data:{operating_mode:mode}});if(error)redirect(`?error=${encodeURIComponent(error.message)}`);revalidatePath('/dashboard','layout');redirect('/dashboard/settings?message=Preferences saved');}
 return <main className="p-4 sm:p-8 max-w-2xl mx-auto w-full space-y-6"><h1 className="text-2xl font-bold">Account settings</h1>{p.error&&<p role="alert" className="text-red-300">{p.error}</p>}{p.message&&<p role="status" className="text-emerald-300">{p.message}</p>}<form action={save} className="space-y-4"><h2 className="text-xl font-bold">How you run races</h2><p>Your choice tailors the dashboard. You can change it anytime; existing data and permissions are preserved.</p><label className="block">Account mode<select name="mode" defaultValue={user.user_metadata.operating_mode||'multi_track_series'} className="block w-full p-3 bg-slate-900 border rounded">{accountModes.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><button className="p-3 bg-amber-500 rounded text-slate-950">Save preferences</button></form></main>;
}
