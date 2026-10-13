import { ActionFeedback } from "./action-feedback";
import { TodayDate } from "./today-date";
import { RegistrationList } from "./registration-list";
import { createClient } from "@/lib/supabase/server";
import { readAll } from "@/lib/read-all";
import { loadCompetition } from "@/championship/load";
import { SeriesStandings } from "@/components/series-standings";
import type { calculateSeries } from "@/championship/calculate";
import type { Json } from "@/types/database";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { TipBubble, TipHighlight, GuidedStepBadge } from "@/components/tip-provider";
import { PlacementRuleInputs } from "@/components/placement-points-form";
type OwnerParams = { trackId?: string; seriesId?: string; seasonId?: string };
function failCompetition(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}
const inputStyle =
  "block w-full min-w-0 max-w-full p-3 bg-slate-900 border rounded";
export async function CompetitionManager({
  params,
  searchParams,
}: {
  params: Promise<OwnerParams>;
  searchParams: Promise<{ error?: string; message?: string; version?: string }>;
}) {
  const { trackId, seriesId, seasonId } = await params;
  const p = await searchParams;
  const db = await createClient();
  const ownerId = seriesId || trackId;
  if (!ownerId) notFound();
  const ownerColumn = seriesId ? "series_id" : "track_id";
  const base = `/dashboard/${seriesId ? "series" : "tracks"}/${ownerId}/seasons`;
  const path = seasonId ? `${base}/${seasonId}` : base;
  const { data: seasons, error } = await readAll(
    db
      .from("competition_seasons")
      .select("*")
      .eq(ownerColumn, ownerId)
      .order("starts_on", { ascending: false }),
  );
  if (error) throw new Error(error.message);
  async function createSeason(f: FormData) {
    "use server";
    const db = await createClient();
    const { data, error } = await db.rpc("create_competition_season", {
      p_track_id: (trackId || null) as any,
      p_series_id: (seriesId || null) as any,
      p_name: String(f.get("name")),
      p_starts_on: String(f.get("starts_on")),
      p_ends_on: (String(f.get("ends_on")) || null) as any,
    });
    if (error) redirect(`${base}?error=${encodeURIComponent(error.message)}`);
    revalidatePath("/dashboard", "layout");
    redirect(`${base}/${data}`);
  }
  if (!seasonId)
    return (
      <main className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center space-x-2">
          <Link
            href={seriesId ? `/dashboard/series/${seriesId}` : `/dashboard/tracks/${trackId}`}
            className="text-amber-400 hover:underline inline-flex items-center gap-1 font-semibold"
          >
            &larr; Back to {seriesId ? "Series Hub" : "Track Hub"}
          </Link>
        </div>
        <h1 className="text-2xl font-bold">
          {seriesId ? "Series seasons" : "Track series"}
        </h1>
        <p>
          Create a series season before registering contestants. Use the year
          for a touring series, or the series name and year for a track series.
          Each season starts with fresh registrations and points.
        </p>
        <TipBubble title={seriesId ? "Create Series Season · Step 8" : "Track Series Seasons"}>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            <strong className="text-white">Step 8:</strong> Fill out the form below to create your series season (e.g., 2026 Season). Once created, click into the season to register contestants and set up points!
          </p>
        </TipBubble>
        <ActionFeedback error={p.error} message={p.message} />
        <div className="grid gap-3">
          {seasons.map((s) => (
            <TipHighlight
              key={s.id}
              step="8"
              label="Click season to add contestants"
              active={true}
            >
              <Link
                href={`${base}/${s.id}`}
                className="p-4 border rounded block hover:border-amber-400 transition"
              >
                <strong className="text-amber-400">{s.name}</strong>
                <p className="text-sm text-slate-400">
                  {s.starts_on}
                  {s.ends_on ? ` – ${s.ends_on}` : ""}
                </p>
              </Link>
            </TipHighlight>
          ))}
        </div>
        <form action={createSeason} className="p-4 border rounded space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Create a series season</h2>
            <GuidedStepBadge step="Step 8" label="Create series season" />
          </div>
          <label className="block min-w-0">
            Series / year
            <input
              required
              name="name"
              placeholder="e.g., 2026 season or Summer Series 2026"
              className={inputStyle}
            />
          </label>
          <TodayDate name="starts_on" label="Starts on" />
          <label className="block min-w-0">
            Ends on (optional)
            <input type="date" name="ends_on" className={inputStyle} />
          </label>
          <TipHighlight step="8" label='"Create series season"'>
            <button className="p-3 rounded bg-amber-500 text-slate-950 font-bold">
              Create series season
            </button>
          </TipHighlight>
        </form>
      </main>
    );
  const found = seasons.find((s) => s.id === seasonId);
  if (!found) notFound();
  const { data: allowed } = await db.rpc("can_manage_competition", {
    p_season_id: seasonId,
  });
  if (!allowed) notFound();
  const { season, input, payload } = await loadCompetition(db, seasonId);
  const { data: available } = await readAll(
    db
      .from("events")
      .select("*")
      .eq(ownerColumn, ownerId)
      .is("competition_season_id", null)
      .order("local_date"),
  );
  let versions = db
    .from("competition_result_versions")
    .select("*")
    .eq("season_id", seasonId)
    .order("version", { ascending: false })
    .limit(1);
  if (p.version) versions = versions.eq("version", Number(p.version));
  const { data: version } = await versions.maybeSingle();
  async function register(f: FormData) {
    "use server";
    const db = await createClient();
    const { error } = await db
      .from("competition_registrations")
      .insert({
        season_id: seasonId!,
        class_id: String(f.get("class_id")),
        display_name: String(f.get("display_name")).trim(),
        vehicle_name: String(f.get("vehicle_name")).trim(),
        joined_on: String(f.get("joined_on")),
      });
    if (error) failCompetition(path, error.message);
    revalidatePath("/dashboard", "layout");
    redirect(
      `${path}?message=${encodeURIComponent("Added: " + String(f.get("display_name")).trim())}`,
    );
  }
  async function editRegistration(f: FormData) {
    "use server";
    const db = await createClient();
    const { error } = await db
      .from("competition_registrations")
      .update({
        display_name: String(f.get("display_name")).trim(),
        vehicle_name: String(f.get("vehicle_name")).trim(),
        joined_on: String(f.get("joined_on")),
        left_on: String(f.get("left_on")) || null,
      })
      .eq("id", String(f.get("registration_id")))
      .eq("season_id", seasonId!)
      .select("id")
      .single();
    if (error) failCompetition(path, error.message);
    revalidatePath("/dashboard", "layout");
    redirect(
      `${path}?message=Registration updated; official race eligibility retained`,
    );
  }
  async function withdraw(f: FormData) {
    "use server";
    const db = await createClient();
    const { error } = await db
      .from("competition_registrations")
      .update({ left_on: String(f.get("left_on")) })
      .eq("id", String(f.get("registration_id")))
      .eq("season_id", seasonId!)
      .select("id")
      .single();
    if (error) failCompetition(path, error.message);
    revalidatePath("/dashboard", "layout");
    redirect(`${path}?message=Membership ended; earned points retained`);
  }
  async function addClass(f: FormData) {
    "use server";
    const db = await createClient();
    const { error } = await db
      .from("competition_classes")
      .insert({ season_id: seasonId!, name: String(f.get("name")) });
    if (error) failCompetition(path, error.message);
    revalidatePath("/dashboard", "layout");
    redirect(path);
  }
  async function attach(f: FormData) {
    "use server";
    const db = await createClient();
    const { error } = await db.rpc("attach_competition", {
      p_event_id: String(f.get("event_id")),
      p_season_id: seasonId!,
    });
    if (error) failCompetition(path, error.message);
    revalidatePath("/dashboard", "layout");
    redirect(path);
  }
  async function rule(f: FormData) {
    "use server";
    const db = await createClient();
    const row = {
      season_id: seasonId!,
      rank_start: Number(f.get("rank_start")),
      rank_end: Number(f.get("rank_end")),
      points: Number(f.get("points")),
    };
    const id = String(f.get("id") || "");
    const { error } = id
      ? await db
          .from("competition_points_rules")
          .update(row)
          .eq("id", id)
          .eq("season_id", seasonId!)
          .select("id")
          .single()
      : await db.from("competition_points_rules").insert(row);
    if (error) failCompetition(path, error.message);
    revalidatePath("/dashboard", "layout");
    redirect(path);
  }
  async function bonus(f: FormData) {
    "use server";
    const db = await createClient();
    const { error } = await db
      .from("competition_bonuses")
      .insert({
        season_id: seasonId!,
        bonus_type: String(f.get("bonus_type")),
        points: Number(f.get("points")),
        frequency: String(f.get("frequency")),
        series_class_id: String(f.get("class_id")) || null,
      });
    if (error) failCompetition(path, error.message);
    revalidatePath("/dashboard", "layout");
    redirect(path);
  }
  async function removeBonus(f: FormData) {
    "use server";
    const db = await createClient();
    const { error } = await db
      .from("competition_bonuses")
      .delete()
      .eq("id", String(f.get("id")))
      .eq("season_id", seasonId!);
    if (error) failCompetition(path, error.message);
    revalidatePath("/dashboard", "layout");
    redirect(path);
  }
  async function points(f: FormData) {
    "use server";
    const db = await createClient();
    const current = await loadCompetition(db, seasonId!);
    const revision = Number(f.get("revision"));
    if (current.season.rules_revision !== revision)
      failCompetition(path, "Points changed; reload before editing");
    const registrationId = String(f.get("registration_id"));
    const eventId = String(f.get("event_id")) || null;
    const previous =
      current.payload.standings
        .find((r) => r.racerId === registrationId)
        ?.breakdown.find((b) => b.eventId === (eventId || "season"))?.total ||
      0;
    const { error } = await db.rpc("record_competition_points", {
      p_season_id: seasonId!,
      p_registration_id: registrationId,
      p_event_id: eventId as any,
      p_mode: String(f.get("mode")),
      p_points: Number(f.get("points")),
      p_reason: String(f.get("reason")),
      p_expected_revision: revision,
      p_previous_points: previous,
    });
    if (error) failCompetition(path, error.message);
    revalidatePath("/dashboard", "layout");
    redirect(
      `${path}?message=Points change recorded; publish to update public standings`,
    );
  }
  async function removeRule(f: FormData) {
    "use server";
    const db = await createClient();
    const { error } = await db
      .from("competition_points_rules")
      .delete()
      .eq("id", String(f.get("id")))
      .eq("season_id", seasonId!);
    if (error) failCompetition(path, error.message);
    revalidatePath("/dashboard", "layout");
    redirect(path);
  }

  async function publish() {
    "use server";
    const db = await createClient();
    let data;
    try {
      data = await loadCompetition(db, seasonId!);
    } catch (e) {
      failCompetition(path, (e as Error).message);
    }
    const { error } = await db.rpc("publish_competition_standings", {
      p_season_id: seasonId!,
      p_expected_revision: data.season.rules_revision,
      p_source_ids: data.input.snapshots.map((s) => s.id),
      p_payload: data.payload as unknown as Json,
    });
    if (error) failCompetition(path, error.message);
    revalidatePath("/dashboard", "layout");
    revalidatePath("/s", "layout");
    revalidatePath("/r", "layout");
    redirect(`${path}?message=Standings published`);
  }
  return (
    <main className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-4 flex-wrap">
        <TipHighlight step="10" label='"<-" Back to Series Hub'>
          <Link
            href={seriesId ? `/dashboard/series/${seriesId}` : `/dashboard/tracks/${trackId}`}
            className="text-amber-400 hover:underline inline-flex items-center gap-1 font-semibold"
          >
            &larr; Back to {seriesId ? "Series Hub" : "Track Hub"}
          </Link>
        </TipHighlight>
        <span className="text-slate-600">|</span>
        <Link href={base} className="text-slate-400 hover:text-white text-sm">
          All {seriesId ? "series seasons" : "track series"}
        </Link>
      </div>
      <h1 className="text-2xl font-bold">{season.name}</h1>
      <TipBubble title={seriesId ? "Season Contestants & Setup · Steps 9 & 10" : "Season Contestants & Setup"}>
        <p className="text-xs text-amber-200/90 leading-relaxed">
          <strong className="text-white">Step 9:</strong> Fill out the <strong className="text-white">&ldquo;Add contestant&rdquo;</strong> form below to register drivers for this season. <br/>
          <strong className="text-white">Step 10:</strong> Once contestants are added, click <strong className="text-amber-400">&ldquo;&larr; Back to Series Hub&rdquo;</strong> above to return directly to the series dashboard in one click!
        </p>
      </TipBubble>
      <ActionFeedback error={p.error} message={p.message} />
      <details open className="p-4 border rounded-xl">
        <summary className="font-bold text-xl flex items-center justify-between cursor-pointer">
          <span>Add contestant</span>
          <GuidedStepBadge step="Step 9" label="Fill out add contestants form" />
        </summary>
        <form action={register} className="p-4 border rounded space-y-3 mt-3">
          <p>
            Register each vehicle and class separately for this series season.
            Contestants must also sign up individually at each race; their
            running order can change every time.
          </p>
          <label className="block min-w-0">
            Racer name
            <input required name="display_name" className={inputStyle} />
          </label>
          <label className="block min-w-0">
            Vehicle / number
            <input name="vehicle_name" className={inputStyle} />
          </label>
          <label className="block min-w-0">
            Class
            <select required name="class_id" className={inputStyle}>
              {input.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <TodayDate name="joined_on" label="Membership starts" />
          <TipHighlight step="9" label='"Register entry"'>
            <button
              disabled={!input.classes.length}
              className="p-3 bg-amber-500 text-slate-950 font-bold rounded"
            >
              Register entry
            </button>
          </TipHighlight>
        </form>
        {!input.classes.length && (
          <p className="mt-2 text-sm text-amber-400">Add a series class below before registering contestants.</p>
        )}
      </details>
      <details className="p-4 border rounded-xl space-y-3">
        <summary className="text-xl font-bold">Series races</summary>
        {input.events.map((e) => (
          <Link
            key={e.id}
            className="block p-3 border rounded"
            href={`/dashboard/${seriesId ? "series" : "tracks"}/${ownerId}/events/${e.id}`}
          >
            {e.name} · {e.local_date} · {e.status}
          </Link>
        ))}
        {available.length > 0 && (
          <form action={attach} className="flex flex-wrap gap-3">
            <label className="block min-w-0">
              Add existing race
              <select name="event_id" className={inputStyle}>
                {available.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} · {e.local_date}
                  </option>
                ))}
              </select>
            </label>
            <button className="p-3 border rounded self-end">
              Add race to season
            </button>
          </form>
        )}
        <p>
          Map each race class to its series class in the race class settings.
        </p>
      </details>
      <details className="p-4 border rounded-xl">
        <summary className="font-bold text-xl">
          Registered contestants ({input.registrations.length})
        </summary>
        <RegistrationList
          registrations={input.registrations}
          classes={input.classes}
          edit={editRegistration}
          withdraw={withdraw}
        />
      </details>
      <details className="p-4 border rounded-xl">
        <summary className="font-bold text-xl">Series classes</summary>
        <p className="mb-3">
          Use these classes for series membership and points. Set race scoring
          rules in Classes &amp; rules.
        </p>
        <form action={addClass} className="flex flex-wrap gap-3">
          <label className="block min-w-0">
            Add series class
            <input name="name" required className={inputStyle} />
          </label>
          <button className="p-3 border rounded self-end">Add class</button>
        </form>
      </details>
      <details className="p-4 border rounded-xl space-y-4">
        <summary className="text-xl font-bold">Placement points</summary>
        <p className="text-xs text-slate-400">
          Configure rank finishing points. Check &ldquo;Multi-rank&rdquo; for a finishing range or &ldquo;This rank and below&rdquo; for all remaining finishers.
        </p>
        <div className="space-y-3">
          {input.rules.map((r) => (
            <div
              key={r.id}
              className="p-4 bg-slate-900 border rounded-xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300">
                  {r.rank_start === r.rank_end
                    ? `Rank ${r.rank_start} · ${r.points} points`
                    : r.rank_end >= 999
                    ? `Rank ${r.rank_start} & below · ${r.points} points`
                    : `Ranks ${r.rank_start}–${r.rank_end} · ${r.points} points`}
                </span>
                <form action={removeRule}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="text-xs text-red-300 hover:underline">
                    Remove rule
                  </button>
                </form>
              </div>
              <details>
                <summary className="cursor-pointer text-xs text-slate-400 hover:text-white">
                  Edit rule
                </summary>
                <form action={rule} className="space-y-3 pt-2">
                  <PlacementRuleInputs rule={r} />
                  <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-sm border border-slate-700">
                    Save points rule
                  </button>
                </form>
              </details>
            </div>
          ))}
        </div>
        <form
          action={rule}
          className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4"
        >
          <h3 className="font-bold text-white">Add placement rule</h3>
          <PlacementRuleInputs />
          <button className="w-full p-3 bg-amber-500 hover:bg-amber-400 font-bold rounded-xl text-slate-950 transition">
            Add points rule
          </button>
        </form>
      </details>
      <details className="p-4 border rounded-xl space-y-3">
        <summary className="text-xl font-bold">
          Performance and attendance bonuses
        </summary>
        {input.bonuses.map((b) => (
          <form
            key={b.id}
            action={removeBonus}
            className="p-3 border rounded flex flex-wrap gap-3"
          >
            <p>
              {b.bonus_type.replaceAll("_", " ")} · {b.points} points ·{" "}
              {b.frequency.replaceAll("_", " ")}
            </p>
            <input name="id" type="hidden" value={b.id} />
            <button className="text-red-300">Remove bonus</button>
          </form>
        ))}
        <form action={bonus} className="p-4 border rounded space-y-3">
          <label className="block min-w-0">
            Bonus
            <select name="bonus_type" className={inputStyle}>
              <option value="fastest_pass">Fastest pass</option>
              <option value="consistent_pass">Most consistent passes</option>
              <option value="perfect_attendance">Perfect attendance</option>
            </select>
          </label>
          <label className="block min-w-0">
            Points
            <input
              required
              name="points"
              type="number"
              min="0"
              className={inputStyle}
            />
          </label>
          <label className="block min-w-0">
            Award frequency
            <select name="frequency" className={inputStyle}>
              <option value="per_class">Per class</option>
              <option value="per_event">
                Once per registered entry per race
              </option>
            </select>
          </label>
          <label className="block min-w-0">
            Class
            <select name="class_id" className={inputStyle}>
              <option value="">All classes</option>
              {input.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button className="p-3 border rounded">Add bonus</button>
        </form>
      </details>
      <details className="p-4 border rounded-xl space-y-4">
        <summary className="text-xl font-bold">
          Points amendments and signup awards
        </summary>
        <form action={points} className="p-4 border rounded space-y-3">
          <input type="hidden" name="revision" value={season.rules_revision} />
          <label className="block min-w-0">
            Registered entry
            <select required name="registration_id" className={inputStyle}>
              {input.registrations.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.display_name} · {r.vehicle_name || "Entry"} ·{" "}
                  {input.classes.find((c) => c.id === r.class_id)?.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            Competition
            <select name="event_id" className={inputStyle}>
              <option value="">Season award / early signup bonus</option>
              {input.events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            Change type
            <select name="mode" className={inputStyle}>
              <option value="adjustment">Add or subtract points</option>
              <option value="override">
                Set race points to an exact amount
              </option>
            </select>
          </label>
          <label className="block min-w-0">
            Points
            <input
              required
              name="points"
              type="number"
              min="-1000000"
              max="1000000"
              className={inputStyle}
            />
          </label>
          <label className="block min-w-0">
            Explanation
            <textarea required name="reason" className={inputStyle} />
          </label>
          <button
            disabled={!input.registrations.length}
            className="p-3 border rounded"
          >
            Record explained change
          </button>
        </form>
        <details className="p-4 border rounded">
          <summary>Points edit history</summary>
          {input.changes.map((c) => (
            <article key={c.id} className="p-3 border-t">
              <p>
                {
                  input.registrations.find((r) => r.id === c.registration_id)
                    ?.display_name
                }{" "}
                · {c.mode === "override" ? "Set points" : "Adjustment"}{" "}
                {c.points} ·{" "}
                {c.previous_points === null
                  ? "Previous points unpublished"
                  : `Previous points: ${c.previous_points}`}
              </p>
              <p>{c.reason}</p>
              <p className="text-sm text-slate-400">
                {c.created_at} · Editor {c.actor_id}
              </p>
            </article>
          ))}
        </details>
      </details>
      <details className="p-4 border rounded-xl space-y-4">
        <summary className="text-xl font-bold">
          {p.version && version
            ? `Published standings · Version ${version.version}`
            : "Current standings"}
        </summary>
        {!p.version && (
          <p className="text-sm text-slate-400">
            These totals include your latest saved changes.
          </p>
        )}
        <SeriesStandings
          payload={
            p.version && version
              ? (version.payload as unknown as ReturnType<
                  typeof calculateSeries
                >)
              : payload
          }
          current={p.version && version ? version.is_current : true}
        />
        {!p.version && (
          <form action={publish}>
            <button className="p-3 bg-amber-500 text-slate-950 rounded">
              Publish series standings
            </button>
          </form>
        )}
        {version && (
          <>
            <p>
              Published version {version.version} · {version.published_at}
            </p>
            <nav
              aria-label="Standings versions"
              className="flex flex-wrap gap-3"
            >
              {Array.from({ length: version.version }, (_, i) => (
                <Link key={i} href={`?version=${i + 1}`}>
                  Published version {i + 1}
                </Link>
              ))}
              <Link href="?">Current standings</Link>
            </nav>
          </>
        )}
      </details>
    </main>
  );
}
