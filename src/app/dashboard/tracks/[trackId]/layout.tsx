import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function TrackManagementLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ trackId: string }>;
}) {
  const { trackId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: canView, error } = await supabase.rpc("can_access_track_workspace",{p_track_id:trackId});
  if (error || !canView) redirect("/dashboard");
  return children;
}
