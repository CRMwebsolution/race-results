"use server";

import {createClient} from "@/lib/supabase/server";
import {revalidatePath} from "next/cache";

export async function toggleTips(showTips: boolean) {
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('profiles').update({show_tips: showTips}).eq('id', user.id);
  revalidatePath('/', 'layout');
}
