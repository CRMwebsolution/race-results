'use client';
import {useEffect} from 'react';
import {activateAccount} from '@/lib/offline/store';
import {createClient} from '@/lib/supabase/client';
function safeActivate(id:string|null){try{activateAccount(id);}catch{/* Offline storage is optional for online authentication. */}}
export function AccountSafety(){useEffect(()=>{const {data:{subscription}}=createClient().auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT')safeActivate(null);if((event==='SIGNED_IN'||event==='INITIAL_SESSION')&&session?.user)safeActivate(session.user.id);});const beforeLogout=(event:Event)=>{const form=event.target as HTMLFormElement;if(form?.action?.endsWith('/auth/signout'))safeActivate(null);};document.addEventListener('submit',beforeLogout,true);return()=>{subscription.unsubscribe();document.removeEventListener('submit',beforeLogout,true);};},[]);return null;}
