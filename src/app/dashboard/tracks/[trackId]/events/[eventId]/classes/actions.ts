'use server';
import {createClient} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
export async function reorderClasses(eventId:string,ids:string[]) {
 const db=await createClient();const {error}=await db.rpc('reorder_event_classes',{p_event_id:eventId,p_ids:ids});
 if(error)return {error:error.message};revalidatePath('/dashboard/tracks','layout');return {success:true};
}
export async function removeClass(eventId:string,classId:string) {
 const db=await createClient();const {error}=await db.rpc('remove_event_class',{p_event_id:eventId,p_class_id:classId,p_confirm:true});
 if(error)return {error:error.message};revalidatePath('/dashboard/tracks','layout');return {success:true};
}
