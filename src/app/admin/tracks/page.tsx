import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Flag, Search, ExternalLink } from "lucide-react";
import { AdminDeleteButton } from "@/components/admin/admin-delete-button";

export default async function AdminTracksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: admin, error: adminError } = await supabase.rpc("is_platform_admin");
  if (adminError || !admin) redirect("/dashboard");

  const query = params.q?.trim().toLowerCase() || "";

  // Query tracks with organization name and event counts
  const { data: tracks, error } = await supabase
    .from("tracks")
    .select(`
      id,
      name,
      slug,
      shorthand,
      state,
      timezone,
      created_at,
      organization_id,
      organizations(id, name),
      events(id)
    `)
    .order("name");

  const filteredTracks = (tracks || []).filter((t) => {
    if (!query) return true;
    const nameMatch = t.name.toLowerCase().includes(query);
    const slugMatch = t.slug.toLowerCase().includes(query);
    const orgName = ((t.organizations as any)?.name || "").toLowerCase();
    const orgMatch = orgName.includes(query);
    return nameMatch || slugMatch || orgMatch;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center space-x-3">
            <Flag className="w-8 h-8 text-blue-500" />
            <span>Tracks</span>
          </h1>
          <p className="text-slate-400 mt-2">
            Inspect all registered race tracks, view affiliated organizations, and manage or delete tracks.
          </p>
        </div>
      </div>

      {params.error && (
        <p role="alert" className="text-red-400 p-4 bg-red-950/60 border border-red-800 rounded-xl">
          {params.error}
        </p>
      )}

      {/* Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <form method="GET" className="flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-500 ml-1" />
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search tracks by name, URL slug, or organization..."
            className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-slate-500"
          />
          {query && (
            <Link
              href="/admin/tracks"
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
            >
              Clear
            </Link>
          )}
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition"
          >
            Search
          </button>
        </form>
      </div>

      {/* Tracks List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 px-2">
          <span>{filteredTracks.length} Tracks Found</span>
        </div>

        {filteredTracks.map((track) => {
          const orgName = (track.organizations as any)?.name || "Unknown Organization";
          const eventCount = track.events?.length || 0;

          return (
            <div
              key={track.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md transition hover:border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-bold text-white">{track.name}</h2>
                  {track.state && (
                    <span className="text-xs font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md">
                      {track.state}
                    </span>
                  )}
                  <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-mono">
                    /{track.slug}
                  </span>
                </div>

                <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                  <span>Track ID: <span className="font-mono text-slate-500">{track.id}</span></span>
                  <span>· Org: <strong className="text-slate-300">{orgName}</strong></span>
                  <span>· Events: <strong className="text-amber-400">{eventCount}</strong></span>
                  <span>· TZ: <span className="text-slate-300">{track.timezone}</span></span>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end md:self-center">
                <Link
                  href={`/r/${track.slug}`}
                  target="_blank"
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium flex items-center space-x-1.5 transition"
                >
                  <span>Public View</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>

                <AdminDeleteButton
                  itemType="track"
                  itemId={track.id}
                  expectedName={track.name}
                  itemLabel={track.name}
                  buttonLabel="Delete Track"
                />
              </div>
            </div>
          );
        })}

        {filteredTracks.length === 0 && (
          <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-500">
            No tracks found matching your query.
          </div>
        )}
      </div>
    </div>
  );
}
