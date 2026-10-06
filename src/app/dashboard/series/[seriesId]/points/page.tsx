import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

export default async function SeriesPointsPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;
  const supabase = await createClient();

  const { data: series } = await supabase.from("series").select("*").eq("id", seriesId).single();
  
  const { data: classes } = await supabase
    .from("series_classes")
    .select("id, name")
    .eq("series_id", seriesId)
    .order("order_num", { ascending: true });

  const { data: pointsRules } = await supabase
    .from("series_points_rules")
    .select("*")
    .eq("series_id", seriesId)
    .order("rank_start", { ascending: true });

  const { data: bonuses } = await supabase
    .from("series_bonuses")
    .select("*, series_classes(name)")
    .eq("series_id", seriesId)
    .order("created_at", { ascending: true });

  async function addPointsRule(formData: FormData) {
    "use server";
    const rankStart = parseInt(formData.get("rank_start") as string);
    const rankEnd = parseInt(formData.get("rank_end") as string);
    const points = parseInt(formData.get("points") as string);
    
    const supabase = await createClient();
    
    await supabase.from("series_points_rules").insert({
      series_id: seriesId,
      rank_start: rankStart,
      rank_end: rankEnd,
      points: points
    });
    
    revalidatePath(`/dashboard/series/${seriesId}/points`);
    revalidatePath(`/dashboard/series/${seriesId}`);
  }

  async function deletePointsRule(formData: FormData) {
    "use server";
    const ruleId = formData.get("rule_id") as string;
    const supabase = await createClient();
    await supabase.from("series_points_rules").delete().eq("id", ruleId).eq("series_id", seriesId);
    revalidatePath(`/dashboard/series/${seriesId}/points`);
    revalidatePath(`/dashboard/series/${seriesId}`);
  }

  async function addBonus(formData: FormData) {
    "use server";
    const bonusType = formData.get("bonus_type") as string;
    const points = parseInt(formData.get("points") as string);
    const seriesClassId = formData.get("series_class_id") as string;
    const frequency = formData.get("frequency") as string;
    
    const supabase = await createClient();
    
    await supabase.from("series_bonuses").insert({
      series_id: seriesId,
      bonus_type: bonusType,
      points: points,
      series_class_id: seriesClassId === "all" ? null : seriesClassId,
      frequency: frequency
    });
    
    revalidatePath(`/dashboard/series/${seriesId}/points`);
    revalidatePath(`/dashboard/series/${seriesId}`);
  }

  async function deleteBonus(formData: FormData) {
    "use server";
    const bonusId = formData.get("bonus_id") as string;
    const supabase = await createClient();
    await supabase.from("series_bonuses").delete().eq("id", bonusId).eq("series_id", seriesId);
    revalidatePath(`/dashboard/series/${seriesId}/points`);
    revalidatePath(`/dashboard/series/${seriesId}`);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-8">
      <div className="flex items-center space-x-3">
        <Link 
          href={`/dashboard/series/${seriesId}`}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Points & Bonuses</h1>
          <p className="text-sm text-slate-400">{series?.name}</p>
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8">
        {/* Points Rules Section */}
        <div className="space-y-4">
          <h2 className="font-bold text-lg text-white">Placement Points</h2>
          
          <div className="space-y-3">
            {pointsRules?.map(pr => (
              <div key={pr.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-200">
                    {pr.rank_start === pr.rank_end 
                      ? `Rank ${pr.rank_start}` 
                      : pr.rank_end >= 999 
                        ? `Rank ${pr.rank_start} and below` 
                        : `Ranks ${pr.rank_start} - ${pr.rank_end}`}
                  </h3>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="font-bold text-emerald-400">+{pr.points} pts</span>
                  <form action={deletePointsRule}>
                    <input type="hidden" name="rule_id" value={pr.id} />
                    <button className="text-slate-500 hover:text-red-400 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            ))}
            {pointsRules?.length === 0 && (
              <p className="text-sm text-slate-500 bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">No points configured yet.</p>
            )}
          </div>
          
          <form action={addPointsRule} className="bg-slate-900 border border-slate-800 rounded-xl p-4 mt-4">
            <h3 className="text-sm font-bold text-white mb-3">Add Placement Rule</h3>
            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className="block text-[10px] uppercase text-slate-500 mb-1">Start Rank</label>
                <input name="rank_start" type="number" required min="1" placeholder="1" className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] uppercase text-slate-500 mb-1">End Rank</label>
                <input name="rank_end" type="number" required min="1" placeholder="1" className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm" />
                <p className="text-[10px] text-slate-500 mt-1">Use 999 for "and below"</p>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] uppercase text-slate-500 mb-1">Points</label>
                <input name="points" type="number" required min="0" placeholder="50" className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm" />
              </div>
            </div>
            <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold px-3 py-2 rounded-lg transition">Add Rule</button>
          </form>
        </div>
        
        {/* Bonuses Section */}
        <div className="space-y-4">
          <h2 className="font-bold text-lg text-white">Bonus Modifiers</h2>
          
          <div className="space-y-3">
            {bonuses?.map(bonus => (
              <div key={bonus.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-bold text-slate-200 capitalize">{bonus.bonus_type.replace(/_/g, " ")}</h3>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {bonus.series_class_id ? (bonus.series_classes as any)?.name : "All Classes"}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      {bonus.frequency === 'per_event' ? '1 Per Race' : 'Per Class'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-4 pl-4">
                  <span className="font-bold text-emerald-400 whitespace-nowrap">+{bonus.points} pts</span>
                  <form action={deleteBonus}>
                    <input type="hidden" name="bonus_id" value={bonus.id} />
                    <button className="text-slate-500 hover:text-red-400 transition pt-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            ))}
            {bonuses?.length === 0 && (
              <p className="text-sm text-slate-500 bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">No bonuses configured.</p>
            )}
          </div>
          
          <form action={addBonus} className="bg-slate-900 border border-slate-800 rounded-xl p-4 mt-4">
            <h3 className="text-sm font-bold text-white mb-3">Add Bonus</h3>
            <div className="space-y-3 mb-3">
              <div>
                <label className="block text-[10px] uppercase text-slate-500 mb-1">Bonus Condition</label>
                <select name="bonus_type" className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm">
                  <option value="perfect_attendance">Perfect Attendance</option>
                  <option value="consistent_pass">Most Consistent Pass (Event)</option>
                  <option value="fastest_pass">Fastest Pass Overall (Event)</option>
                  <option value="showmanship">Showmanship (Judged)</option>
                  <option value="custom">Custom (Manual Entry)</option>
                </select>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] uppercase text-slate-500 mb-1">Applies To</label>
                  <select name="series_class_id" className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm">
                    <option value="all">All Classes</option>
                    {classes?.map(c => (
                      <option key={c.id} value={c.id}>Only {c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] uppercase text-slate-500 mb-1">Frequency</label>
                  <select name="frequency" className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm">
                    <option value="per_class">Per Class (Multiple winners)</option>
                    <option value="per_event">1 Per Race (Overall winner)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-slate-500 mb-1">Points</label>
                <input name="points" type="number" required min="1" placeholder="10" className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm" />
              </div>
            </div>
            <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold px-3 py-2 rounded-lg transition">Add Bonus</button>
          </form>
        </div>
      </div>
    </div>
  );
}
