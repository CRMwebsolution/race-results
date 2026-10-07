-- Independent judging uses series organization membership, never hosting-track staff.
create or replace function public.can_judge_race(p_event_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.events e where e.id=p_event_id and (
 (e.track_id is not null and public.can_edit_track(e.track_id)) or
 (e.series_id is not null and exists(select 1 from public.series s where s.id=e.series_id and public.is_org_member(s.organization_id)))));
$$;
revoke all on function public.can_judge_race(uuid) from public,anon;grant execute on function public.can_judge_race(uuid) to authenticated;
do $$declare s text;begin select pg_get_functiondef('public.save_judge_score(uuid,uuid,integer,jsonb,integer)'::regprocedure) into s;execute replace(s,'public.can_edit_race(e.id)','public.can_judge_race(e.id)');end $$;

create unique index competition_bonus_condition_key on public.competition_bonuses(season_id,bonus_type,frequency,coalesce(series_class_id,'00000000-0000-0000-0000-000000000000'::uuid));
create or replace function public.guard_competition_bonus() returns trigger language plpgsql set search_path='' as $$
begin if new.series_class_id is not null and not exists(select 1 from public.competition_classes where id=new.series_class_id and season_id=new.season_id) then raise exception 'Bonus class belongs to another season';end if;return new;end $$;
create trigger guard_competition_bonus before insert or update on public.competition_bonuses for each row execute function public.guard_competition_bonus();
revoke all on function public.guard_competition_bonus() from public,anon,authenticated;
-- New seasons inherit default bonus rules but never previous members or awards.
do $$declare s text;begin select pg_get_functiondef('public.create_competition_season(uuid,uuid,text,date,date)'::regprocedure) into s;
 s:=replace(s,'end if;return v;', 'end if; if p_series_id is not null then insert into public.competition_bonuses(season_id,bonus_type,points,frequency,series_class_id) select v,b.bonus_type,b.points,b.frequency,c.id from public.series_bonuses b left join public.competition_classes c on c.season_id=v and c.series_class_id=b.series_class_id where b.series_id=p_series_id and b.bonus_type in (''fastest_pass'',''consistent_pass'',''perfect_attendance'');end if;return v;');execute s;end $$;
-- Points changes also preserve an otherwise empty event as a withdrawn race.
do $$declare s text;begin select pg_get_functiondef('public.delete_or_withdraw_event(uuid,boolean)'::regprocedure) into s;s:=replace(s,'or exists(select 1 from public.series_manual_awards where event_id=e.id)','or exists(select 1 from public.series_manual_awards where event_id=e.id) or exists(select 1 from public.competition_points_changes where event_id=e.id)');execute s;end $$;
notify pgrst,'reload schema';
