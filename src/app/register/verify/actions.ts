"use server";

import {authReturnPath} from "@/lib/auth-return";
import {createClient} from "@/lib/supabase/server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";

export async function verifyOtp(formData: FormData) {
  const next = authReturnPath(formData.get("next"));
  const email = String(formData.get("email") || "").trim();
  const token = String(formData.get("token") || "").trim();
  const returnQuery = `email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`;
  
  if (!token || token.length !== 6) {
    redirect(`/register/verify?${returnQuery}&error=Please enter a valid 6-digit code`);
  }

  const supabase = await createClient();
  const {error} = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'signup'
  });

  if (error) {
    redirect(`/register/verify?${returnQuery}&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect(next);
}
