'use server';
import {createClient} from '@/lib/supabase/server';
import {redirect} from 'next/navigation';
export async function changePassword(f:FormData){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login?error=Sign in before changing your password');
 const password=String(f.get('new_password')||''),confirmation=String(f.get('confirm_password')||''),current=String(f.get('current_password')||'');
 if(password.length<12||password!==confirmation)redirect('/dashboard/settings?error=Use at least 12 characters and matching new passwords');
 if(!current)redirect('/dashboard/settings?error=Enter your current password');
 // Verify credentials without replacing this browser's cookies/session.
 const {createClient:makeClient}=await import('@supabase/supabase-js');
 const verify=makeClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error:credentialError}=await verify.auth.signInWithPassword({email:user.email!,password:current});
 if(credentialError||data.user?.id!==user.id)redirect('/dashboard/settings?error=Current password is incorrect');
 if(data.session)await verify.auth.signOut({scope:'local'});
 const nonce=String(f.get('nonce')||'').trim();
 const {error}=await db.auth.updateUser({password,...(nonce?{nonce}:{}),current_password:current} as Parameters<typeof db.auth.updateUser>[0]);
 if(error)redirect(`/dashboard/settings?error=${encodeURIComponent(error.message)}`);
 redirect('/dashboard/settings?message=Password changed successfully');
}
export async function requestPasswordNonce(){const db=await createClient();const {error}=await db.auth.reauthenticate();if(error)redirect(`/dashboard/settings?error=${encodeURIComponent(error.message)}`);redirect('/dashboard/settings?message=Check your email for the verification code');}
