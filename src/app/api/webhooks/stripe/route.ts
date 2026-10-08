import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { paidTier, plans } from "@/lib/billing/catalog";
import { deliverPaymentNotifications } from "@/lib/billing/notifications";

export async function POST(req: Request) {
 const key=process.env.STRIPE_SECRET_KEY, secret=process.env.STRIPE_WEBHOOK_SECRET;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key || !secret || !url || !serviceKey) return new NextResponse("Payment processing is not configured",{status:503});
 const signature=req.headers.get("stripe-signature");
 if(!signature) return new NextResponse("Stripe signature required",{status:400});
 const stripe=new Stripe(key);
 let event:Stripe.Event;
 try {event=stripe.webhooks.constructEvent(await req.text(),signature,secret);}
 catch {return new NextResponse("Invalid Stripe signature",{status:400});}
 if(event.type!=="checkout.session.completed" && event.type!=="checkout.session.async_payment_succeeded")
  return NextResponse.json({received:true});
 try {
  const signed=event.data.object as Stripe.Checkout.Session;
  const session=await stripe.checkout.sessions.retrieve(signed.id,{expand:["line_items"]});
  if(session.mode!=="payment" || session.payment_status!=="paid") return NextResponse.json({received:true,pending:true});
  const tier=session.metadata?.tier, orgId=session.metadata?.orgId, items=session.line_items?.data;
  if(!orgId || !paidTier(tier) || session.client_reference_id!==orgId || items?.length!==1 ||
    items[0].quantity!==1 || items[0].price?.id!==plans[tier].price ||
    session.amount_total!==plans[tier].amount || session.currency!=="usd")
   return new NextResponse("Payment does not match a configured plan",{status:400});
  const db=createClient(url,serviceKey,{auth:{persistSession:false}});
  const notification={event:event.type,customer_email:session.customer_details?.email || session.customer_email,
   customer_name:session.customer_details?.name,tier_picked:tier,org_id:orgId,user_id:session.metadata?.userId,
   amount_total:session.amount_total,currency:session.currency,timestamp:new Date().toISOString()};
  const {error}=await db.rpc("apply_paid_entitlement",{p_session_id:session.id,p_stripe_event_id:event.id,
   p_org_id:orgId,p_tier:tier,p_amount:session.amount_total,p_currency:session.currency,p_notification:notification});
  if(error) {console.error("Payment activation failed",error);return new NextResponse("Payment activation failed",{status:500});}
  try {await deliverPaymentNotifications(db);} catch(error) {console.error("Payment notification queued for retry",error);}
  return NextResponse.json({received:true});
 } catch(error) {console.error("Verified payment processing failed",error);return new NextResponse("Payment processing failed",{status:500});}
}
