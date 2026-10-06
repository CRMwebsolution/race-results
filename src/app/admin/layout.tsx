import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Settings, Users, Database, LayoutDashboard } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");

  if (!isAdmin) {
    notFound();
  }

  return (
    <div className="flex h-screen bg-[#020617] font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-slate-800">
          <Link href="/dashboard" className="flex items-center space-x-2 text-slate-400 hover:text-white transition mb-4">
            <LayoutDashboard className="w-4 h-4" />
            <span className="text-sm font-medium">Exit to App</span>
          </Link>
          <div className="flex items-center space-x-2 text-rose-500 font-extrabold tracking-tight">
            <Settings className="w-5 h-5" />
            <span>Platform Admin</span>
          </div>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-2">
          <Link
            href="/admin"
            className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition"
          >
            <Database className="w-4 h-4" />
            <span>Overview</span>
          </Link>
          <Link
            href="/admin/organizations"
            className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition"
          >
            <Users className="w-4 h-4" />
            <span>Organizations</span>
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center px-8 md:hidden">
          <span className="text-rose-500 font-extrabold">Platform Admin</span>
        </header>
        <div className="flex-1 overflow-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
