import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Trophy, Search, ExternalLink } from "lucide-react";
import { AdminDeleteButton } from "@/components/admin/admin-delete-button";

export default async function AdminSeriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: admin, error: adminError } = await supabase.rpc("is_platform_admin");
  if (adminError || !admin) redirect("/dashboard");

  const query = params.q?.trim().toLowerCase() || "";

  // Query series with organization name and event counts
  const { data: seriesList, error } = await supabase
    .from("series")
    .select(`
      id,
      name,
      description,
      created_at,
      organization_id,
      organizations(id, name),
      events(id)
    `)
    .order("name");

  const filteredSeries = (seriesList || []).filter((s) => {
    if (!query) return true;
    const nameMatch = s.name.toLowerCase().includes(query);
    const orgName = ((s.organizations as any)?.name || "").toLowerCase();
    const orgMatch = orgName.includes(query);
    return nameMatch || orgMatch;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center space-x-3">
            <Trophy className="w-8 h-8 text-purple-500" />
            <span>Championship Series</span>
          </h1>
          <p className="text-slate-400 mt-2">
            Inspect all racing series, view affiliated organizations and seasons, and manage or delete series.
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
            placeholder="Search series by name or organization..."
            className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-slate-500"
          />
          {query && (
            <Link
              href="/admin/series"
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
            >
              Clear
            </Link>
          )}
          <button
            type="submit"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-sm transition"
          >
            Search
          </button>
        </form>
      </div>

      {/* Series List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 px-2">
          <span>{filteredSeries.length} Series Found</span>
        </div>

        {filteredSeries.map((series) => {
          const orgName = (series.organizations as any)?.name || "Unknown Organization";
          const eventCount = series.events?.length || 0;

          return (
            <div
              key={series.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md transition hover:border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-bold text-white">{series.name}</h2>
                </div>

                {series.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 max-w-2xl">
                    {series.description}
                  </p>
                )}

                <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                  <span>Series ID: <span className="font-mono text-slate-500">{series.id}</span></span>
                  <span>· Org: <strong className="text-slate-300">{orgName}</strong></span>
                  <span>· Events: <strong className="text-amber-400">{eventCount}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end md:self-center">
                <Link
                  href={`/s/${series.id}`}
                  target="_blank"
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium flex items-center space-x-1.5 transition"
                >
                  <span>Public View</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>

                <AdminDeleteButton
                  itemType="series"
                  itemId={series.id}
                  expectedName={series.name}
                  itemLabel={series.name}
                  buttonLabel="Delete Series"
                />
              </div>
            </div>
          );
        })}

        {filteredSeries.length === 0 && (
          <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-500">
            No series found matching your query.
          </div>
        )}
      </div>
    </div>
  );
}
