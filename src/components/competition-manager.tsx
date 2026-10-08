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
        <h1 className="text-2xl font-bold">
          {seriesId ? "Series seasons" : "Track series"}
        </h1>
        <p>
          Create a series season before registering contestants. Use the year
          for a touring series, or the series name and year for a track series.
          Each season starts with fresh registrations and points.
        </p>
        <ActionFeedback error={p.error} message={p.message} />
        <div className="grid gap-3">
          {seasons.map((s) => (
            <Link
              key={s.id}
              href={`${base}/${s.id}`}
              className="p-4 border rounded"
            >
              <strong>{s.name}</strong>
              <p>
                {s.starts_on}
                {s.ends_on ? ` – ${s.ends_on}` : ""}
              </p>
            </Link>
          ))}
        </div>
        <form action={createSeason} className="p-4 border rounded space-y-3">
          <h2 className="text-xl font-bold">Create a series season</h2>
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
          <button className="p-3 rounded bg-amber-500 text-slate-950">
            Create series season
          </button>
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
  function ruleFields(r?: (typeof input.rules)[number]) {
    return (
      <>
        <input type="hidden" name="id" value={r?.id || ""} />
        <label className="block min-w-0">
          First points position
          <input
            type="number"
            min="1"
            required
            name="rank_start"
            defaultValue={r?.rank_start || 1}
            className={inputStyle}
          />
        </label>
        <label className="block min-w-0">
          Last points position
          <input
            type="number"
            min="1"
            required
            name="rank_end"
            defaultValue={r?.rank_end || 1}
            className={inputStyle}
          />
        </label>
        <label className="block min-w-0">
          Points
          <input
            type="number"
            min="0"
            required
            name="points"
            defaultValue={r?.points ?? 10}
            className={inputStyle}
          />
        </label>
      </>
    );
  }
  return (
    <main className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
      <Link href={base} className="text-amber-400">
        All series seasons
      </Link>
      <h1 className="text-2xl font-bold">{season.name}</h1>
      <ActionFeedback error={p.error} message={p.message} />
      <details open className="p-4 border rounded-xl">
        <summary className="font-bold text-xl">Add contestant</summary>
        <form action={register} className="p-4 border rounded space-y-3">
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
          <button
            disabled={!input.classes.length}
            className="p-3 bg-amber-500 text-slate-950 rounded"
          >
            Register entry
          </button>
        </form>
        {!input.classes.length && (
          <p>Add a series class below before registering contestants.</p>
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
        {input.rules.map((r) => (
          <form
            key={r.id}
            action={rule}
            className="p-4 border rounded grid sm:grid-cols-3 gap-3"
          >
            {ruleFields(r)}
            <button className="p-3 border rounded">Save points rule</button>
            <button
              formAction={removeRule}
              className="p-3 border rounded text-red-300"
            >
              Remove points rule
            </button>
          </form>
        ))}
        <form
          action={rule}
          className="p-4 border rounded grid sm:grid-cols-3 gap-3"
        >
          {ruleFields()}
          <button className="p-3 border rounded">Add points rule</button>
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
