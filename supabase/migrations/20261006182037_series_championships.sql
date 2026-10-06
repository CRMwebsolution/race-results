alter table public.series add column rules_revision bigint not null default 1;
create table public.series_racers(id uuid primary key default gen_random_uuid(),series_id uuid not null references public.series(id) on delete cascade,display_name text not null,created_at timestamptz not null default now(),unique(series_id,id));
alter table public.series_racers enable row level security;
create policy series_racers_read on public.series_racers for select to anon,authenticated using(exists(select 1 from public.series where id=series_id));
create policy series_racers_manage on public.series_racers for all to authenticated using(exists(select 1 from public.series s where s.id=series_id and public.is_org_admin(s.organization_id))) with check(exists(select 1 from public.series s where s.id=series_id and public.is_org_admin(s.organization_id)));
grant select on public.series_racers to anon,authenticated;
grant insert,update,delete on public.series_racers to authenticated;
alter table public.series_rosters add column series_racer_id uuid references public.series_racers(id) on delete restrict;
do $$ declare r record;v uuid;begin for r in select id,series_id,display_name from public.series_rosters loop insert into public.series_racers(series_id,display_name) values(r.series_id,r.display_name) returning id into v;update public.series_rosters set series_racer_id=v where id=r.id;end loop;end $$;
create or replace function public.identify_series_roster() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.series_racer_id is null then insert into public.series_racers(series_id,display_name) values(new.series_id,new.display_name) returning id into new.series_racer_id;elsif not exists(select 1 from public.series_racers where id=new.series_racer_id and series_id=new.series_id) then raise exception 'Racer identity belongs to another series';end if;return new;end $$;
create trigger identify_series_roster before insert or update on public.series_rosters for each row execute function public.identify_series_roster();
revoke all on function public.identify_series_roster() from public,anon,authenticated;
alter table public.entries add column series_roster_id uuid references public.series_rosters(id) on delete set null;
alter table public.entries add column series_racer_id uuid references public.series_racers(id) on delete restrict;
create unique index entries_series_roster_key on public.entries(event_class_id,series_roster_id) where series_roster_id is not null;
create or replace function public.guard_series_identity() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.event_classes;e public.events;r public.series_rosters;
begin
 if tg_table_name='event_classes' then
  if new.series_class_id is not null and not exists(select 1 from public.series_classes sc join public.events ev on ev.series_id=sc.series_id where sc.id=new.series_class_id and ev.id=new.event_id) then raise exception 'Default class belongs to another series';end if;
 else
  if new.series_roster_id is not null then
   select * into c from public.event_classes where id=new.event_class_id;select * into e from public.events where id=c.event_id;select * into r from public.series_rosters where id=new.series_roster_id;
   if r.series_id is distinct from e.series_id or r.series_class_id is distinct from c.series_class_id then raise exception 'Roster identity does not match event class';end if;
   new.series_racer_id:=r.series_racer_id;
  elsif tg_op='INSERT' and new.series_racer_id is not null then raise exception 'Select a series roster identity';
  elsif tg_op='UPDATE' and new.series_racer_id is distinct from old.series_racer_id then raise exception 'Change identity using its series roster';end if;
 end if;return new;
end $$;
create trigger guard_series_identity before insert or update on public.event_classes for each row execute function public.guard_series_identity();
create trigger guard_series_identity before insert or update on public.entries for each row execute function public.guard_series_identity();
revoke all on function public.guard_series_identity() from public,anon,authenticated;
create or replace function public.import_series_roster(p_event_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare e public.events;c record;r record;n integer:=0;
begin select * into e from public.events where id=p_event_id for update;if not found or auth.uid() is null or not public.can_edit_track(e.track_id) then raise exception 'Not authorized' using errcode='42501';end if;
 if e.status='completed' then raise exception 'Reopen before editing roster';end if;
 for c in select * from public.event_classes where event_id=e.id and series_class_id is not null order by order_num loop
  for r in select * from public.series_rosters where series_id=e.series_id and series_class_id=c.series_class_id order by created_at,id loop
   if not exists(select 1 from public.entries where event_class_id=c.id and series_roster_id=r.id) then
    insert into public.entries(event_class_id,display_name,order_num,series_roster_id) select c.id,r.display_name,coalesce(max(order_num),0)+1,r.id from public.entries where event_class_id=c.id;n:=n+1;
   end if;
  end loop;
 end loop;return n;
end $$;
revoke all on function public.import_series_roster(uuid) from public,anon;grant execute on function public.import_series_roster(uuid) to authenticated;

create table public.series_manual_awards(id uuid primary key default gen_random_uuid(),series_id uuid not null references public.series(id),event_id uuid not null references public.events(id),series_class_id uuid not null references public.series_classes(id),series_racer_id uuid not null references public.series_racers(id),points integer not null check(points between -1000000 and 1000000),reason text not null check(length(trim(reason))>0),actor_id uuid not null,created_at timestamptz not null default now());
alter table public.series_manual_awards enable row level security;
create policy manual_awards_read on public.series_manual_awards for select to anon,authenticated using(exists(select 1 from public.series where id=series_id));
grant select on public.series_manual_awards to anon,authenticated;
revoke insert,update,delete on public.series_manual_awards from public,anon,authenticated;
create or replace function public.add_series_award(p_series_id uuid,p_event_id uuid,p_class_id uuid,p_racer_id uuid,p_points integer,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid;s public.series;begin select * into s from public.series where id=p_series_id for update;if not found or auth.uid() is null or not public.is_org_admin(s.organization_id) then raise exception 'Not authorized' using errcode='42501';end if;
 if not exists(select 1 from public.events where id=p_event_id and series_id=s.id) or not exists(select 1 from public.series_classes where id=p_class_id and series_id=s.id) or not exists(select 1 from public.series_racers where id=p_racer_id and series_id=s.id) then raise exception 'Award scope does not match series';end if;
 insert into public.series_manual_awards(series_id,event_id,series_class_id,series_racer_id,points,reason,actor_id) values(s.id,p_event_id,p_class_id,p_racer_id,p_points,p_reason,auth.uid()) returning id into v;return v;
end $$;
revoke all on function public.add_series_award(uuid,uuid,uuid,uuid,integer,text) from public,anon;grant execute on function public.add_series_award(uuid,uuid,uuid,uuid,integer,text) to authenticated;
create table public.series_result_versions(id uuid primary key default gen_random_uuid(),series_id uuid not null references public.series(id),version integer not null,source_revision bigint not null,source_version_ids uuid[] not null,payload jsonb not null,is_current boolean not null default true,actor_id uuid not null,published_at timestamptz not null default now(),unique(series_id,version));
alter table public.series_result_versions enable row level security;
create policy series_versions_read on public.series_result_versions for select to anon,authenticated using(exists(select 1 from public.series where id=series_id));
grant select on public.series_result_versions to anon,authenticated;revoke insert,update,delete on public.series_result_versions from public,anon,authenticated;
create or replace function public.revise_series_config() returns trigger language plpgsql security definer set search_path='' as $$
declare s uuid;begin s:=case when tg_op='DELETE' then old.series_id else new.series_id end;update public.series set rules_revision=rules_revision+1 where id=s;update public.series_result_versions set is_current=false where series_id=s and is_current;return null;end $$;
do $$declare t text;begin foreach t in array array['series_classes','series_rosters','series_racers','series_points_rules','series_bonuses','series_manual_awards'] loop execute format('create trigger revise_series_config after insert or update or delete on public.%I for each row execute function public.revise_series_config()',t);end loop;end $$;
revoke all on function public.revise_series_config() from public,anon,authenticated;
create or replace function public.validate_series_rules() returns trigger language plpgsql security definer set search_path='' as $$
begin perform 1 from public.series where id=new.series_id for update;
 if tg_table_name='series_points_rules' then
  if new.points<0 or new.rank_start<1 or new.rank_end<new.rank_start or exists(select 1 from public.series_points_rules where series_id=new.series_id and id<>new.id and rank_start<=new.rank_end and rank_end>=new.rank_start) then raise exception 'Points bands must be nonnegative and cannot overlap';end if;
 else
  if new.points<0 or exists(select 1 from public.series_bonuses where series_id=new.series_id and id<>new.id and series_class_id is not distinct from new.series_class_id and bonus_type=new.bonus_type and frequency=new.frequency) then raise exception 'Bonus must be nonnegative and unique for its condition/class/frequency';end if;
 end if;return new;
end $$;
create trigger validate_series_rules before insert or update on public.series_points_rules for each row execute function public.validate_series_rules();create trigger validate_series_rules before insert or update on public.series_bonuses for each row execute function public.validate_series_rules();
revoke all on function public.validate_series_rules() from public,anon,authenticated;
create or replace function public.invalidate_series_results() returns trigger language plpgsql security definer set search_path='' as $$
begin if tg_op='INSERT' then update public.series_result_versions set is_current=false where series_id=new.series_id and is_current;return null;elsif tg_op='DELETE' then update public.series_result_versions set is_current=false where series_id=old.series_id and is_current;return null;end if;if new.status is distinct from old.status or new.series_id is distinct from old.series_id or new.local_date is distinct from old.local_date then update public.series_result_versions set is_current=false where series_id in (new.series_id,old.series_id) and is_current;end if;return null;end $$;
create trigger invalidate_series_results after insert or update or delete on public.events for each row execute function public.invalidate_series_results();
revoke all on function public.invalidate_series_results() from public,anon,authenticated;
create or replace function public.publish_series_standings(p_series_id uuid,p_expected_revision bigint,p_source_ids uuid[],p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.series;expected uuid[];v uuid;
begin select * into s from public.series where id=p_series_id for update;if not found or auth.uid() is null or not public.is_org_admin(s.organization_id) then raise exception 'Not authorized' using errcode='42501';end if;
 if s.rules_revision<>p_expected_revision then raise exception 'Series rules changed; recalculate' using errcode='40001';end if;
 perform 1 from public.events where series_id=s.id order by id for update;
 select coalesce(array_agg(id order by id),array[]::uuid[]) into expected from (select distinct on (r.event_id) r.id from public.event_result_versions r join public.events e on e.id=r.event_id where e.series_id=s.id and e.status='completed' order by r.event_id,r.version desc) latest;
 if expected is distinct from (select coalesce(array_agg(x order by x),array[]::uuid[]) from unnest(p_source_ids) x) then raise exception 'Official race versions changed; recalculate' using errcode='40001';end if;
 if jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid standings';end if;
 update public.series_result_versions set is_current=false where series_id=s.id and is_current;
 insert into public.series_result_versions(series_id,version,source_revision,source_version_ids,payload,actor_id) select s.id,coalesce(max(version),0)+1,s.rules_revision,expected,p_payload,auth.uid() from public.series_result_versions where series_id=s.id returning id into v;return v;
end $$;
revoke all on function public.publish_series_standings(uuid,bigint,uuid[],jsonb) from public,anon;grant execute on function public.publish_series_standings(uuid,bigint,uuid[],jsonb) to authenticated;
notify pgrst,'reload schema';
