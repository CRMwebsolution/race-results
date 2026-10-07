import {createClient} from '@/lib/supabase/client';
import {activateAccount,deviceId,changePrepared} from './store';
import type {ScoringPacket} from '@/app/dashboard/tracks/[trackId]/events/[eventId]/scoring/scoring-workspace';
export async function cacheOfflineShell(){if(!('serviceWorker' in navigator))throw new Error('Offline mode requires a browser with service workers and HTTPS');await navigator.serviceWorker.register('/raceholler-sw.js',{scope:'/'});await navigator.serviceWorker.ready;
 const cache=await caches.open('raceholler-shell-v1');const response=await fetch('/offline',{cache:'reload'});if(!response.ok)throw new Error('Offline workspace could not be downloaded');const html=await response.clone().text();await cache.put('/offline',response);
 const assets=[...new Set(html.match(/\/_next\/static\/[^"'<>\s\\]+/g)||[])].map(a=>a.replaceAll('&amp;','&'));
 if(!assets.length)throw new Error('Offline app assets are missing');await Promise.all(assets.map(async asset=>{const r=await fetch(asset,{cache:'reload'});if(!r.ok)throw new Error('An offline asset failed to download');await cache.put(asset,r);}));await navigator.storage?.persist?.();
}
const preparing=new Map<string,Promise<unknown>>();
/** Refresh the race without discarding queued scores or leaving a closed session frozen. */
export async function prepareEvent(accountId:string,eventId:string){
 const key=`${accountId}:${eventId}`;
 if(preparing.has(key))return preparing.get(key);
 const pending=(async()=>{
  if(!navigator.onLine)throw new Error('Reconnect once to get this race ready for offline saving.');
  await cacheOfflineShell();
  const db=createClient();const {data:{user},error:authError}=await db.auth.getUser();
  if(authError||user?.id!==accountId)throw new Error('Sign in again to save scores on this device.');
  const {data,error}=await db.rpc('prepare_offline_event',{p_event_id:eventId,p_device_id:deviceId()});
  if(error)throw new Error(error.message);
  const packet=data as unknown as ScoringPacket&{sessionId:string};activateAccount(accountId);
  try{return await changePrepared(accountId,eventId,previous=>({
   key,schemaVersion:1,accountId,sessionId:packet.sessionId,
   packet:previous&&previous.packet.event.working_revision>packet.event.working_revision?previous.packet:packet,
   outbox:previous?.outbox||[],closed:false,closing:false,preparedAt:new Date().toISOString(),
  }));}catch(e){await db.rpc('close_offline_session',{p_session_id:packet.sessionId});throw e;}
 })();
 preparing.set(key,pending);
 try{return await pending;}finally{preparing.delete(key);}
}
export async function finishPrepared(accountId:string,eventId:string){
 const record=await changePrepared(accountId,eventId,r=>{if(!r||r.outbox.length)throw new Error('Some scores are still waiting to save. Reconnect and try again.');return {...r,closing:true};});
 try{
  const {error}=await createClient().rpc('close_offline_session',{p_session_id:record.sessionId});if(error)throw new Error(error.message);
  await changePrepared(accountId,eventId,r=>{if(!r||r.outbox.length)throw new Error('A new score is still waiting to save. Try again.');return {...r,closed:true,closing:false};});
 }catch(e){await changePrepared(accountId,eventId,r=>({...r!,closing:false}));throw e;}
}
