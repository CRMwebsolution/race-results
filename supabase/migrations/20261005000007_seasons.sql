-- Migration: Seasons and Points

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.tracks(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

create table public.season_events (
  season_id uuid not null references public.seasons(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  primary key (season_id, event_id)
);

create table public.season_points_allocations (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  rank integer not null,
  points integer not null
);

-- RLS
alter table public.seasons enable row level security;
alter table public.season_events enable row level security;
alter table public.season_points_allocations enable row level security;

-- Policies
create policy seasons_view on public.seasons for select to authenticated using (
  public.can_view_track(track_id) or public.is_platform_admin()
);
create policy seasons_edit on public.seasons for all to authenticated using (
  public.can_edit_track(track_id) or public.is_platform_admin()
);

create policy season_events_view on public.season_events for select to authenticated using (
  exists (select 1 from public.seasons where id = season_id and (public.can_view_track(track_id) or public.is_platform_admin()))
);
create policy season_events_edit on public.season_events for all to authenticated using (
  exists (select 1 from public.seasons where id = season_id and (public.can_edit_track(track_id) or public.is_platform_admin()))
);

create policy season_points_view on public.season_points_allocations for select to authenticated using (
  exists (select 1 from public.seasons where id = season_id and (public.can_view_track(track_id) or public.is_platform_admin()))
);
create policy season_points_edit on public.season_points_allocations for all to authenticated using (
  exists (select 1 from public.seasons where id = season_id and (public.can_edit_track(track_id) or public.is_platform_admin()))
);
