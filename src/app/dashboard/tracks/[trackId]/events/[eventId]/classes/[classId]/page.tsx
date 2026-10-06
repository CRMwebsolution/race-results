import { createClient } from "@/lib/supabase/server";

export default async function EditClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const supabase = await createClient();
  const { data: cls } = await supabase.from("event_classes").select("name, scoring_type").eq("id", classId).single();

  return (
    <div className="p-8 max-w-2xl mx-auto w-full">
      <h2 className="text-xl font-bold text-white mb-6">Edit Class Rules</h2>
      <div className="bg-slate-900 border border-slate-800 rounded p-6">
        <h3 className="font-bold text-lg text-white">{cls?.name}</h3>
        <p className="text-slate-400 mt-2">Current format: <span className="text-amber-500 font-mono">{cls?.scoring_type}</span></p>
        <div className="mt-6 border-t border-slate-800 pt-4">
           <p className="text-slate-500 text-sm">Advanced rule configuration (custom tiebreakers, pass limits, combined-time formulas) will be implemented in Phase 3.</p>
        </div>
      </div>
    </div>
  );
}
