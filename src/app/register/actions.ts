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
  const mode = formData.get("operating_mode");
  if (!email || !password) redirect(`/register?${returnQuery}&error=Email and password are required`);
  if (!validMode(mode)) redirect(`/register?${returnQuery}&error=Choose how you run races before registering`);

  const supabase = await createClient();
  const requestHeaders=await headers();
  const origin=requestHeaders.get("origin")||process.env.NEXT_PUBLIC_SITE_URL;
  const callback=origin?new URL(`/auth/callback?next=${encodeURIComponent(next)}`,origin).toString():undefined;
  const {data, error} = await supabase.auth.signUp({
    email, password, options: {emailRedirectTo:callback,data: {operating_mode: mode}},
  });
  if (error) redirect(`/register?${returnQuery}&error=${encodeURIComponent(error.message)}`);
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(next);
  }
  redirect(`/login?${returnQuery}&message=Registration successful. Please check your email to confirm your account.`);
}
