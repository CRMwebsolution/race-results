import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function NewClassPage({ params }: { params: Promise<{ trackId: string; eventId: string }> }) {
  const { trackId, eventId } = await params;
  const supabase = await createClient();

  async function createClass(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const scoringType = formData.get("scoring_type") as string;
    const supabase = await createClient();

    const { data: countData } = await supabase
      .from("event_classes")
      .select("id", { count: "exact" })
      .eq("event_id", eventId);
    const orderNum = (countData?.length || 0) + 1;

    await supabase.from("event_classes").insert({
      event_id: eventId,
      track_id: trackId,
      name,
      scoring_type: scoringType as any,
      order_num: orderNum,
    });

    redirect(`/dashboard/tracks/${trackId}/events/${eventId}`);
  }

  return (
    <div className="p-8 max-w-xl mx-auto w-full">
      <h2 className="text-xl font-bold text-white mb-6">Add Event Class</h2>
      <form action={createClass} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1">Class Name</label>
          <input name="name" required className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Scoring Format</label>
          <select name="scoring_type" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
            <option value="fastest_pass">Fastest Pass & Distance</option>
            <option value="consistency">Consistency (2 Passes)</option>
            <option value="combined_time">Combined Time</option>
            <option value="judged_points">Judged Freestyle</option>
            <option value="brackets" disabled>Brackets (Phase 4)</option>
          </select>
        </div>
        <button type="submit" className="bg-amber-500 text-amber-950 font-bold px-4 py-2 rounded">
          Create Class
        </button>
      </form>
    </div>
  );
}
