import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Flag, Trophy, LayoutDashboard } from "lucide-react";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ trackId: string; eventId: string }>;
}) {
  const { trackId, eventId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify access and get event details
  const { data: event } = await supabase
    .from("events")
    .select(`
      id,
      name,
      slug,
      status,
      tracks (
        id,
        name,
        slug
      )
    `)
    .eq("id", eventId)
    .eq("track_id", trackId)
    .single();

  if (!event || !event.tracks) redirect(`/dashboard/tracks/${trackId}`);

  // Cast because of Supabase array return types when joining
  const track = Array.isArray(event.tracks) ? event.tracks[0] : event.tracks;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B1120]">
      {/* Event Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center space-x-3 text-sm">
            <Link href="/dashboard" className="text-slate-400 hover:text-white transition font-medium">
              Dashboard
            </Link>
            <span className="text-slate-600">/</span>
            <Link href={`/dashboard/tracks/${track.id}`} className="text-slate-400 hover:text-white transition font-medium flex items-center space-x-1.5">
              <Flag className="w-3.5 h-3.5" />
              <span>{track.name}</span>
            </Link>
            <span className="text-slate-600">/</span>
            <span className="font-extrabold tracking-tight text-white flex items-center space-x-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span>{event.name}</span>
            </span>
          </div>
          
          <div className="flex items-center space-x-3">
             <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                event.status === "live"
                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : event.status === "completed"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              {event.status}
            </span>
          </div>
        </div>
      </header>

      <nav aria-label="Event setup and race actions" className="p-4 flex flex-wrap gap-3 border-b border-slate-800">{[["","1. Classes & rules"],["entries","2. Racers"],["settings","3. Date & status"],["scoring","4. Run race"],["judging","Judge scores"]].map(([path,label])=><Link key={path} href={`/dashboard/tracks/${trackId}/events/${eventId}/${path}`} className="p-2 border rounded bg-slate-900">{label}</Link>)}<Link className="p-2 border rounded" href={`/r/${track.slug}/${event.slug}`}>Results / spectator view</Link></nav>
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {children}
      </div>
    </div>
  );
}
