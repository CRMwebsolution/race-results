"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function adminDeleteEventAction(eventId: string, confirmName: string) {
  const supabase = await createClient();
  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_platform_admin");
  if (adminErr || !isAdmin) throw new Error("Only platform administrators can delete events");

  const { error } = await supabase.rpc("admin_delete_event", {
    p_event_id: eventId,
    p_confirm_name: confirmName,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function adminDeleteTrackAction(trackId: string, confirmName: string) {
  const supabase = await createClient();
  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_platform_admin");
  if (adminErr || !isAdmin) throw new Error("Only platform administrators can delete tracks");

  const { error } = await supabase.rpc("admin_delete_track", {
    p_track_id: trackId,
    p_confirm_name: confirmName,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function adminDeleteSeriesAction(seriesId: string, confirmName: string) {
  const supabase = await createClient();
  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_platform_admin");
  if (adminErr || !isAdmin) throw new Error("Only platform administrators can delete series");

  const { error } = await supabase.rpc("admin_delete_series", {
    p_series_id: seriesId,
    p_confirm_name: confirmName,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function adminDeleteOrganizationAction(orgId: string, confirmName: string) {
  const supabase = await createClient();
  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_platform_admin");
  if (adminErr || !isAdmin) throw new Error("Only platform administrators can delete organizations");

  const { error } = await supabase.rpc("admin_delete_organization", {
    p_org_id: orgId,
    p_confirm_name: confirmName,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function adminDeleteAccountAction(userId: string, confirmName: string) {
  const supabase = await createClient();
  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_platform_admin");
  if (adminErr || !isAdmin) throw new Error("Only platform administrators can delete accounts");

  // 1. Delete associated data and profile via Postgres RPC with full cascade
  const { error: rpcError } = await supabase.rpc("admin_delete_account", {
    p_user_id: userId,
    p_confirm_name: confirmName,
    p_cascade_organizations: true,
  });
  if (rpcError) throw new Error(rpcError.message);

  // 2. Remove user from Supabase Auth
  try {
    const adminClient = createAdminClient();
    await adminClient.auth.admin.deleteUser(userId);
  } catch (err: any) {
    console.warn("Auth user delete note:", err?.message);
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
  return { success: true };
}
