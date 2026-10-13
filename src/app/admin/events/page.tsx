import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, Search, ExternalLink } from "lucide-react";
import { AdminDeleteButton } from "@/components/admin/admin-delete-button";

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: admin, error: adminError } = await supabase.rpc("is_platform_admin");
  if (adminError || !admin) redirect("/dashboard");

  const query = params.q?.trim().toLowerCase() || "";
  const statusFilter = params.status || "all";

  // Query events with tracks and series
  let queryBuilder = supabase
    .from("events")
    .select(`
      id,
      name,
      slug,
      local_date,
      status,
      created_at,
      track_id,
      series_id,
      tracks(id, name, slug),
      series(id, name),
      event_classes(id)
    `)
    .order("local_date", { ascending: false });

  if (statusFilter !== "all") {
    queryBuilder = queryBuilder.eq("status", statusFilter);
  }

  const { data: eventsList, error } = await queryBuilder;

  const filteredEvents = (eventsList || []).filter((e) => {
    if (!query) return true;
    const nameMatch = e.name.toLowerCase().includes(query);
    const slugMatch = e.slug.toLowerCase().includes(query);
    const trackName = ((e.tracks as any)?.name || "").toLowerCase();
    const seriesName = ((e.series as any)?.name || "").toLowerCase();
    return nameMatch || slugMatch || trackName.includes(query) || seriesName.includes(query);
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center space-x-3">
            <Calendar className="w-8 h-8 text-rose-500" />
            <span>Events & Races</span>
          </h1>
          <p className="text-slate-400 mt-2">
            Inspect all events across tracks and series, check live/completed status, and manage or delete events.
          </p>
        </div>
      </div>

      {params.error && (
        <p role="alert" className="text-red-400 p-4 bg-red-950/60 border border-red-800 rounded-xl">
          {params.error}
        </p>
      )}

      {/* Search and Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4">
        <form method="GET" className="flex items-center gap-3 flex-1 w-full">
          <Search className="w-5 h-5 text-slate-500 ml-1" />
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search events by race name, URL slug, track, or series..."
            className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-slate-500"
          />
          {query && (
            <Link
              href="/admin/events"
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
            >
              Clear
            </Link>
          )}
          <button
            type="submit"
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm transition"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2 self-start md:self-auto overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {["all", "live", "completed", "scheduled", "draft"].map((st) => (
            <Link
              key={st}
              href={`/admin/events?${new URLSearchParams({
                ...(query ? { q: query } : {}),
                ...(st !== "all" ? { status: st } : {}),
              }).toString()}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                statusFilter === st
                  ? "bg-slate-700 text-white border border-slate-600"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              {st}
            </Link>
          ))}
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 px-2">
          <span>{filteredEvents.length} Events Found</span>
        </div>

        {filteredEvents.map((event) => {
          const track = event.tracks as any;
          const series = event.series as any;
          const venueLabel = track?.name || (series ? `Series: ${series.name}` : "Independent Event");
          const classCount = event.event_classes?.length || 0;

          // Determine public link
          const publicLink = track?.slug
            ? `/r/${track.slug}/${event.slug}`
            : series?.id
            ? `/s/${series.id}/races/${event.slug}`
            : null;

          return (
            <div
              key={event.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md transition hover:border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-bold text-white">{event.name}</h2>
                  <span
                    className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                      event.status === "live"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse"
                        : event.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : event.status === "scheduled"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    {event.status}
                  </span>
                  <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-mono">
                    /{event.slug}
                  </span>
                </div>

                <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                  <span>📅 <strong className="text-slate-300">{event.local_date}</strong></span>
                  <span>· Venue: <strong className="text-slate-200">{venueLabel}</strong></span>
                  <span>· Classes: <strong className="text-amber-400">{classCount}</strong></span>
                  <span>· ID: <span className="font-mono text-slate-500">{event.id}</span></span>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end md:self-center">
                {publicLink && (
                  <Link
                    href={publicLink}
                    target="_blank"
                    className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium flex items-center space-x-1.5 transition"
                  >
                    <span>Public View</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}

                <AdminDeleteButton
                  itemType="event"
                  itemId={event.id}
                  expectedName={event.name}
                  itemLabel={event.name}
                  buttonLabel="Delete Event"
                />
              </div>
            </div>
          );
        })}

        {filteredEvents.length === 0 && (
          <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-500">
            No events found matching your query or filter.
          </div>
        )}
      </div>
    </div>
  );
}
