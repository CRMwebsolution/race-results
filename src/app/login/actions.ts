"use server";
import {validMode} from "@/lib/account-mode";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    redirect("/login?error=Email and password are required");
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    redirect("/login?error=Email and password are required");
  }

  const supabase = await createClient();

  const mode=formData.get("operating_mode");
  if(!validMode(mode)) redirect("/login?error=Choose how you run races before registering");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options:{data:{operating_mode:mode}},
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // If session created immediately (e.g. email confirm off for dev)
  if (data?.session) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  redirect("/login?message=Registration successful. Please check your email to confirm your account.");
}
