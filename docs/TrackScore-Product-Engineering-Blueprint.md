# TrackScore Product and Engineering Blueprint

Product and engineering build specification

TrackScore is a standalone SaaS product for track owners to configure events, record official results, publish live standings, and manage one-time events or complete seasons. The product is designed to support timed passes, consistency, combined times, judged freestyle, teams, head-to-head competition, and additional versioned scoring formats.

This is the authoritative build specification and code reference for TrackScore, not a finished website. Required behavior defines the product contract. Proposed implementation examples show one acceptable foundation, but production code must also satisfy the surrounding validation, security, audit, and testing requirements.

## 1 Product outcome

The service should let a track owner:

1. Learn which race formats the system supports before signing up.
2. Choose a one-time event or an ongoing season plan.
3. Create and verify an account, pay, and receive the matching entitlement.
4. Create a track profile and invite other officials.
5. Create one event or a multi-race schedule.
6. Add classes and choose a scoring format and rules for every class.
7. Enter competitors, runs, judge scores, teams, or heat outcomes during the event.
8. Publish live results to spectators.
9. Export official results and preserve a public archive according to the purchased plan.

The product should not be limited to mud racing. The data model and scoring engine should treat a track as a venue, an event as a date or meet, a class as the unit with scoring rules, and an entry as the competitor or team being ranked.

## 2 Launch foundation and required behavior

TrackScore should launch with the following product behavior:

|Capability|Required behavior|Engineering decision|
|-|-|-|
|Event archive|Group published events by year|Use tenant-scoped public URLs|
|Event setup|Staff create an event and copy selected class templates into it|Make creation transactional and idempotent|
|Class setup|Each class has a name, order, scoring type, and versioned rules|Store immutable event-class configuration snapshots|
|Race-night editor|Prepare blank local rows, add more rows on demand, preview metrics immediately, and save a logical batch|Use normalized entries and attempts with one transactional save command|
|Fastest pass|Lowest valid timed pass wins; a timed completion beats a stopped distance|Implement as a versioned scoring plug-in|
|Consistency|Absolute difference between two timed passes, rounded to three decimals|Implement as the default two-pass consistency rule|
|Stopped distance|Greatest recorded distance wins when there is no timed completion|Support as fastest-pass fallback or a dedicated distance format|
|Publication|Draft events remain private; only published revisions appear publicly|Validate and publish immutable snapshots|
|Live viewing|Spectators receive timely updates without downloading every result repeatedly|Use a revision signal, authoritative refetch, and fallback polling|
|PDF and CSV|Official exports represent one saved revision|Generate format-aware exports from published snapshots|
|Authorization|Owners and staff have track-scoped roles|Enforce organizations, tracks, memberships, roles, and RLS|
|Billing|Paid access controls event and season capabilities|Add checkout, verified webhooks, entitlements, and customer self-service|

Tenant isolation, transactional saves, versioned scoring rules, auditable publication, and entitlements are foundation requirements rather than later add-ons.

## 3 Customer facing race format catalog

The marketing site should have one clear page per format and a comparison page. Each page should show the inputs an official records, how the winner is determined, a small worked example, and a screenshot or interactive sample leaderboard.

|Format|What the official records|Winner or ranking rule|Recommended release|
|-|-|-|-|
|Fastest pass|One or more elapsed times, DQ, DNF, or stopped distance|Lowest valid elapsed time; if no one completes, greatest distance can rank the field|Launch|
|Consistency|Two timed passes at launch|Smallest absolute difference; fastest pass is the first tiebreaker|Launch|
|Combined time|Required stage or pass times and penalties|Lowest sum of required adjusted times|Launch|
|Side by side|Bracket, lanes, winner, DQ, forfeit, bye, optional elapsed time|Explicit heat outcome advances the winner; elapsed time is informational unless rules enable it as a tiebreaker|Launch|
|Freestyle judged points|Scores by criterion from multiple judges plus penalties|Highest adjusted judge score|Launch or immediate second release|
|Team competition|Team roster and each member's underlying result|Configurable best N or all-member aggregate|Second release|
|Season points|Event finishing place and points table|Highest season points after drops and tiebreakers|Season plan|
|Target or index time|Target time and each pass|Smallest non-breakout deviation, or another explicitly configured index rule|Later format plug-in|

Do not make the scoring formats separate paid add-ons at launch. The format is part of the event's rules, not a billing unit. Plans should differ by usage and organizational value instead.

## 4 Recommended plans and entitlements

### Preview workspace

This is not a paid tier. It is a seeded sandbox where a prospect can try each race format without publishing a real event. It should expire automatically and should not accept real payment or personal racer data.

### One time Event Pass

* One track and one event credit.
* All launch scoring formats.
* A small number of staff seats, such as two or three.
* Live public results, saved official PDF, and data export.
* A clearly stated period for dashboard access and hosted archive retention.
* Optional conversion credit if the customer upgrades to a season shortly after the event.

### Season plan

* One track with an ongoing schedule.
* Either a clearly stated annual event allowance or unlimited reasonable use.
* More staff seats.
* Schedule page, season standings, records, reusable class templates, branding, and exports.
* Monthly and annual billing can point to the same entitlement model.

### Promoter or multi track plan

Add this only when customer demand is real. It supports several tracks or touring events under one billing organization, centralized staff permissions, cross-event reports, and more seats. It should use the same application and data model, not a forked product.

### Limits that belong in entitlements

|Limit|Event Pass|Season|Promoter|
|-|-|-|-|
|Tracks|1|1|Configurable multiple|
|New events|1 purchased credit|Allowance or reasonable-use unlimited|Allowance by contract|
|Staff seats|Small fixed number|Larger fixed number|Configurable|
|Public results|Included|Included|Included|
|Formats|All launch formats|All formats|All formats|
|Schedule and standings|Event only|Included|Included|
|Branding|Basic|Track branding|Multi-brand or series branding|
|Data export|Included|Included|Included plus organization reports|

Pricing, exact quotas, taxes, refunds, archive retention, and cancellation behavior are business decisions. They should be configuration, not hardcoded conditionals scattered through the application.

## 5 Purchase and onboarding flow

The requested flow should be adjusted slightly: create and verify the account before payment. That gives the purchase a durable owner and makes failed or delayed payment webhooks recoverable.

1. Visitor reviews formats and plans.
2. Visitor chooses Event Pass, Season, or Promoter.
3. Visitor creates and verifies an account.
4. Server creates a pending organization and checkout session tied to that user and selected offer.
5. Payment provider completes checkout.
6. A signed webhook records the payment and activates the entitlement. The browser success page is not trusted as proof of payment.
7. User returns to the application and the onboarding wizard reads the active entitlement.
8. User creates a track profile, including name, public slug, timezone, logo, and optional website link.
9. Event Pass customers create their purchased event. Season customers can create a schedule or their first event.
10. User creates reusable class templates or starts with suggested templates.
11. Dashboard opens on the next action: event setup, staff invitations, or live entry.

Recommended state names are `pending\_payment`, `active`, `past\_due`, `cancelled`, and `expired`. Editing and creating events should depend on an active entitlement. Public result retention after expiration must be a written policy rather than an accidental side effect.

## 6 Dashboard information architecture

|Area|Purpose|
|-|-|
|Overview|Upcoming event, recent results, entitlement usage, setup checklist, and alerts|
|Schedule|Create events, change dates and status, and order a season schedule|
|Event setup|Configure classes, format, rules, fees, publication, and officials|
|Live control|Enter attempts, scores, teams, or heat outcomes and publish revisions|
|Public preview|Preview exactly what spectators will see before publication|
|Class templates|Reusable names, rules, format defaults, entry fees, and order|
|Competitors|Optional profiles and aliases while preserving the typed display name on each entry|
|Teams|Rosters and team entries for applicable classes|
|Standings|Event results, records, and season points|
|Staff|Invite owners, administrators, officials, scorers, and read-only helpers|
|Billing|Plan, invoices, payment method, usage, cancellation, and export|
|Track settings|Public slug, timezone, logo, colors, links, and retention choices|

An event creation wizard should ask for event name, local date and time, location or track, schedule visibility, and default publication state. Then it should let the owner choose class templates. Every event class receives a snapshot of its name, rules, entry fee, scoring type, and scoring configuration so later template edits do not rewrite history.

## 7 Core domain model

Use organizations for billing ownership and tracks for venues. Most customers will have one of each, but the separation prevents a future multi-track plan from requiring a migration.

|Entity|Key fields|Responsibility|
|-|-|-|
|organizations|id, name, billing email, created at|Customer and billing boundary|
|organization memberships|organization id, user id, role, active|Billing and organization access|
|tracks|id, organization id, slug, name, timezone, branding|Venue and public identity|
|track memberships|track id, user id, role, active|Race-operation access|
|entitlements|organization id, offer, status, event allowance, used events, track limit, seat limit, dates|Trusted product access|
|events|id, track id, slug, name, local date, status, published revision, working revision|Meet or race date|
|class templates|track id, name, rules, scoring type, scoring config, active, order|Reusable defaults|
|event classes|event id, template id, snapshot fields, scoring version, order|Historical class and its rules|
|competitors|track id, display name, optional contact or identifier|Optional reusable identity|
|entries|event class id, competitor id, display name snapshot, team id, seed, status|One ranked participant|
|attempts|entry id, ordinal, status, elapsed milliseconds, distance millimeters, penalty milliseconds, raw input|Timed or distance performance|
|teams and team members|track id, names, roster links|Team identity and membership|
|heats and heat lanes|event class id, bracket round, lane entry, outcome, finish order|Side-by-side bracket truth|
|judges and judge scores|event class id, judge slot, entry, criterion, fixed-point score|Judged competition truth|
|result revisions|event id, revision, calculation version, snapshot, published at|Reproducible public results|
|audit events|actor, tenant, action, target, before and after data, timestamp|Correction and support trail|
|billing events|provider event id, type, payload hash, processed at|Idempotent payment processing|

### Important modeling rules

* Store elapsed time as integer milliseconds and judged values as fixed-point integers or database `numeric`, not floating-point JavaScript values.
* Preserve `raw\_input` for imports and operator troubleshooting.
* Store a scoring configuration snapshot on each event class. Never reinterpret old results with a newly changed global rule.
* A side-by-side winner is an outcome, not the minimum elapsed time.
* A team score is derived from member results; preserve the member results used in the published calculation.
* Public results should identify the calculation version and event revision.
* Every child row must be provably in the same track as its parent. Do not trust a client supplied track identifier.

## 8 Suggested database foundation

The following is a representative core, not a complete migration. UUID defaults, timestamps, check constraints, foreign keys, indexes, and row-level security must be present in the production migration.

```sql
create type scoring\_type as enum (
  'fastest\_pass',
  'consistency',
  'combined\_time',
  'head\_to\_head',
  'judged\_points',
  'team\_aggregate',
  'season\_points'
);

create table organizations (
  id uuid primary key default gen\_random\_uuid(),
  name text not null,
  billing\_email text not null,
  created\_at timestamptz not null default now()
);

create table tracks (
  id uuid primary key default gen\_random\_uuid(),
  organization\_id uuid not null references organizations(id),
  slug text not null,
  name text not null,
  timezone text not null,
  created\_at timestamptz not null default now(),
  unique (organization\_id, id),
  unique (slug)
);

create table events (
  id uuid primary key default gen\_random\_uuid(),
  track\_id uuid not null references tracks(id),
  slug text not null,
  name text not null,
  local\_date date not null,
  starts\_at timestamptz,
  status text not null check (status in ('draft','scheduled','live','completed','cancelled')),
  working\_revision bigint not null default 0,
  published\_revision bigint,
  created\_at timestamptz not null default now(),
  updated\_at timestamptz not null default now(),
  unique (track\_id, slug),
  unique (track\_id, id)
);

create table event\_classes (
  id uuid primary key default gen\_random\_uuid(),
  event\_id uuid not null references events(id) on delete cascade,
  track\_id uuid not null,
  template\_id uuid,
  name text not null,
  rules\_text text,
  entry\_fee\_text text,
  scoring\_type scoring\_type not null,
  scoring\_version integer not null default 1,
  scoring\_config jsonb not null default '{}'::jsonb,
  order\_num integer not null check (order\_num > 0),
  unique (event\_id, order\_num),
  unique (event\_id, id),
  foreign key (track\_id, event\_id) references events(track\_id, id)
);

create table entries (
  id uuid primary key default gen\_random\_uuid(),
  event\_class\_id uuid not null references event\_classes(id) on delete cascade,
  display\_name text not null,
  competitor\_id uuid,
  team\_id uuid,
  seed integer,
  status text not null default 'active',
  order\_num integer not null,
  unique (event\_class\_id, order\_num),
  unique (event\_class\_id, id)
);

create table attempts (
  id uuid primary key default gen\_random\_uuid(),
  event\_class\_id uuid not null,
  entry\_id uuid not null,
  ordinal integer not null check (ordinal > 0),
  status text not null check (status in ('valid','dq','dnf','dns','no\_time')),
  elapsed\_ms integer check (elapsed\_ms is null or elapsed\_ms > 0),
  distance\_mm integer check (distance\_mm is null or distance\_mm >= 0),
  penalty\_ms integer not null default 0 check (penalty\_ms >= 0),
  raw\_input text,
  unique (entry\_id, ordinal),
  foreign key (event\_class\_id, entry\_id)
    references entries(event\_class\_id, id) on delete cascade,
  check (
    (status = 'valid' and num\_nonnulls(elapsed\_ms, distance\_mm) = 1)
    or (status <> 'valid' and elapsed\_ms is null and distance\_mm is null)
  )
);
```

For multi-tenant safety, add composite unique keys and composite foreign keys all the way down or expose writes only through tenant-validating transactions. The final design may duplicate `track\_id` on additional child tables to make authorization and indexing straightforward.

## 9 Versioned scoring contract

All formats should implement the same small contract. A calculated result contains a primary sortable value, direction, tiebreakers, display fields, and enough details to explain the answer.

```ts
export type Direction = "asc" | "desc";
export type AttemptStatus = "valid" | "dq" | "dnf" | "dns" | "no\_time";

export type Attempt = {
  id: string;
  entryId: string;
  ordinal: number;
  status: AttemptStatus;
  elapsedMs: number | null;
  distanceMm: number | null;
  penaltyMs: number;
  rawInput?: string | null;
};

export type Score = {
  eligible: boolean;
  primary: number | null;
  direction: Direction;
  tieBreakers: number\[];
  label: string;
  details: Record<string, unknown>;
};

export type Scorer<TConfig, TInput> =
  (input: TInput, config: TConfig) => Score;

export function compareScores(a: Score, b: Score): number {
  if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
  if (a.primary == null || b.primary == null) {
    return a.primary == null ? (b.primary == null ? 0 : 1) : -1;
  }
  const primary = a.direction === "asc"
    ? a.primary - b.primary
    : b.primary - a.primary;
  if (primary) return primary;
  const length = Math.max(a.tieBreakers.length, b.tieBreakers.length);
  for (let i = 0; i < length; i += 1) {
    const difference = (a.tieBreakers\[i] ?? Number.MAX\_SAFE\_INTEGER)
      - (b.tieBreakers\[i] ?? Number.MAX\_SAFE\_INTEGER);
    if (difference) return difference;
  }
  return 0;
}
```

The final stable ordering should append seed, entry order, and entry ID outside the scorer. That ensures repeated calculations produce the same public order even when two performances are truly tied.

## 10 Fastest pass and stopped distance

### Required launch behavior

TrackScore parses times, distance markers, DQ text, blank values, and configured no-pass markers. It chooses the lowest timed pass. If no timed pass exists, it chooses the greatest distance. A completed timed run always outranks a stopped distance.

Examples:

|Pass one|Pass two|Best pass|Consistency|
|-|-|-|-|
|9.082|9.019|9.019|0.063|
|9.000|9.000|9.000|0.000|
|8.900|200ft|8.900|Not applicable|
|200ft|120ft|200ft|Not applicable|
|DQ|108.9ft|108.9ft|Not applicable|

### Proposed implementation

```ts
function adjustedTime(attempt: Attempt): number | null {
  return attempt.status === "valid" \&\& attempt.elapsedMs != null
    ? attempt.elapsedMs + attempt.penaltyMs
    : null;
}

export function scoreFastestPass(attempts: Attempt\[]): Score {
  const times = attempts.map(adjustedTime).filter((v): v is number => v != null);
  if (times.length) {
    const best = Math.min(...times);
    return {
      eligible: true,
      primary: best,
      direction: "asc",
      tieBreakers: \[],
      label: `${(best / 1000).toFixed(3)} s`,
      details: { bestElapsedMs: best },
    };
  }

  const distances = attempts
    .filter((a) => a.status === "valid" \&\& a.distanceMm != null)
    .map((a) => a.distanceMm as number);
  if (distances.length) {
    const bestDistance = Math.max(...distances);
    return {
      eligible: true,
      primary: -bestDistance,
      direction: "asc",
      tieBreakers: \[],
      label: `${(bestDistance / 304.8).toFixed(1)} ft`,
      details: { bestDistanceMm: bestDistance, completed: false },
    };
  }

  return {
    eligible: false,
    primary: null,
    direction: "asc",
    tieBreakers: \[],
    label: "No qualifying pass",
    details: {},
  };
}
```

In production, do not compare negated distance and elapsed milliseconds as if they share a unit. Add a completion-group field to the sort key so completed times sort before distances, then sort each group in its own direction. The compact function above demonstrates the calculation; production code must implement the mixed-kind precedence explicitly and cover it with regression tests.

## 11 Consistency

The launch rule is: two valid timed passes are required, and the score is the absolute difference. The lower difference wins. The best pass is the first tiebreaker.

```ts
type ConsistencyConfig = {
  requiredOrdinals: \[number, number];
  decimals: 3;
};

export const scoreConsistency: Scorer<ConsistencyConfig, Attempt\[]> =
  (attempts, config) => {
    const byOrdinal = new Map(attempts.map((a) => \[a.ordinal, a]));
    const selected = config.requiredOrdinals.map((n) => byOrdinal.get(n));
    const times = selected.map((a) => a ? adjustedTime(a) : null);
    if (times.some((v) => v == null)) {
      return {
        eligible: false,
        primary: null,
        direction: "asc",
        tieBreakers: \[],
        label: "Two valid passes required",
        details: {},
      };
    }
    const first = times\[0] as number;
    const second = times\[1] as number;
    const difference = Math.abs(first - second);
    return {
      eligible: true,
      primary: difference,
      direction: "asc",
      tieBreakers: \[Math.min(first, second)],
      label: `${(difference / 1000).toFixed(config.decimals)} s`,
      details: { firstMs: first, secondMs: second, differenceMs: difference },
    };
  };
```

If the product later supports three or more consistency runs, add a new scoring version with an explicit method such as smallest pair spread, full-field range, or standard deviation. Do not silently change the meaning of existing consistency classes.

## 12 Combined time

Combined time should sum specifically required runs or stages, including time penalties. A missing, DQ, DNF, or no-time required stage makes the entry unranked unless the class rules explicitly allow a replacement or fixed penalty.

```ts
type CombinedTimeConfig = {
  requiredOrdinals: number\[];
  missingPolicy: "unranked" | "fixed\_penalty";
  missingPenaltyMs?: number;
};

export const scoreCombinedTime: Scorer<CombinedTimeConfig, Attempt\[]> =
  (attempts, config) => {
    const byOrdinal = new Map(attempts.map((a) => \[a.ordinal, a]));
    const components = config.requiredOrdinals.map((ordinal) => {
      const attempt = byOrdinal.get(ordinal);
      const time = attempt ? adjustedTime(attempt) : null;
      if (time != null) return { ordinal, value: time, substituted: false };
      if (config.missingPolicy === "fixed\_penalty" \&\& config.missingPenaltyMs != null) {
        return { ordinal, value: config.missingPenaltyMs, substituted: true };
      }
      return null;
    });

    if (components.some((part) => part == null)) {
      return {
        eligible: false,
        primary: null,
        direction: "asc",
        tieBreakers: \[],
        label: "Incomplete",
        details: { requiredOrdinals: config.requiredOrdinals },
      };
    }

    const totalMs = components.reduce((sum, part) => sum + part!.value, 0);
    return {
      eligible: true,
      primary: totalMs,
      direction: "asc",
      tieBreakers: \[],
      label: `${(totalMs / 1000).toFixed(3)} s`,
      details: { components },
    };
  };
```

Example: 9.412 seconds plus 9.288 seconds plus a 0.500 second penalty produces 19.200 seconds.

## 13 Judged freestyle points

The class configuration should define criteria, their weights, score range, judge count, whether high and low totals are dropped, and penalty units. Judges should enter each criterion independently so corrections are auditable.

Store points in hundredths. A displayed 8.75 becomes `875`. Fixed-point arithmetic avoids binary floating-point surprises.

```ts
type JudgeScore = {
  judgeId: string;
  criterionId: string;
  pointsHundredths: number;
};

type Criterion = {
  id: string;
  weightBasisPoints: number; // 10000 means 100 percent
};

type JudgedConfig = {
  criteria: Criterion\[];
  minimumJudges: number;
  dropHighLow: boolean;
};

function roundDivide(numerator: number, denominator: number): number {
  return Math.round(numerator / denominator);
}

export function scoreJudgedEntry(
  scores: JudgeScore\[],
  penaltiesHundredths: number,
  config: JudgedConfig,
): Score {
  const byJudge = new Map<string, JudgeScore\[]>();
  for (const score of scores) {
    const bucket = byJudge.get(score.judgeId) ?? \[];
    bucket.push(score);
    byJudge.set(score.judgeId, bucket);
  }

  const judgeTotals = \[...byJudge.entries()].flatMap((\[judgeId, rows]) => {
    const values = new Map(rows.map((row) => \[row.criterionId, row.pointsHundredths]));
    if (config.criteria.some((criterion) => !values.has(criterion.id))) return \[];
    const weighted = config.criteria.reduce((sum, criterion) =>
      sum + (values.get(criterion.id)! \* criterion.weightBasisPoints), 0);
    return \[{ judgeId, total: roundDivide(weighted, 10000) }];
  });

  if (judgeTotals.length < config.minimumJudges) {
    return {
      eligible: false,
      primary: null,
      direction: "desc",
      tieBreakers: \[],
      label: "Waiting for judges",
      details: { completedJudges: judgeTotals.length },
    };
  }

  const ordered = \[...judgeTotals].sort((a, b) => a.total - b.total);
  const counted = config.dropHighLow \&\& ordered.length >= 5
    ? ordered.slice(1, -1)
    : ordered;
  const average = roundDivide(
    counted.reduce((sum, judge) => sum + judge.total, 0),
    counted.length,
  );
  const adjusted = average - penaltiesHundredths;
  return {
    eligible: true,
    primary: adjusted,
    direction: "desc",
    tieBreakers: \[],
    label: (adjusted / 100).toFixed(2),
    details: { judgeTotals, countedJudgeIds: counted.map((j) => j.judgeId), penaltiesHundredths },
  };
}
```

If two judge totals are equal at the high or low boundary, the class rules must state how the dropped judge is selected. A deterministic answer is to sort by total and then judge slot. The published calculation should list counted scores and penalties so the result can be explained.

## 14 Side by side and bracket racing

Elapsed time must not be used to infer the heat winner. The operator records the official outcome: winner, runner-up, DQ, forfeit, bye, or no contest. Elapsed and reaction times can still be displayed and used only when the class configuration explicitly names them as a tiebreaker.

```ts
type LaneOutcome = {
  entryId: string;
  lane: "left" | "right";
  outcome: "winner" | "runner\_up" | "dq" | "forfeit" | "bye" | "no\_contest";
  finishOrder: number | null;
  elapsedMs: number | null;
};

export function resolveHeat(lanes: LaneOutcome\[]) {
  if (lanes.length === 1 \&\& lanes\[0].outcome === "bye") {
    return { winnerEntryId: lanes\[0].entryId, reason: "bye" as const };
  }
  const explicitWinners = lanes.filter((lane) => lane.outcome === "winner");
  if (explicitWinners.length !== 1) {
    throw new Error("A completed heat needs exactly one official winner.");
  }
  const winner = explicitWinners\[0];
  const other = lanes.find((lane) => lane.entryId !== winner.entryId);
  if (!other) throw new Error("A non-bye heat needs two lanes.");
  return {
    winnerEntryId: winner.entryId,
    reason: other.outcome === "dq" || other.outcome === "forfeit"
      ? other.outcome
      : "official\_finish",
  } as const;
}
```

Recommended bracket tables:

|Table|Important fields|
|-|-|
|brackets|event class, format, size, seeding method, status|
|heats|bracket, round number, position, next heat and lane, status, revision|
|heat lanes|heat, lane, entry, outcome, finish order, reaction time, elapsed time|
|heat decisions|heat, winner entry, reason, official, timestamp, notes|

Advancement must happen in the same transaction that finalizes the heat. Reopening an earlier heat must either be blocked after downstream racing begins or create a deliberate bracket correction workflow with an audit trail.

## 15 Teams

A team class should define the underlying member score type, minimum roster, maximum roster, number of counting scores, missing-member policy, and whether lower or higher totals win.

```ts
type MemberScore = {
  entryId: string;
  primary: number;
  eligible: boolean;
};

type TeamConfig = {
  countBest: number;
  minimumEligible: number;
  direction: Direction;
};

export function scoreTeam(members: MemberScore\[], config: TeamConfig): Score {
  const eligible = members.filter((member) => member.eligible);
  if (eligible.length < config.minimumEligible) {
    return {
      eligible: false,
      primary: null,
      direction: config.direction,
      tieBreakers: \[],
      label: "Not enough qualifying members",
      details: { eligibleMembers: eligible.length },
    };
  }
  const sorted = \[...eligible].sort((a, b) =>
    config.direction === "asc" ? a.primary - b.primary : b.primary - a.primary);
  const counted = sorted.slice(0, config.countBest);
  if (counted.length < config.countBest) {
    throw new Error("Team rules require more counting scores than are available.");
  }
  const total = counted.reduce((sum, member) => sum + member.primary, 0);
  return {
    eligible: true,
    primary: total,
    direction: config.direction,
    tieBreakers: \[],
    label: String(total),
    details: { countedEntryIds: counted.map((member) => member.entryId) },
  };
}
```

Never combine elapsed milliseconds and judged points in one team total. The class configuration must name one comparable member scoring output or a documented points conversion.

## 16 Season standings

Season standings should be derived from immutable published event revisions. The configuration should include the points table, eligible events, best-results count, participation or bonus points, tie order, and treatment of cancellations.

```ts
type Placement = { eventId: string; place: number; publishedRevision: number };
type SeriesConfig = {
  pointsByPlace: Record<number, number>;
  countBestEvents: number | null;
};

export function seasonPoints(placements: Placement\[], config: SeriesConfig) {
  const rows = placements.map((placement) => ({
    ...placement,
    points: config.pointsByPlace\[placement.place] ?? 0,
  }));
  const counted = \[...rows]
    .sort((a, b) => b.points - a.points)
    .slice(0, config.countBestEvents ?? rows.length);
  return {
    total: counted.reduce((sum, row) => sum + row.points, 0),
    counted,
    dropped: rows.filter((row) => !counted.includes(row)),
  };
}
```

The identity problem matters here. Typed names are not reliable enough to join a season automatically. Require a competitor profile, membership number, or an explicit official confirmation when two entries belong to the same person.

## 17 Scoring registry and configuration validation

Scoring configuration is data, but it must not be arbitrary data. Validate it against a schema for the selected scoring type and version before saving a class.

```ts
type ScoringType =
  | "fastest\_pass"
  | "consistency"
  | "combined\_time"
  | "head\_to\_head"
  | "judged\_points"
  | "team\_aggregate"
  | "season\_points";

type RegistryEntry = {
  currentVersion: number;
  validateConfig: (unknownConfig: unknown) => unknown;
  calculate: (input: unknown, config: unknown) => Score;
};

export const scoringRegistry: Record<ScoringType, RegistryEntry> = {
  fastest\_pass: {
    currentVersion: 1,
    validateConfig: (value) => value ?? {},
    calculate: (input) => scoreFastestPass(input as Attempt\[]),
  },
  consistency: {
    currentVersion: 1,
    validateConfig: validateConsistencyConfig,
    calculate: (input, config) => scoreConsistency(
      input as Attempt\[], config as ConsistencyConfig),
  },
  combined\_time: {
    currentVersion: 1,
    validateConfig: validateCombinedTimeConfig,
    calculate: (input, config) => scoreCombinedTime(
      input as Attempt\[], config as CombinedTimeConfig),
  },
  head\_to\_head: headToHeadRegistryEntry,
  judged\_points: judgedRegistryEntry,
  team\_aggregate: teamRegistryEntry,
  season\_points: seasonRegistryEntry,
};
```

The omitted validator functions should be implemented with the project's selected runtime schema library and tested. The server must select the scorer from stored class data; it must not accept a client request that says which calculator to run for an existing class.

## 18 Event and schedule creation

### Required behavior

Event creation and selected class-template copying must occur in one server transaction that also validates membership and entitlement usage. A failed class copy must not leave an empty event.

### Proposed request

```ts
type CreateEventRequest = {
  trackId: string;
  name: string;
  localDate: string;
  startsAt?: string | null;
  templateIds: string\[];
  requestId: string;
};

const { data, error } = await supabase.rpc("create\_event\_with\_classes", {
  p\_track\_id: request.trackId,
  p\_name: request.name.trim(),
  p\_local\_date: request.localDate,
  p\_starts\_at: request.startsAt ?? null,
  p\_template\_ids: request.templateIds,
  p\_request\_id: request.requestId,
});
if (error) throw error;
```

### Transaction responsibilities

1. Resolve the authenticated user.
2. Verify an active track membership with permission to create events.
3. Lock the organization's entitlement row.
4. Check track, staff-seat, date, and event-credit limits.
5. Make the request idempotent using `request\_id`.
6. Insert the event with a stable track-scoped slug.
7. Copy selected templates into event classes, including rules and scoring configuration snapshots.
8. Consume an event credit only after all inserts will succeed.
9. Write an audit event.
10. Commit and return the complete created event.

For a season schedule, the request can accept several dates, but create each event as a distinct idempotent unit unless the customer explicitly asks for all-or-nothing schedule creation.

## 19 Race night editor and saving

The race-night editor should provide local blank rows, immediate calculation previews, a dirty-state warning, and a Save All control. It should render a format-specific panel inside the same shell:

|Format|Editor panel|
|-|-|
|Fastest and consistency|Entry grid with attempt columns and computed score|
|Combined time|Stage columns, penalties, completion status, total|
|Judged freestyle|Entry by criterion matrix plus judge completion status|
|Side by side|Bracket and heat control with lane outcomes|
|Teams|Roster, member status, counting-score explanation, team total|

Client calculations are previews only. The server must calculate and persist the authoritative result in the transaction.

```ts
type SaveEventCommand = {
  eventId: string;
  expectedRevision: number;
  requestId: string;
  operations: Array<
    | { type: "upsert\_entry"; value: EntryInput }
    | { type: "delete\_entry"; id: string }
    | { type: "upsert\_attempt"; value: AttemptInput }
    | { type: "record\_judge\_score"; value: JudgeScoreInput }
    | { type: "finalize\_heat"; value: HeatDecisionInput }
  >;
};

const { data, error } = await supabase.rpc("apply\_event\_commands", {
  p\_event\_id: command.eventId,
  p\_expected\_revision: command.expectedRevision,
  p\_request\_id: command.requestId,
  p\_operations: command.operations,
});
if (error?.code === "EVENT\_REVISION\_CONFLICT") {
  throw new Error("Another official saved changes. Reload and review before retrying.");
}
if (error) throw error;
```

The transaction must reject cross-track IDs, validate the stored class's format configuration, apply operations, recalculate affected entries and teams, increment `working\_revision`, add an audit record, and return the authoritative changed rows. Batch size limits should be explicit, but the transaction must not partially save a logical command.

Autosave can be added later. For race-night reliability, first add a local encrypted or browser draft keyed by event and revision, a visible saved timestamp, and a manual retry path. Never publish an unsaved browser-only calculation as official.

## 20 Publication and public snapshots

Publishing should promote a saved event revision, not merely flip a boolean while rows continue changing underneath it.

```sql
-- Conceptual transaction, with authorization and validation omitted here.
insert into result\_revisions (event\_id, revision, calculation\_version, snapshot, published\_at)
select e.id, e.working\_revision, 1, build\_event\_snapshot(e.id), now()
from events e
where e.id = p\_event\_id;

update events
set published\_revision = working\_revision,
    updated\_at = now()
where id = p\_event\_id;
```

The public API reads the published snapshot. Live events can automatically republish each successful save if the owner enables **Publish saved changes live**. Otherwise, staff use a Publish Revision control after reviewing a preview.

Publication validation should require:

* Active staff permission.
* Event belongs to the selected track.
* Class configurations are valid.
* At least one publishable class result or finalized heat.
* No incomplete transaction or revision conflict.
* Judged classes meet minimum judge requirements for entries shown as final.
* Brackets do not claim advancement from unresolved heats.

## 21 Live updates

### Resilient fallback behavior

During a live event, a visible public page may use a fifteen-second fallback poll. Outside live-event mode, a sixty-second fallback is sufficient. Polling is a recovery mechanism for missed realtime messages, not the primary delivery path.

### Recommended delivery pattern

1. A save transaction increments the event revision.
2. The browser subscribes only to a small event revision signal.
3. When the published revision changes, it fetches one authoritative public snapshot.
4. A visibility-aware fallback poll protects against missed realtime messages.
5. The response carries an ETag or revision so an unchanged snapshot costs very little.

```ts
export function subscribeToPublishedEvent(
  supabase: SupabaseClient,
  eventId: string,
  onRevision: (revision: number) => void,
) {
  const channel = supabase
    .channel(`public-event:${eventId}`)
    .on(
      "postgres\_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "events",
        filter: `id=eq.${eventId}`,
      },
      (message) => {
        const revision = message.new.published\_revision;
        if (typeof revision === "number") onRevision(revision);
      },
    )
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}
```

```ts
useEffect(() => {
  let stopped = false;
  let inFlight = false;
  let knownRevision = initialRevision;

  async function refresh(revisionHint?: number) {
    if (stopped || inFlight || (revisionHint != null \&\& revisionHint <= knownRevision)) return;
    inFlight = true;
    try {
      const response = await fetch(`/api/public/events/${eventId}?after=${knownRevision}`);
      if (response.status === 304) return;
      const snapshot = await response.json();
      if (!stopped) {
        knownRevision = snapshot.revision;
        setSnapshot(snapshot);
      }
    } finally {
      inFlight = false;
    }
  }

  const unsubscribe = subscribeToPublishedEvent(supabase, eventId, refresh);
  const timer = window.setInterval(() => {
    if (document.visibilityState === "visible") void refresh();
  }, eventIsLive ? 15000 : 60000);

  return () => {
    stopped = true;
    unsubscribe();
    window.clearInterval(timer);
  };
}, \[eventId, eventIsLive, initialRevision]);
```

Realtime must respect row-level security. Only published revision signals should be visible anonymously. Draft content, judge identities if private, staff actions, billing data, and unpublished entries must never be exposed through a public channel.

## 22 Billing and entitlement code boundary

Use a small billing-provider adapter so product rules do not depend directly on one checkout SDK.

```ts
export type OfferCode = "event\_pass" | "season\_monthly" | "season\_annual" | "promoter";

export interface BillingProvider {
  createCheckout(input: {
    organizationId: string;
    userId: string;
    offer: OfferCode;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ checkoutUrl: string; providerSessionId: string }>;

  createCustomerPortal(input: {
    providerCustomerId: string;
    returnUrl: string;
  }): Promise<{ url: string }>;

  verifyWebhook(rawBody: Uint8Array, signature: string): ProviderEvent;
}
```

Webhook processing must be idempotent and transactional.

```ts
export async function handleBillingWebhook(request: Request) {
  const rawBody = new Uint8Array(await request.arrayBuffer());
  const signature = request.headers.get("provider-signature") ?? "";
  const event = billingProvider.verifyWebhook(rawBody, signature);

  await db.transaction(async (tx) => {
    const inserted = await tx.billingEvents.insertIfAbsent({
      providerEventId: event.id,
      type: event.type,
      payloadHash: sha256(rawBody),
    });
    if (!inserted) return;

    const change = mapProviderEventToEntitlement(event);
    await tx.entitlements.apply(change);
    await tx.auditEvents.recordBillingChange(change);
  });

  return new Response(null, { status: 204 });
}
```

Every protected server action should call an entitlement service such as `assertCanCreateEvent`, `assertCanInviteStaff`, or `assertCanCreateTrack`. The client may show expected limits, but only trusted server state enforces them.

## 23 Authentication, roles, and tenant security

Recommended roles:

|Role|Core permissions|
|-|-|
|Organization owner|Billing, tracks, exports, ownership transfer, and all track actions|
|Track administrator|Track settings, staff, schedules, classes, publication, and deletion|
|Official or editor|Event setup, entry, scoring, save, and possibly publish|
|Judge|Only assigned judged-class score entry|
|Read only staff|Private preview and operational viewing without changes|

The database should enforce track access with row-level security and server transactions. A selected track in the browser, an email address, or a user-editable profile field is not authorization.

```sql
create function can\_edit\_track(p\_track\_id uuid)
returns boolean
language sql
stable
security definer
set search\_path = public
as $$
  select exists (
    select 1
    from track\_memberships m
    where m.track\_id = p\_track\_id
      and m.user\_id = auth.uid()
      and m.active
      and m.role in ('owner','administrator','official')
  );
$$;

create policy event\_staff\_read
on events for select to authenticated
using (can\_edit\_track(track\_id));

create policy event\_public\_read
on events for select to anon
using (published\_revision is not null);
```

Public child access should be tied to the parent event's published revision or served from a dedicated snapshot table or endpoint. Do not grant anonymous access to working result rows and assume the user interface will hide drafts.

## 24 Public pages and exports

Recommended public routes:

|Route|Purpose|
|-|-|
|`/formats`|Format comparison for prospective customers|
|`/formats/fastest-pass`|Worked fastest-pass example|
|`/formats/consistency`|Worked consistency example|
|`/formats/combined-time`|Worked combined-time example|
|`/formats/head-to-head`|Bracket and official-winner example|
|`/formats/judged-freestyle`|Multi-judge example|
|`/pricing`|Event Pass, Season, and Promoter offers|
|`/r/\[trackSlug]`|Track's public schedule and archive|
|`/r/\[trackSlug]/events/\[eventSlug]`|Published event snapshot|
|`/app/\[trackSlug]`|Staff overview|
|`/app/\[trackSlug]/events/\[eventId]`|Setup and live control|

PDF and CSV exports must be generated from a saved revision. The PDF should show track branding, event name and date, class rules summary, format-specific columns, revision or publication time, and an Official or Draft label. For head-to-head classes, export the bracket and heat decisions. For judged classes, offer a public summary and an authorized detailed score sheet.

## 25 Implementation order

1. Build tenant identity, memberships, roles, and track-scoped row security.
2. Build entitlements and the account-before-checkout payment flow.
3. Create event, class-template, event-class, entry, and attempt migrations.
4. Implement exact fastest-pass and consistency behavior in the versioned scoring registry.
5. Add atomic event creation, transactional Save All, revision conflicts, and audit events.
6. Build public published snapshots, live revision signals, PDF, and CSV.
7. Add combined time and head-to-head because they exercise two different extensions: additional attempt aggregation and explicit outcomes.
8. Add judged freestyle with judge-specific permission and fixed-point score calculations.
9. Add team aggregation after individual scoring outputs are stable.
10. Add schedule-wide season points and confirmed competitor identity.
11. Pilot a seeded demo, then a rehearsal event, then one real track before wider sales.

This order allows the public site to advertise the complete product vision while clearly labeling formats that are in pilot or coming soon. Do not take payment for a format until its end-to-end editor, calculation, publication, correction, and export path has passed acceptance testing.

## 26 Acceptance tests

### Core launch behavior

* `9.082` and `9.019` produce best pass `9.019` and consistency `0.063`.
* A valid timed completion outranks any stopped distance.
* With distances only, the greatest distance wins.
* DQ and no-pass markers do not become numeric values.
* A result with a pass requires a display name.
* Fully blank editor rows are not stored.
* Unpublished events and working revisions are not readable anonymously.
* Published events remain correctly ordered after more than 1,000 result rows.

### New scoring cases

|Format|Input|Expected result|
|-|-|-|
|Combined time|9.412 s, 9.288 s, 0.500 s penalty|19.200 s|
|Combined time|Required second stage is DNF, unranked policy|Ineligible|
|Consistency|9.000 s and 9.000 s|0.000 s|
|Judged|Five complete judges, drop high and low|Average of middle three minus penalties|
|Judged|Fewer than configured minimum judges|Waiting or provisional, not final|
|Side by side|Slower elapsed lane marked official winner|Marked lane advances|
|Side by side|Opponent forfeits|Remaining entry advances with forfeit reason|
|Team|Best three of four valid member times|Sum only the lowest three|
|Team|Fewer than minimum eligible members|Ineligible|
|Season|Best five of seven published events|Two lowest point events are dropped|

### Security and billing cases

* A user from Track A cannot read or modify Track B drafts by changing a URL or UUID.
* A judge cannot edit another judge's score or event billing.
* A browser checkout success redirect does not activate an entitlement without a verified webhook.
* Replaying the same webhook does not duplicate an event credit or subscription.
* Two concurrent saves with the same expected revision produce one success and one conflict.
* Event Pass creation consumes exactly one credit, including after request retries.
* A failed event-and-class transaction consumes no credit and leaves no empty event.
* An expired entitlement blocks new writes according to policy without exposing or deleting data unexpectedly.
* Public realtime subscriptions cannot receive draft revisions or staff-only fields.

### Race-night reliability cases

* A network interruption during save leaves either the whole command committed or none of it.
* Reconnecting refetches the authoritative revision and does not duplicate entries.
* A missed realtime message is recovered by the fallback poll.
* Reopening a completed heat follows the defined correction workflow.
* Published PDFs and CSV files state the revision they represent.
* Phone, tablet, laptop, and desktop entry paths are usable under realistic race-night lighting and network conditions.

## 27 Decisions to make before coding begins

* Public domain and brand assets.
* Exact offers, prices, event quotas, staff-seat limits, taxes, and refunds.
* Archive retention for an Event Pass and after a subscription ends.
* Whether saved changes auto-publish during a live event or require a publish action.
* Which roles can publish, delete, reopen a heat, or correct judge scores.
* Exact combined-time missing-run and penalty rules.
* Exact judged criteria, weight rules, high-low drops, and tie handling.
* Bracket formats required at launch and how lane choice and reseeding work.
* Team roster, substitution, and counting-score rules.
* Season point tables, drops, tie order, and competitor identity requirements.
* Whether custom domains, timing-system import, kiosks, or offline entry are launch requirements.
* Support hours and operational expectations on race nights.

These choices belong in settings or versioned configurations wherever different tracks may choose differently.

## 28 Handoff statement

TrackScore must deliver deterministic fastest-pass and consistency calculations, a reliable race-night editing workflow, an explicit publication boundary, a public archive, and revision-specific exports. Its foundation must be tenant-safe, entitlement-aware, and built around versioned scoring. The central architectural rule is simple: each class declares a scoring type and immutable configuration, every official input is stored as source data, the server calculates an explainable result, and spectators read a published revision.

That foundation supports one-time events today, full seasons next, and additional racing styles without rewriting the product for every new customer.

