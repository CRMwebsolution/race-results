import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TrackSettingsForm } from "./track-settings-form";

export default async function TrackSettingsPage({ params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params;
  const supabase = await createClient();

  const { data: track } = await supabase
    .from("tracks")
    .select("*")
    .eq("id", trackId)
    .single();

  if (!track) {
    return <div>Track not found</div>;
  }

  // Pre-defined classes list from class_templates or hardcoded for now
  const availableClasses = [
    { id: "fastest_pass", name: "Fastest Pass", type: "fastest_pass" },
    { id: "consistency", name: "Consistency Bracket", type: "consistency" },
    { id: "combined_time", name: "Combined Time (2 Passes)", type: "combined_time" },
    { id: "judged_points", name: "Judged Freestyle Points", type: "judged_points" },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              href={`/dashboard/tracks/${track.id}`}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="font-bold text-white">Track Settings</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-6">Default Classes</h2>
          <p className="text-slate-400 text-sm mb-6">
            Select the classes this track runs by default. They will be automatically added to any new event you create.
          </p>
          <TrackSettingsForm trackId={track.id} defaultClasses={track.default_classes as any[]} availableClasses={availableClasses} />
        </div>
      </main>
    </div>
  );
}
