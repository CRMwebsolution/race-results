import {DashboardNav} from "@/components/dashboard-nav";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {TipProvider} from "@/components/tip-provider";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  
  const {data: profile} = await supabase.from('profiles').select('show_tips').eq('id', user.id).single();
  const showTips = profile?.show_tips ?? true;

  return <TipProvider showTips={showTips}><DashboardNav/>{children}</TipProvider>;
}
