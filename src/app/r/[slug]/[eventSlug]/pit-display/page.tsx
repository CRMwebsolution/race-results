import {createClient} from "@/lib/supabase/server";
import {notFound} from "next/navigation";
import {PitDisplay} from "@/components/pit-display";
import {pitRace} from "@/lib/pit-race";
export default async function PitDisplayPage({params}:{params:Promise<{slug:string;eventSlug:string}>}) {
 const {slug,eventSlug}=await params;
 const db=await createClient();
 const {data:track,error:trackError}=await db.from("tracks").select("id").eq("slug",slug).maybeSingle();
 if(trackError) throw new Error("Could not load track");if(!track) notFound();
 const {data:event,error}=await db.from("events").select("*").eq("track_id",track.id).eq("slug",eventSlug).maybeSingle();
 if(error) throw new Error("Could not load race");if(!event) notFound();
 return <PitDisplay {...await pitRace(db,event)}/>;
}
