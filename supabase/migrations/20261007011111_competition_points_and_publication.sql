create table public.competition_bonuses(id uuid primary key default gen_random_uuid(),season_id uuid not null references public.competition_seasons(id),bonus_type text not null check(bonus_type in ('fastest_pass','consistent_pass','perfect_attendance')),points integer not null check(points>=0),frequency text not null check(frequency in ('per_event','per_class')),series_class_id uuid references public.competition_classes(id));
alter table public.competition_bonuses enable row level security;
create policy bonuses_read on public.competition_bonuses for select to anon,authenticated using(true);
create policy bonuses_manage on public.competition_bonuses for all to authenticated using(public.can_manage_competition(season_id)) with check(public.can_manage_competition(season_id));
grant select on public.competition_bonuses to anon,authenticated;grant insert,update,delete on public.competition_bonuses to authenticated;
create trigger invalidate_competition after insert or update or delete on public.competition_bonuses for each row execute function public.invalidate_competition();
insert into public.competition_bonuses(season_id,bonus_type,points,frequency,series_class_id)
 select cs.id,b.bonus_type,b.points,b.frequency,c.id from public.competition_seasons cs join public.series_bonuses b on b.series_id=cs.series_id left join public.competition_classes c on c.season_id=cs.id and c.series_class_id=b.series_class_id where b.bonus_type in ('fastest_pass','consistent_pass','perfect_attendance');

create or replace function public.record_competition_points(p_season_id uuid,p_registration_id uuid,p_event_id uuid,p_mode text,p_points integer,p_reason text,p_expected_revision bigint) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.competition_seasons;v uuid;previous integer;begin
 select * into s from public.competition_seasons where id=p_season_id for update;
 if not found or not public.can_manage_competition(s.id) then raise exception 'Not authorized' using errcode='42501';end if;
 if s.rules_revision is distinct from p_expected_revision then raise exception 'Points changed; reload before editing' using errcode='PT409';end if;
 if not exists(select 1 from public.competition_registrations where id=p_registration_id and season_id=s.id) or (p_event_id is not null and not exists(select 1 from public.events where id=p_event_id and competition_season_id=s.id)) then raise exception 'Points scope does not match this season';end if;
 if nullif(trim(p_reason),'') is null then raise exception 'Explain the points change';end if;
 select (b->>'total')::integer into previous from public.competition_result_versions v cross join lateral jsonb_array_elements(v.payload->'standings') r cross join lateral jsonb_array_elements(r->'breakdown') b where v.season_id=s.id and v.is_current and r->>'racerId'=p_registration_id::text and b->>'eventId'=coalesce(p_event_id::text,'season') limit 1;
 if previous is null then select points into previous from public.competition_points_changes where season_id=s.id and registration_id=p_registration_id and event_id is not distinct from p_event_id and mode='override' order by created_at desc,id desc limit 1;end if;
 insert into public.competition_points_changes(season_id,registration_id,event_id,mode,points,previous_points,reason,actor_id) values(s.id,p_registration_id,p_event_id,p_mode,p_points,previous,trim(p_reason),auth.uid()) returning id into v;return v;end $$;
revoke all on function public.record_competition_points(uuid,uuid,uuid,text,integer,text,bigint) from public,anon;grant execute on function public.record_competition_points(uuid,uuid,uuid,text,integer,text,bigint) to authenticated;

create or replace function public.publish_competition_standings(p_season_id uuid,p_expected_revision bigint,p_source_ids uuid[],p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.competition_seasons;expected uuid[];provided uuid[];v uuid;begin
 select * into s from public.competition_seasons where id=p_season_id for update;
 if not found or not public.can_manage_competition(s.id) then raise exception 'Not authorized' using errcode='42501';end if;
 if s.rules_revision is distinct from p_expected_revision then raise exception 'Competition changed; rebuild' using errcode='PT409';end if;
 select coalesce(array_agg(id order by id),'{}') into expected from (select distinct on(v.event_id) v.id,v.event_id from public.event_result_versions v join public.events e on e.id=v.event_id where e.competition_season_id=s.id and e.status='completed' order by v.event_id,v.version desc) latest;
 select coalesce(array_agg(x order by x),'{}') into provided from unnest(p_source_ids) x;
 if expected is distinct from provided then raise exception 'Official race results changed; rebuild' using errcode='PT409';end if;
 if jsonb_typeof(p_payload->'standings') is distinct from 'array' then raise exception 'Invalid standings payload';end if;
 update public.competition_result_versions set is_current=false where season_id=s.id and is_current;
 insert into public.competition_result_versions(season_id,version,source_revision,source_version_ids,payload,actor_id) select s.id,coalesce(max(version),0)+1,s.rules_revision,expected,p_payload,auth.uid() from public.competition_result_versions where season_id=s.id returning id into v;return v;end $$;
revoke all on function public.publish_competition_standings(uuid,bigint,uuid[],jsonb) from public,anon;grant execute on function public.publish_competition_standings(uuid,bigint,uuid[],jsonb) to authenticated;

create or replace function public.map_competition_defaults() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.competition_season_id is not null then update public.event_classes ec set competition_class_id=cc.id from public.competition_classes cc where ec.event_id=new.id and cc.season_id=new.competition_season_id and ((ec.series_class_id is not null and cc.series_class_id=ec.series_class_id) or (ec.template_id is not null and cc.template_id=ec.template_id));end if;return null;end $$;
create trigger map_competition_defaults after insert on public.events for each row execute function public.map_competition_defaults();
revoke all on function public.map_competition_defaults() from public,anon,authenticated;

create or replace function public.import_competition_registrations(p_event_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare e public.events;c record;r record;n integer:=0;begin
 select * into e from public.events where id=p_event_id for update;
 if not found or not public.can_edit_race(e.id) then raise exception 'Not authorized' using errcode='42501';end if;
 if e.status='completed' then raise exception 'Reopen before editing entries';end if;
 for c in select * from public.event_classes where event_id=e.id and competition_class_id is not null loop
  for r in select * from public.competition_registrations where season_id=e.competition_season_id and class_id=c.competition_class_id and joined_on<=e.local_date and (left_on is null or e.local_date<left_on) order by created_at,id loop
   if not exists(select 1 from public.entries where event_class_id=c.id and registration_id=r.id) then
    insert into public.entries(event_class_id,display_name,order_num,registration_id) select c.id,r.display_name||case when r.vehicle_name='' then '' else ' · '||r.vehicle_name end,coalesce(max(order_num),0)+1,r.id from public.entries where event_class_id=c.id;n:=n+1;
   end if;
  end loop;
 end loop;return n;end $$;
revoke all on function public.import_competition_registrations(uuid) from public,anon;grant execute on function public.import_competition_registrations(uuid) to authenticated;

-- Identity is the registered entry, not a driver's name. No name-based matching.
create or replace function public.guard_registration_identity() returns trigger language plpgsql set search_path='' as $$
begin if (new.season_id,new.class_id) is distinct from (old.season_id,old.class_id) then raise exception 'Create a separate registration for a different season or class';end if;return new;end $$;
create trigger guard_registration_identity before update on public.competition_registrations for each row execute function public.guard_registration_identity();
revoke all on function public.guard_registration_identity() from public,anon,authenticated;

-- Completed season changes are lifecycle edits and require reopening.
create or replace function public.guard_completed_metadata() returns trigger language plpgsql set search_path='' as $$
begin if old.status='completed' and (new.name,new.local_date,new.track_id,new.series_id,new.competition_season_id,new.venue_description) is distinct from (old.name,old.local_date,old.track_id,old.series_id,old.competition_season_id,old.venue_description) then raise exception 'Reopen before editing completed metadata';end if;return new;end $$;
notify pgrst,'reload schema';
