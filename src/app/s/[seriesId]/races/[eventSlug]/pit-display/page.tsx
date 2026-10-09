import {createClient} from "@/lib/supabase/server";
import {notFound} from "next/navigation";
import {PitDisplay} from "@/components/pit-display";
import {pitRace} from "@/lib/pit-race";
export default async function PitDisplayPage({params}:{params:Promise<{seriesId:string;eventSlug:string}>}) {
 const {seriesId,eventSlug}=await params;
 const db=await createClient();
 
 const {data:event,error}=await db.from("events").select("*").eq("series_id",seriesId).eq("slug",eventSlug).maybeSingle();
 if(error) throw new Error("Could not load race");if(!event) notFound();
 if(event.status==='scheduled' || event.status==='draft') return <div className='p-8 text-center text-slate-400'>Race details will be available once the event goes live.</div>;
 return <PitDisplay {...await pitRace(db,event)} backUrl={`/s/${seriesId}/races/${eventSlug}`} />;
}

