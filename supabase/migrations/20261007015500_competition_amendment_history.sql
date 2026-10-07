-- The server records the current calculated amount with every explained amendment.
drop function public.record_competition_points(uuid,uuid,uuid,text,integer,text,bigint);
create or replace function public.record_competition_points(p_season_id uuid,p_registration_id uuid,p_event_id uuid,p_mode text,p_points integer,p_reason text,p_expected_revision bigint,p_previous_points integer default null) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.competition_seasons;v uuid;previous integer;begin
 select * into s from public.competition_seasons where id=p_season_id for update;
 if not found or not public.can_manage_competition(s.id) then raise exception 'Not authorized' using errcode='42501';end if;
 if s.rules_revision is distinct from p_expected_revision then raise exception 'Points changed; reload before editing' using errcode='PT409';end if;
 if not exists(select 1 from public.competition_registrations where id=p_registration_id and season_id=s.id) or (p_event_id is not null and not exists(select 1 from public.events where id=p_event_id and competition_season_id=s.id)) then raise exception 'Points scope does not match this season';end if;
 if nullif(trim(p_reason),'') is null then raise exception 'Explain the points change';end if;
 previous:=p_previous_points;
 insert into public.competition_points_changes(season_id,registration_id,event_id,mode,points,previous_points,reason,actor_id) values(s.id,p_registration_id,p_event_id,p_mode,p_points,previous,trim(p_reason),auth.uid()) returning id into v;return v;end $$;
revoke all on function public.record_competition_points(uuid,uuid,uuid,text,integer,text,bigint,integer) from public,anon;grant execute on function public.record_competition_points(uuid,uuid,uuid,text,integer,text,bigint,integer) to authenticated;

-- Removing a scheduled race, or moving it, invalidates both affected seasons.
create or replace function public.invalidate_competition() returns trigger language plpgsql security definer set search_path='' as $$
declare v uuid;prior uuid;begin
 if tg_table_name='events' then
  v:=case when tg_op='DELETE' then old.competition_season_id else new.competition_season_id end;
  if tg_op='UPDATE' then prior:=old.competition_season_id;end if;
 elsif tg_table_name='entries' then
  select competition_season_id into v from public.events where id=(select event_id from public.event_classes where id=case when tg_op='DELETE' then old.event_class_id else new.event_class_id end);
 elsif tg_table_name='event_classes' then
  select competition_season_id into v from public.events where id=case when tg_op='DELETE' then old.event_id else new.event_id end;
 else v:=case when tg_op='DELETE' then old.season_id else new.season_id end;end if;
 update public.competition_seasons set rules_revision=rules_revision+1 where id=v or id=prior;
 update public.competition_result_versions set is_current=false where (season_id=v or season_id=prior) and is_current;
 return null;end $$;
-- A season change must not leave race classes mapped into the previous season.
create or replace function public.guard_race_season_mapping() returns trigger language plpgsql set search_path='' as $$
begin if new.competition_season_id is distinct from old.competition_season_id and exists(select 1 from public.event_classes c join public.competition_classes cc on cc.id=c.competition_class_id where c.event_id=new.id and cc.season_id is distinct from new.competition_season_id) then raise exception 'Clear championship class mappings before changing the season';end if;return new;end $$;
create trigger guard_race_season_mapping before update on public.events for each row execute function public.guard_race_season_mapping();
revoke all on function public.guard_race_season_mapping() from public,anon,authenticated;
grant delete on public.competition_points_rules to authenticated;
notify pgrst,'reload schema';
