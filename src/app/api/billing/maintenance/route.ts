import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export async function GET(req:Request) {
 const secret=process.env.CRON_SECRET;
 if(!secret || req.headers.get("authorization")!=="Bearer "+secret) return new NextResponse("Unauthorized",{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url || !key) return new NextResponse("Maintenance is not configured",{status:503});
 const {error}=await createClient(url,key,{auth:{persistSession:false}}).rpc("sweep_expired_events");
 if(error){console.error("Archive sweep failed",error);return new NextResponse("Archive sweep failed",{status:500});}
 return NextResponse.json({ok:true});
}
