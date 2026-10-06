-- Migration: Phase Two Racing Core

-- 1. Create scoring type enum
create type public.scoring_type as enum (
  'fastest_pass',
  'consistency',
  'combined_time',
  'head_to_head',
  'judged_points',
  'team_aggregate',
  'season_points'
);

-- 2. Create Events table
create table public.events (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.tracks(id) on delete cascade,
  slug text not null,
  name text not null,
  local_date date not null,
  starts_at timestamptz,
  status text not null check (status in ('draft','scheduled','live','completed','cancelled')),
  working_revision bigint not null default 0,
  published_revision bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_track_slug_key unique (track_id, slug),
  constraint events_track_id_key unique (track_id, id)
);

-- 3. Create Class Templates table (reusable class settings)
create table public.class_templates (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.tracks(id) on delete cascade,
  name text not null,
  rules_text text,
  entry_fee_text text,
  scoring_type public.scoring_type not null,
  scoring_config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  order_num integer not null check (order_num > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Create Event Classes table (snapshot of class for an event)
create table public.event_classes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  track_id uuid not null,
  template_id uuid references public.class_templates(id) on delete set null,
  name text not null,
  rules_text text,
  entry_fee_text text,
  scoring_type public.scoring_type not null,
  scoring_version integer not null default 1,
  scoring_config jsonb not null default '{}'::jsonb,
  order_num integer not null check (order_num > 0),
  constraint event_classes_event_order_key unique (event_id, order_num),
  constraint event_classes_event_id_key unique (event_id, id),
  foreign key (track_id, event_id) references public.events(track_id, id)
);

-- 5. Create Competitors table (optional reusable profiles per track)
create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.tracks(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Create Entries table (racers enrolled in a specific class)
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  event_class_id uuid not null references public.event_classes(id) on delete cascade,
  display_name text not null,
  competitor_id uuid references public.competitors(id) on delete set null,
  team_id uuid, -- For later team support
  seed integer,
  status text not null default 'active',
  order_num integer not null,
  constraint entries_class_order_key unique (event_class_id, order_num),
  constraint entries_class_id_key unique (event_class_id, id)
);

-- 7. Create Attempts table (individual passes/runs)
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  event_class_id uuid not null,
  entry_id uuid not null,
  ordinal integer not null check (ordinal > 0),
  status text not null check (status in ('valid','dq','dnf','dns','no_time')),
  elapsed_ms integer check (elapsed_ms is null or elapsed_ms > 0),
  distance_mm integer check (distance_mm is null or distance_mm >= 0),
  penalty_ms integer not null default 0 check (penalty_ms >= 0),
  raw_input text,
  constraint attempts_entry_ordinal_key unique (entry_id, ordinal),
  foreign key (event_class_id, entry_id) references public.entries(event_class_id, id) on delete cascade,
  check (
    (status = 'valid' and num_nonnulls(elapsed_ms, distance_mm) = 1)
    or (status <> 'valid' and elapsed_ms is null and distance_mm is null)
  )
);

-- 8. Setup RLS
alter table public.events enable row level security;
alter table public.class_templates enable row level security;
alter table public.event_classes enable row level security;
alter table public.competitors enable row level security;
alter table public.entries enable row level security;
alter table public.attempts enable row level security;

-- Public can see published events and tracks.
-- Add an additional policy so public routing works for spectator urls:
create policy track_select_public on public.tracks
  for select
  using (
    exists (
      select 1 from public.events e 
      where e.track_id = id and e.status in ('live', 'completed') and coalesce(e.published_revision, 0) > 0
    )
  );

-- Events policies
create policy events_select on public.events
  for select
  using (
    public.can_view_track(track_id)
    or (status in ('live', 'completed') and coalesce(published_revision, 0) > 0)
  );

create policy events_insert on public.events
  for insert to authenticated
  with check (public.can_edit_track(track_id));

create policy events_update on public.events
  for update to authenticated
  using (public.can_edit_track(track_id))
  with check (public.can_edit_track(track_id));

create policy events_delete on public.events
  for delete to authenticated
  using (public.can_edit_track(track_id));

-- Class Templates policies
create policy class_templates_select on public.class_templates
  for select to authenticated
  using (public.can_view_track(track_id));

create policy class_templates_insert on public.class_templates
  for insert to authenticated
  with check (public.can_edit_track(track_id));

create policy class_templates_update on public.class_templates
  for update to authenticated
  using (public.can_edit_track(track_id))
  with check (public.can_edit_track(track_id));

create policy class_templates_delete on public.class_templates
  for delete to authenticated
  using (public.can_edit_track(track_id));

-- Event Classes policies (readable by public if event is published)
create policy event_classes_select on public.event_classes
  for select
  using (
    public.can_view_track(track_id)
    or exists (
      select 1 from public.events e 
      where e.id = event_id and e.status in ('live', 'completed') and coalesce(e.published_revision, 0) > 0
    )
  );

create policy event_classes_insert on public.event_classes
  for insert to authenticated
  with check (public.can_edit_track(track_id));

create policy event_classes_update on public.event_classes
  for update to authenticated
  using (public.can_edit_track(track_id))
  with check (public.can_edit_track(track_id));

create policy event_classes_delete on public.event_classes
  for delete to authenticated
  using (public.can_edit_track(track_id));

-- Competitors policies
create policy competitors_select on public.competitors
  for select to authenticated
  using (public.can_view_track(track_id));

create policy competitors_insert on public.competitors
  for insert to authenticated
  with check (public.can_edit_track(track_id));

create policy competitors_update on public.competitors
  for update to authenticated
  using (public.can_edit_track(track_id))
  with check (public.can_edit_track(track_id));

create policy competitors_delete on public.competitors
  for delete to authenticated
  using (public.can_edit_track(track_id));

-- Entries policies
create policy entries_select on public.entries
  for select
  using (
    exists (
      select 1 from public.event_classes ec
      where ec.id = event_class_id and (
        public.can_view_track(ec.track_id)
        or exists (
          select 1 from public.events e 
          where e.id = ec.event_id and e.status in ('live', 'completed') and coalesce(e.published_revision, 0) > 0
        )
      )
    )
  );

create policy entries_insert on public.entries
  for insert to authenticated
  with check (
    exists (select 1 from public.event_classes ec where ec.id = event_class_id and public.can_edit_track(ec.track_id))
  );

create policy entries_update on public.entries
  for update to authenticated
  using (
    exists (select 1 from public.event_classes ec where ec.id = event_class_id and public.can_edit_track(ec.track_id))
  )
  with check (
    exists (select 1 from public.event_classes ec where ec.id = event_class_id and public.can_edit_track(ec.track_id))
  );

create policy entries_delete on public.entries
  for delete to authenticated
  using (
    exists (select 1 from public.event_classes ec where ec.id = event_class_id and public.can_edit_track(ec.track_id))
  );

-- Attempts policies
create policy attempts_select on public.attempts
  for select
  using (
    exists (
      select 1 from public.event_classes ec
      where ec.id = event_class_id and (
        public.can_view_track(ec.track_id)
        or exists (
          select 1 from public.events e 
          where e.id = ec.event_id and e.status in ('live', 'completed') and coalesce(e.published_revision, 0) > 0
        )
      )
    )
  );

create policy attempts_insert on public.attempts
  for insert to authenticated
  with check (
    exists (select 1 from public.event_classes ec where ec.id = event_class_id and public.can_edit_track(ec.track_id))
  );

create policy attempts_update on public.attempts
  for update to authenticated
  using (
    exists (select 1 from public.event_classes ec where ec.id = event_class_id and public.can_edit_track(ec.track_id))
  )
  with check (
    exists (select 1 from public.event_classes ec where ec.id = event_class_id and public.can_edit_track(ec.track_id))
  );

create policy attempts_delete on public.attempts
  for delete to authenticated
  using (
    exists (select 1 from public.event_classes ec where ec.id = event_class_id and public.can_edit_track(ec.track_id))
  );

-- Function to update timestamp on events
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_events_updated_at
  before update on public.events
  for each row
  execute function public.set_updated_at();

create trigger set_class_templates_updated_at
  before update on public.class_templates
  for each row
  execute function public.set_updated_at();

create trigger set_competitors_updated_at
  before update on public.competitors
  for each row
  execute function public.set_updated_at();
