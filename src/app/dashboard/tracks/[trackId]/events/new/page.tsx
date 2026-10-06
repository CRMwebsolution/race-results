import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateEventForm } from "./create-event-form";

export default async function NewEventPage({ params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: track } = await supabase
    .from("tracks")
    .select("id, name")
    .eq("id", trackId)
    .single();

  if (!track) redirect("/dashboard");

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-white tracking-tight">
            Schedule New Event
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            For venue: <span className="text-amber-400 font-medium">{track.name}</span>
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 shadow-xl">
          <CreateEventForm trackId={track.id} />
        </div>

        <div className="text-center">
          <Link
            href={`/dashboard/tracks/${track.id}`}
            className="text-sm font-medium text-slate-400 hover:text-white transition"
          >
            Cancel and return to track
          </Link>
        </div>
      </div>
    </div>
  );
}
