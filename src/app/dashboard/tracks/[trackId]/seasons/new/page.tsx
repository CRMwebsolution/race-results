import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NewSeasonPage({ params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params;
  
  async function createSeason(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const startDate = formData.get("start_date") as string;
    const endDate = formData.get("end_date") as string;
    
    const supabase = await createClient();
    
    // Create season
    const { data: season, error } = await supabase
      .from("seasons")
      .insert({
        track_id: trackId,
        name,
        start_date: startDate || null,
        end_date: endDate || null
      })
      .select("id")
      .single();
      
    if (error || !season) {
      console.error(error);
      return;
    }
    
    // Create default point allocations (1st-10th)
    const defaultPoints = [
      { rank: 1, points: 100 },
      { rank: 2, points: 90 },
      { rank: 3, points: 80 },
      { rank: 4, points: 70 },
      { rank: 5, points: 60 },
      { rank: 6, points: 50 },
      { rank: 7, points: 40 },
      { rank: 8, points: 30 },
      { rank: 9, points: 20 },
      { rank: 10, points: 10 },
    ];
    
    await supabase.from("season_points_allocations").insert(
      defaultPoints.map(p => ({
        season_id: season.id,
        rank: p.rank,
        points: p.points
      }))
    );
    
    revalidatePath(`/dashboard/tracks/${trackId}/seasons`);
    redirect(`/dashboard/tracks/${trackId}/seasons/${season.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <Link 
          href={`/dashboard/tracks/${trackId}/seasons`}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Create New Season</h1>
      </div>
      
      <form action={createSeason} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Season Name</label>
          <input 
            name="name"
            required
            type="text" 
            placeholder="e.g. 2026 Pro Series Championship"
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Start Date (Optional)</label>
            <input 
              name="start_date"
              type="date" 
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">End Date (Optional)</label>
            <input 
              name="end_date"
              type="date" 
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
            />
          </div>
        </div>
        
        <div className="pt-4 mt-4 border-t border-slate-800 flex justify-end">
          <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-6 py-2.5 rounded-xl transition">
            Create Season
          </button>
        </div>
      </form>
    </div>
  );
}
