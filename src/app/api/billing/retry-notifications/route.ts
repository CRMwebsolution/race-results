import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { deliverPaymentNotifications } from "@/lib/billing/notifications";
export async function GET(req: Request) {
 const secret=process.env.CRON_SECRET;
 if(!secret || req.headers.get("authorization")!=="Bearer "+secret) return new NextResponse("Unauthorized",{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url || !key) return new NextResponse("Payment processing is not configured",{status:503});
 try {return NextResponse.json({attempted:await deliverPaymentNotifications(createClient(url,key,{auth:{persistSession:false}}))});}
 catch {return new NextResponse("Notification retry failed",{status:500});}
}
