-- Track in-house championships remain tracks. Preserve bookmarked season IDs and rules.
alter table public.competition_seasons add column legacy_track_season_id uuid references public.seasons(id);
do $$declare old_season record;c record;cc uuid;begin
 for old_season in select * from public.seasons loop
 insert into public.competition_seasons(id,track_id,name,starts_on,ends_on,legacy_track_season_id)
 values(old_season.id,old_season.track_id,old_season.name,coalesce(old_season.start_date,(select min(e.local_date) from public.season_events se join public.events e on e.id=se.event_id where se.season_id=old_season.id),current_date),old_season.end_date,old_season.id);
 insert into public.competition_points_rules(season_id,rank_start,rank_end,points) select old_season.id,rank,rank,points from public.season_points_allocations where season_id=old_season.id;
 alter table public.events disable trigger guard_completed_metadata;
 update public.events e set competition_season_id=old_season.id from public.season_events se where se.season_id=old_season.id and se.event_id=e.id and e.track_id=old_season.track_id and e.series_id is null and e.competition_season_id is null;
 alter table public.events enable trigger guard_completed_metadata;
 -- Use explicit template identity when available. Otherwise leave later class mapping to the organizer.
 insert into public.competition_classes(season_id,name,template_id) select old_season.id,name,id from public.class_templates where track_id=old_season.track_id and active;
 for c in select ec.* from public.event_classes ec where ec.event_id=(select e.id from public.events e where e.competition_season_id=old_season.id order by e.local_date,e.id limit 1) loop
  select id into cc from public.competition_classes where season_id=old_season.id and template_id=c.template_id;
  if cc is null then insert into public.competition_classes(season_id,name,template_id) values(old_season.id,c.name,c.template_id) returning id into cc;end if;
  alter table public.event_classes disable trigger guard_race_data_change;
  update public.event_classes set competition_class_id=cc where id=c.id;
  alter table public.event_classes enable trigger guard_race_data_change;
 end loop;
 -- Existing entrants are not automatically championship members.
 end loop;end $$;

create or replace function public.guard_championship_class_owner() returns trigger language plpgsql set search_path='' as $$
declare s public.competition_seasons;begin select * into s from public.competition_seasons where id=new.season_id;
 if new.series_class_id is not null and (s.series_id is null or not exists(select 1 from public.series_classes where id=new.series_class_id and series_id=s.series_id)) then raise exception 'Default class belongs to another owner';end if;
 if new.template_id is not null and (s.track_id is null or not exists(select 1 from public.class_templates where id=new.template_id and track_id=s.track_id)) then raise exception 'Track class belongs to another owner';end if;
 if tg_op='UPDATE' and new.season_id is distinct from old.season_id then raise exception 'Class cannot change season';end if;return new;end $$;
create trigger guard_championship_class_owner before insert or update on public.competition_classes for each row execute function public.guard_championship_class_owner();
revoke all on function public.guard_championship_class_owner() from public,anon,authenticated;

-- Legacy track competitor pointers are not membership in a traveling series.
alter table public.entries disable trigger guard_race_data_change;
update public.entries en set competitor_id=null from public.event_classes c join public.events e on e.id=c.event_id where en.event_class_id=c.id and e.series_id is not null and en.competitor_id is not null;
alter table public.entries enable trigger guard_race_data_change;
update public.series_rosters set competitor_id=null where competitor_id is not null;
alter table public.series_rosters add constraint series_rosters_no_track_identity check(competitor_id is null);
create or replace function public.guard_entry_track_identity() returns trigger language plpgsql set search_path='' as $$
begin if new.competitor_id is not null and exists(select 1 from public.event_classes c join public.events e on e.id=c.event_id where c.id=new.event_class_id and e.series_id is not null) then raise exception 'Series entries cannot link to track competitors';end if;return new;end $$;
create trigger guard_entry_track_identity before insert or update on public.entries for each row execute function public.guard_entry_track_identity();
revoke all on function public.guard_entry_track_identity() from public,anon,authenticated;
update public.event_result_versions v set track_id=null from public.events e where e.id=v.event_id and e.series_id is not null;

-- Carry existing explained manual awards only when their original identity mapping is unambiguous.
insert into public.competition_points_changes(id,season_id,registration_id,event_id,mode,points,reason,actor_id,created_at)
 select a.id,cs.id,min(r.id::text)::uuid,a.event_id,'adjustment',a.points,a.reason,a.actor_id,a.created_at
 from public.series_manual_awards a join public.competition_seasons cs on cs.series_id=a.series_id
 join public.competition_classes c on c.season_id=cs.id and c.series_class_id=a.series_class_id
 join public.competition_registrations r on r.class_id=c.id
 join public.series_rosters legacy on legacy.id=r.legacy_roster_id and legacy.series_racer_id=a.series_racer_id
 group by a.id,cs.id having count(distinct r.id)=1;
notify pgrst,'reload schema';
