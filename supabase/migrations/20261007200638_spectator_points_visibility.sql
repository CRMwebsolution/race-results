-- Preserve current public displays until an organizer chooses another mode.
alter table public.series add column spectator_points_mode text not null default 'race_and_total'
  check (spectator_points_mode in ('none','race','race_and_total'));
alter table public.tracks add column spectator_points_mode text not null default 'race_and_total'
  check (spectator_points_mode in ('none','race','race_and_total'));

-- Public standings snapshots contain season totals, so restrict direct API reads too.
create or replace function public.spectator_points_for_season(p_season_id uuid)
returns text language sql stable security invoker set search_path='' as $$
  select coalesce(s.spectator_points_mode,t.spectator_points_mode,'none')
  from public.competition_seasons c
  left join public.series s on s.id=c.series_id
  left join public.tracks t on t.id=c.track_id
  where c.id=p_season_id;
$$;
revoke all on function public.spectator_points_for_season(uuid) from public;
grant execute on function public.spectator_points_for_season(uuid) to anon,authenticated;
alter policy competition_versions_read on public.competition_result_versions using (
  case when auth.uid() is not null then public.can_manage_competition(season_id) else false end
  or public.spectator_points_for_season(season_id)='race_and_total'
);
alter policy competition_changes_read on public.competition_points_changes using (
  case when auth.uid() is not null then public.can_manage_competition(season_id) else false end
  or public.spectator_points_for_season(season_id)='race_and_total'
  or (event_id is not null and public.spectator_points_for_season(season_id)='race')
);
alter policy competition_read on public.competition_points_rules using (
  case when auth.uid() is not null then public.can_manage_competition(season_id) else false end
  or public.spectator_points_for_season(season_id) in ('race','race_and_total')
);
alter policy bonuses_read on public.competition_bonuses using (
  case when auth.uid() is not null then public.can_manage_competition(season_id) else false end
  or public.spectator_points_for_season(season_id) in ('race','race_and_total')
);
alter policy series_versions_read on public.series_result_versions using (
  exists(select 1 from public.series s where s.id=series_id and
    (s.spectator_points_mode='race_and_total'
      or case when auth.uid() is not null then public.is_org_admin(s.organization_id) else false end))
);
