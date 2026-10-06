import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SeriesManagementLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ seriesId: string }>;
}) {
  const { seriesId } = await params;
  const supabase = await createClient();
  const { data: series } = await supabase.from("series")
    .select("organization_id").eq("id", seriesId).single();
  if (!series) notFound();
  const [{ data: orgAdmin }, { data: platformAdmin }] = await Promise.all([
    supabase.rpc("is_org_admin", { p_org_id: series.organization_id }),
    supabase.rpc("is_platform_admin"),
  ]);
  if (!orgAdmin && !platformAdmin) notFound();
  return children;
}
