import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_fake", {
  apiVersion: "2024-12-18.acacia" as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err: any) {
        console.error(`⚠️  Webhook signature verification failed:`, err.message);
        return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
      }
    } else {
      // For local testing without secrets
      event = JSON.parse(body);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      const orgId = session.metadata?.orgId;
      const tier = session.metadata?.tier;
      const userId = session.metadata?.userId;
      
      if (!orgId || !tier) {
        console.error("Missing metadata in session");
        return new NextResponse("Missing metadata", { status: 400 });
      }

      // Initialize a service role client to bypass RLS for admin operations
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
      
      if (supabaseUrl && supabaseServiceKey) {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false }
        });

        // Current organization state
        const { data: org } = await supabaseAdmin.from("organizations").select("event_quota").eq("id", orgId).single();

        let newQuota = org?.event_quota || 0;
        let endDate = null;

        if (tier === "event_pass") {
          newQuota += 1; // Buy 1 pass, add 1 to quota
        } else {
          // Standard or Premium subscriptions get 1 year from now
          // Wait, if it's a Stripe Subscription, we should sync it with Stripe's actual end date, 
          // but for this phase we'll just set it to 1 year ahead.
          const d = new Date();
          d.setFullYear(d.getFullYear() + 1);
          endDate = d.toISOString();
        }

        // Call the admin RPC we created in migrations
        const { error } = await supabaseAdmin.rpc("grant_organization_entitlement", {
          p_org_id: orgId,
          p_tier: tier,
          p_quota: newQuota,
          p_end_date: endDate
        });

        if (error) {
          console.error("Failed to grant entitlement:", error);
          return new NextResponse("Database error", { status: 500 });
        }

        // Send info to n8n Webhook
        try {
          await fetch("https://n8n.southernautomate.com/webhook/a8aecd54-4eb6-4243-9c19-daf7c939c69c", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "checkout.session.completed",
              customer_email: session.customer_details?.email || session.customer_email,
              customer_name: session.customer_details?.name || "Unknown",
              tier_picked: tier,
              org_id: orgId,
              user_id: userId,
              amount_total: session.amount_total,
              currency: session.currency,
              timestamp: new Date().toISOString()
            })
          });
        } catch (n8nError) {
          console.error("Failed to send webhook to n8n:", n8nError);
          // Don't fail the stripe webhook if n8n fails
        }
      } else {
        console.warn("Supabase Service Role Key missing, cannot update DB.");
      }
    }

    return new NextResponse(JSON.stringify({ received: true }), { status: 200 });

  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return new NextResponse(`Server Error: ${error.message}`, { status: 500 });
  }
}
