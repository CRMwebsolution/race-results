-- Migration: Cascade deletions for tracks, series, and events
-- Resolves foreign key errors and trigger locks when permanently deleting a track or race.

-- 1. Obsolete composite foreign key on event_classes
alter table public.event_classes drop constraint if exists event_classes_track_id_event_id_fkey;

-- 2. Foreign keys on event_result_versions
alter table public.event_result_versions drop constraint if exists event_result_versions_track_id_fkey;
alter table public.event_result_versions add constraint event_result_versions_track_id_fkey
  foreign key (track_id) references public.tracks(id) on delete cascade;

alter table public.event_result_versions drop constraint if exists event_result_versions_event_id_fkey;
alter table public.event_result_versions add constraint event_result_versions_event_id_fkey
  foreign key (event_id) references public.events(id) on delete cascade;

-- 3. Foreign keys on competition_seasons
alter table public.competition_seasons drop constraint if exists competition_seasons_track_id_fkey;
alter table public.competition_seasons add constraint competition_seasons_track_id_fkey
  foreign key (track_id) references public.tracks(id) on delete cascade;

alter table public.competition_seasons drop constraint if exists competition_seasons_series_id_fkey;
alter table public.competition_seasons add constraint competition_seasons_series_id_fkey
  foreign key (series_id) references public.series(id) on delete cascade;

-- 4. Foreign keys on competition_classes
alter table public.competition_classes drop constraint if exists competition_classes_season_id_fkey;
alter table public.competition_classes add constraint competition_classes_season_id_fkey
  foreign key (season_id) references public.competition_seasons(id) on delete cascade;

-- 5. Foreign keys on competition_registrations and competition_bonuses
alter table public.competition_registrations drop constraint if exists competition_registrations_season_id_fkey;
alter table public.competition_registrations add constraint competition_registrations_season_id_fkey
  foreign key (season_id) references public.competition_seasons(id) on delete cascade;

alter table public.competition_bonuses drop constraint if exists competition_bonuses_season_id_fkey;
alter table public.competition_bonuses add constraint competition_bonuses_season_id_fkey
  foreign key (season_id) references public.competition_seasons(id) on delete cascade;

-- 6. Foreign keys on competition_points_changes
alter table public.competition_points_changes drop constraint if exists competition_points_changes_event_id_fkey;
alter table public.competition_points_changes add constraint competition_points_changes_event_id_fkey
  foreign key (event_id) references public.events(id) on delete cascade;

-- 7. Foreign keys on series_manual_awards and series_result_versions
alter table public.series_manual_awards drop constraint if exists series_manual_awards_event_id_fkey;
alter table public.series_manual_awards add constraint series_manual_awards_event_id_fkey
  foreign key (event_id) references public.events(id) on delete cascade;

alter table public.series_manual_awards drop constraint if exists series_manual_awards_series_id_fkey;
alter table public.series_manual_awards add constraint series_manual_awards_series_id_fkey
  foreign key (series_id) references public.series(id) on delete cascade;

alter table public.series_result_versions drop constraint if exists series_result_versions_series_id_fkey;
alter table public.series_result_versions add constraint series_result_versions_series_id_fkey
  foreign key (series_id) references public.series(id) on delete cascade;

-- 8. Foreign key on events referencing series
alter table public.events drop constraint if exists events_series_id_fkey;
alter table public.events add constraint events_series_id_fkey
  foreign key (series_id) references public.series(id) on delete cascade;

-- 9. Trigger helper to signal parent deletion
create or replace function public.set_deleting_parent()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('raceholler.deleting_parent', 'true', true);
  return old;
end;
$$;

drop trigger if exists set_deleting_track on public.tracks;
create trigger set_deleting_track
  before delete on public.tracks
  for each row execute function public.set_deleting_parent();

drop trigger if exists set_deleting_series on public.series;
create trigger set_deleting_series
  before delete on public.series
  for each row execute function public.set_deleting_parent();

drop trigger if exists set_deleting_event on public.events;
create trigger set_deleting_event
  before delete on public.events
  for each row execute function public.set_deleting_parent();

-- 10. Update guard_race_data_change to bypass lock when deleting parent event/track
create or replace function public.guard_race_data_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_event_id uuid; v_track_id uuid; v_status text;
begin
  -- If parent track, series, or event is being deleted, allow clean cascade deletion
  if tg_op = 'DELETE' and current_setting('raceholler.deleting_parent', true) = 'true' then
    return old;
  end if;

  if tg_table_name='event_classes' then
    v_event_id := case when tg_op='DELETE' then old.event_id else new.event_id end;
    if tg_op='UPDATE' and new.event_id<>old.event_id then raise exception 'Cannot move a class to another event'; end if;
  else
    select event_id into v_event_id from public.event_classes
      where id=case when tg_op='DELETE' then old.event_class_id else new.event_class_id end;
    if tg_op='UPDATE' and new.event_class_id<>old.event_class_id then raise exception 'Cannot move race data between classes'; end if;
  end if;
  select track_id,status into v_track_id,v_status from public.events where id=v_event_id for update;
  -- Cascades from a deleted event/class have no surviving parent to revise.
  if found then
    if current_setting('role',true) in ('authenticated','anon') and
       (auth.uid() is null or not public.can_edit_race(v_event_id)) then
      raise exception 'Not authorized to score this event' using errcode='42501';
    end if;
    if v_status='completed' then raise exception 'Completed results are locked; an owner must reopen the event' using errcode='55000'; end if;
  end if;
  if tg_table_name='attempts' and tg_op<>'DELETE' then
    new.save_version := case when tg_op='INSERT' then 1 else old.save_version+1 end;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$function$;

-- 11. Update delete_or_withdraw_event to hard delete when confirmed
create or replace function public.delete_or_withdraw_event(p_event_id uuid, p_confirm boolean)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare e public.events;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or auth.uid() is null or not public.can_publish_race(e.id)
 then raise exception 'Only an owner can delete or withdraw an event' using errcode='42501'; end if;
 if not p_confirm then raise exception 'Confirmation required'; end if;

 -- Signal deletion so cascading triggers allow clean removal
 perform set_config('raceholler.deleting_parent', 'true', true);

 delete from public.events where id=e.id;
 return 'deleted';
end $function$;
