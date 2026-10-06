-- Migration: Drop old Seasons and replace with Series Architecture

-- 1. Tear down old seasons
drop table if exists public.season_points_allocations;
drop table if exists public.season_events;
drop table if exists public.seasons;

-- 2. Create Top-Level Series
create table public.series (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Create Series Classes
create table public.series_classes (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series(id) on delete cascade,
  name text not null,
  scoring_type public.scoring_type not null default 'fastest_pass',
  scoring_config jsonb,
  rules_text text,
  entry_fee_text text,
  order_num integer not null default 0
);

-- 4. Add series_id to events
alter table public.events 
add column series_id uuid references public.series(id) on delete set null;

-- 5. Create Series Points Rules (Rank Bands)
create table public.series_points_rules (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series(id) on delete cascade,
  rank_start integer not null,
  rank_end integer not null,
  points integer not null,
  constraint check_rank_order check (rank_start <= rank_end)
);

-- 6. Create Series Bonuses
create table public.series_bonuses (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series(id) on delete cascade,
  bonus_type text not null, -- e.g., 'perfect_attendance', 'consistent_pass'
  points integer not null
);

-- 7. Create Series Rosters
create table public.series_rosters (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series(id) on delete cascade,
  series_class_id uuid not null references public.series_classes(id) on delete cascade,
  competitor_id uuid references public.competitors(id) on delete set null,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.series enable row level security;
alter table public.series_classes enable row level security;
alter table public.series_points_rules enable row level security;
alter table public.series_bonuses enable row level security;
alter table public.series_rosters enable row level security;

-- Setup RLS Policies (Organization Level)
create policy series_view on public.series for select to authenticated using (
  public.is_org_member(organization_id) or public.is_platform_admin()
);
create policy series_edit on public.series for all to authenticated using (
  public.is_org_admin(organization_id) or public.is_platform_admin()
);

create policy series_classes_view on public.series_classes for select to authenticated using (
  exists (select 1 from public.series where id = series_id and (public.is_org_member(organization_id) or public.is_platform_admin()))
);
create policy series_classes_edit on public.series_classes for all to authenticated using (
  exists (select 1 from public.series where id = series_id and (public.is_org_admin(organization_id) or public.is_platform_admin()))
);

create policy series_points_rules_view on public.series_points_rules for select to authenticated using (
  exists (select 1 from public.series where id = series_id and (public.is_org_member(organization_id) or public.is_platform_admin()))
);
create policy series_points_rules_edit on public.series_points_rules for all to authenticated using (
  exists (select 1 from public.series where id = series_id and (public.is_org_admin(organization_id) or public.is_platform_admin()))
);

create policy series_bonuses_view on public.series_bonuses for select to authenticated using (
  exists (select 1 from public.series where id = series_id and (public.is_org_member(organization_id) or public.is_platform_admin()))
);
create policy series_bonuses_edit on public.series_bonuses for all to authenticated using (
  exists (select 1 from public.series where id = series_id and (public.is_org_admin(organization_id) or public.is_platform_admin()))
);

create policy series_rosters_view on public.series_rosters for select to authenticated using (
  exists (select 1 from public.series where id = series_id and (public.is_org_member(organization_id) or public.is_platform_admin()))
);
create policy series_rosters_edit on public.series_rosters for all to authenticated using (
  exists (select 1 from public.series where id = series_id and (public.is_org_admin(organization_id) or public.is_platform_admin()))
);
