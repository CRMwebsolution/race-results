import type { SupabaseClient } from "@supabase/supabase-js";
type Notice = {session_id:string;notification:Record<string,unknown>};
export async function deliverPaymentNotifications(db: SupabaseClient) {
 const {data,error} = await db.rpc("pending_payment_notifications");
 if(error) throw new Error(error.message);
 const notices = data as Notice[];
 const endpoint = process.env.N8N_PAYMENT_WEBHOOK_URL || "https://n8n.southernautomate.com/webhook/a8aecd54-4eb6-4243-9c19-daf7c939c69c";
 for(const item of notices) {
  let failure:string|null=null;
  try {
   const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":item.session_id},
    body:JSON.stringify({...item.notification,payment_session_id:item.session_id}),signal:AbortSignal.timeout(5000)});
   if(!response.ok) failure="Notification endpoint returned "+response.status;
  } catch { failure="Notification delivery failed"; }
  const {error:saveError}=await db.rpc("record_payment_notification",{p_session_id:item.session_id,p_success:failure===null,p_error:failure});
  if(saveError) throw new Error(saveError.message);
 }
 return notices.length;
}
