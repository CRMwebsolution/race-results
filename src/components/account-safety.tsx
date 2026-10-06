'use client';
import {useEffect} from 'react';
import {activateAccount} from '@/lib/offline/store';
import {createClient} from '@/lib/supabase/client';
export function AccountSafety(){useEffect(()=>{const {data:{subscription}}=createClient().auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT')activateAccount(null);if((event==='SIGNED_IN'||event==='INITIAL_SESSION')&&session?.user)activateAccount(session.user.id);});const beforeLogout=(event:Event)=>{const form=event.target as HTMLFormElement;if(form?.action?.endsWith('/auth/signout'))activateAccount(null);};document.addEventListener('submit',beforeLogout,true);return()=>{subscription.unsubscribe();document.removeEventListener('submit',beforeLogout,true);};},[]);return null;}
