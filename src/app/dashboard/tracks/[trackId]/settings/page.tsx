import {redirect} from "next/navigation";
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

  async function saveDetails(f:FormData) { "use server";
   const db=await createClient();const name=String(f.get("name")||"").trim(),state=String(f.get("state")||"").trim().toUpperCase(),timezone=String(f.get("timezone")||"");
   if(!name||!/^[A-Z]{2}$/.test(state))throw new Error("Track name and two-letter state required");
   try {new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{throw new Error("Choose a valid timezone");}
   const {error}=await db.from("tracks").update({name,state,timezone,shorthand:String(f.get("shorthand")||"").trim()||null}).eq("id",trackId).select("id").single();if(error)throw new Error(error.message);revalidatePath("/dashboard/tracks","layout");revalidatePath("/r","layout");redirect(`/dashboard/tracks/${trackId}/settings?saved=1`);
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
        <form action={saveDetails} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4"><h2 className="text-xl font-bold">Track details</h2>{[["name","Track name",track.name],["shorthand","Short name",track.shorthand],["state","State (two letters)",track.state],["timezone","Timezone",track.timezone]].map(([name,label,value])=><label key={name} className="block">{label}<input name={name!} defaultValue={value||""} required={name!=="shorthand"} className="block w-full p-3 bg-slate-950 border rounded"/></label>)}<p className="text-sm text-slate-400">Public address: /r/{track.slug}</p><button className="p-3 rounded bg-amber-500 text-slate-950">Save track details</button></form>
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
