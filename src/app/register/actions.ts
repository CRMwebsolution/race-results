"use server";

import {authReturnPath} from "@/lib/auth-return";
import {headers} from "next/headers";
import {validMode} from "@/lib/account-mode";
import {createClient} from "@/lib/supabase/server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";

export async function signup(formData: FormData) {
  const next=authReturnPath(formData.get("next"));
  const returnQuery=`next=${encodeURIComponent(next)}`;
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const full_name = String(formData.get("full_name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const mode = formData.get("operating_mode");
  if (!email || !password || !full_name || !phone) redirect(`/register?${returnQuery}&error=All fields are required`);
  if (!validMode(mode)) redirect(`/register?${returnQuery}&error=Choose how you run races before registering`);

  const supabase = await createClient();
  const {data, error} = await supabase.auth.signUp({
    email, password, options: {data: {operating_mode: mode, full_name, phone}},
  });
  if (error) redirect(`/register?${returnQuery}&error=${encodeURIComponent(error.message)}`);
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(next);
  }
  redirect(`/register/verify?email=${encodeURIComponent(email)}&${returnQuery}`);
}
