import {ThemeToggle} from '@/components/theme-toggle';
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Flag } from "lucide-react";
import Link from "next/link";

export default async function PublicTrackLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: track } = await supabase
    .from("tracks")
    .select("id, name, slug, timezone")
    .eq("slug", slug)
    .single();

  if (!track) {
    notFound();
  }

  const {data:championship}=await supabase.from("competition_seasons").select("id").eq("track_id",track.id).limit(1).maybeSingle();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans">
      <header className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap gap-3 items-center justify-between">
          <Link href={`/r/${track.slug}`} className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 group-hover:bg-amber-500/20 transition">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-white text-lg tracking-tight group-hover:text-amber-400 transition">
                {track.name}
              </h1>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                Official Live Results
              </p>
            </div>
          </Link>
          
          <div className="flex flex-wrap items-center gap-3"><ThemeToggle/>
{championship&&(            <Link 
              href={`/r/${track.slug}/standings`}
              className="text-xs font-bold text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg transition"
            >
              Season Standings
            </Link>)}
            <div className="text-xs font-mono text-slate-500 hidden sm:block">
              {track.timezone}
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      <footer className="py-6 text-center border-t border-slate-900">
        <p className="text-xs font-medium text-slate-600 flex items-center justify-center space-x-1.5">
          <span>Powered by</span>
          <span className="font-extrabold text-slate-400 tracking-tight">
            Track<span className="text-amber-500/70">Score</span>
          </span>
        </p>
      </footer>
    </div>
  );
}
