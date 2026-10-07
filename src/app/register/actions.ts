"use server";

import {validMode} from "@/lib/account-mode";
import {createClient} from "@/lib/supabase/server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";

export async function signup(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const mode = formData.get("operating_mode");
  if (!email || !password) redirect("/register?error=Email and password are required");
  if (!validMode(mode)) redirect("/register?error=Choose how you run races before registering");

  const supabase = await createClient();
  const {data, error} = await supabase.auth.signUp({
    email, password, options: {data: {operating_mode: mode}},
  });
  if (error) redirect(`/register?error=${encodeURIComponent(error.message)}`);
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }
  redirect("/login?message=Registration successful. Please check your email to confirm your account.");
}
