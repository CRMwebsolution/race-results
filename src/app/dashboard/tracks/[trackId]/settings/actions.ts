"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {scoreClass} from '@/scoring';

export async function updateTrackSettings(trackId: string, defaultClasses: any[]) {
  if(!Array.isArray(defaultClasses))return {success:false,error:'Please add at least one valid class.'};
  for(const cls of defaultClasses){
    if(typeof cls.name!=='string'||!cls.name.trim())return {success:false,error:'Each class needs a name.'};
    const check=scoreClass(cls.type,[],cls.scoring_config||{});
    if(check.details.error)return {success:false,error:String(check.details.error)};
  }
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("tracks")
    .update({ default_classes: defaultClasses })
    .eq("id", trackId).select("id").single();

  if (error) {
    console.error("Failed to update track settings", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/dashboard/tracks/${trackId}`);
  revalidatePath(`/dashboard/tracks/${trackId}/settings`);
  
  return { success: true };
}
