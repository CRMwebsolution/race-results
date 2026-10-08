import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_fake", {
  apiVersion: "2024-12-18.acacia" as any, // Using latest valid typed API version, or whatever is installed
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const priceId = formData.get("priceId")?.toString();
    const orgId = formData.get("orgId")?.toString();
    const tier = formData.get("tier")?.toString();

    if (!priceId || !orgId || !tier) {
      return NextResponse.redirect(new URL("/dashboard/billing?error=Missing parameters", req.url));
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Verify user owns the org
    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .eq("active", true)
      .in("role", ["owner", "admin"])
      .single();

    if (!membership) {
      return NextResponse.redirect(new URL("/dashboard/billing?error=Unauthorized", req.url));
    }

    // Create a Checkout Session
    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    
    // User stated all purchases are manual one-time (even seasonal tiers)
    const mode = "payment";
    
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: mode,
      success_url: `${origin}/dashboard/billing?success=true`,
      cancel_url: `${origin}/dashboard/billing?canceled=true`,
      customer_email: user.email,
      client_reference_id: orgId,
      metadata: {
        orgId: orgId,
        userId: user.id,
        tier: tier,
      },
    });

    if (session.url) {
      return NextResponse.redirect(session.url, 303);
    }
    
    return NextResponse.redirect(new URL("/dashboard/billing?error=Could not create session", req.url));

  } catch (err: any) {
    console.error("Checkout error:", err);
    return NextResponse.redirect(new URL(`/dashboard/billing?error=${encodeURIComponent(err.message)}`, req.url));
  }
}
