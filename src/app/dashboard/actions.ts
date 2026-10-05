"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = {
  success?: boolean;
  error?: string | null;
  data?: unknown;
};

export async function createOrganizationAndTrack(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  const orgName = (formData.get("orgName") as string)?.trim();
  const trackName = (formData.get("trackName") as string)?.trim();
  const trackSlug = (formData.get("trackSlug") as string)?.trim().toLowerCase();
  const timezone = (formData.get("timezone") as string) || "America/New_York";

  if (!orgName || !trackName || !trackSlug) {
    return { error: "All fields are required" };
  }

  const { data, error } = await supabase.rpc("create_organization_with_track", {
    p_org_name: orgName,
    p_billing_email: user.email ?? `${trackSlug}@example.com`,
    p_track_name: trackName,
    p_track_slug: trackSlug,
    p_timezone: timezone,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true, data };
}

export async function testTenantIsolation(targetOrgId: string) {
  const supabase = await createClient();

  // 1. Direct query against organizations table with RLS
  const { data: orgData, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, billing_email, created_at")
    .eq("id", targetOrgId);

  // 2. Direct query against tracks table with RLS
  const { data: trackData, error: trackError } = await supabase
    .from("tracks")
    .select("id, organization_id, slug, name")
    .eq("organization_id", targetOrgId);

  return {
    queriedId: targetOrgId,
    orgsFound: orgData?.length ?? 0,
    orgsData: orgData ?? [],
    tracksFound: trackData?.length ?? 0,
    tracksData: trackData ?? [],
    rlsEnforced: true,
    error: orgError?.message || trackError?.message || null,
  };
}
