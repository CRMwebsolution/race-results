import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { paidTier, plans } from "@/lib/billing/catalog";

function back(req: Request, message: string) {
 const url = new URL("/dashboard/billing",req.url);url.searchParams.set("error",message);
 return NextResponse.redirect(url,303);
}
export async function POST(req: Request) {
 try {
  const form = await req.formData();
  const orgId = String(form.get("orgId") || ""), tier = String(form.get("tier") || "");
  if (!orgId || !paidTier(tier)) return back(req,"Choose an account and a valid plan.");
  const supabase = await createClient();
  const {data:{user}} = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login",req.url),303);
  const {data:membership,error} = await supabase.from("organization_memberships").select("role")
   .eq("organization_id",orgId).eq("user_id",user.id).eq("active",true).in("role",["owner","admin"]).maybeSingle();
  if (error || !membership) return back(req,"You must own or manage this account.");
  const key = process.env.STRIPE_SECRET_KEY;
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!key || !origin) return back(req,"Payments are not configured yet. Contact support.");
  const base = new URL(origin);
  if (base.protocol !== "https:" && process.env.NODE_ENV === "production") return back(req,"Payment return address is not configured correctly.");
  const stripe = new Stripe(key);
  const plan = plans[tier], price = await stripe.prices.retrieve(plan.price);
  if (!price.active || price.type !== "one_time" || price.currency !== "usd" || price.unit_amount !== plan.amount)
   return back(req,"This plan's payment price is not configured correctly. Contact support.");
  const session = await stripe.checkout.sessions.create({
   mode:"payment",line_items:[{price:plan.price,quantity:1}],
   success_url:new URL("/dashboard/billing?success=true",base).href,
   cancel_url:new URL("/dashboard/billing?canceled=true",base).href,
   customer_email:user.email,client_reference_id:orgId,
   metadata:{orgId,userId:user.id,tier,priceId:plan.price},
  });
  if (!session.url) return back(req,"Checkout could not open. Please try again.");
  return NextResponse.redirect(session.url,303);
 } catch (error) {
  console.error("Checkout failed",error);
  return back(req,"Checkout could not open. Please try again or contact support.");
 }
}
