-- Fresh seasons and registrations for independent owners.
create table public.competition_seasons (
 id uuid primary key default gen_random_uuid(),track_id uuid references public.tracks(id),series_id uuid references public.series(id),
 name text not null check(length(trim(name))>0),starts_on date not null,ends_on date,rules_revision bigint not null default 1,created_at timestamptz not null default now(),
 check((track_id is null)<>(series_id is null)),check(ends_on is null or ends_on>=starts_on)
);
create index competition_seasons_track_idx on public.competition_seasons(track_id);
create index competition_seasons_series_idx on public.competition_seasons(series_id);
create table public.competition_classes(id uuid primary key default gen_random_uuid(),season_id uuid not null references public.competition_seasons(id),name text not null check(length(trim(name))>0),series_class_id uuid references public.series_classes(id),template_id uuid references public.class_templates(id),unique(season_id,id));
create table public.competition_registrations(id uuid primary key default gen_random_uuid(),season_id uuid not null references public.competition_seasons(id),class_id uuid not null,display_name text not null check(length(trim(display_name))>0),vehicle_name text not null default '',joined_on date not null,left_on date,created_at timestamptz not null default now(),legacy_roster_id uuid references public.series_rosters(id),check(left_on is null or left_on>=joined_on),foreign key(season_id,class_id) references public.competition_classes(season_id,id),unique(season_id,id));
create index competition_registrations_class_idx on public.competition_registrations(class_id);
create table public.competition_points_rules(id uuid primary key default gen_random_uuid(),season_id uuid not null references public.competition_seasons(id),rank_start integer not null check(rank_start>=1),rank_end integer not null,points integer not null check(points>=0),check(rank_end>=rank_start));
create table public.competition_points_changes(id uuid primary key default gen_random_uuid(),season_id uuid not null references public.competition_seasons(id),registration_id uuid not null,event_id uuid references public.events(id),mode text not null check(mode in ('adjustment','override')),points integer not null check(points between -1000000 and 1000000),previous_points integer,reason text not null check(length(trim(reason))>0),actor_id uuid not null,created_at timestamptz not null default now(),foreign key(season_id,registration_id) references public.competition_registrations(season_id,id),check(mode<>'override' or event_id is not null));
create index competition_points_changes_scope_idx on public.competition_points_changes(season_id,registration_id,event_id,created_at);
create table public.competition_result_versions(id uuid primary key default gen_random_uuid(),season_id uuid not null references public.competition_seasons(id),version integer not null,source_revision bigint not null,source_version_ids uuid[] not null,payload jsonb not null,is_current boolean not null default true,actor_id uuid not null,published_at timestamptz not null default now(),unique(season_id,version));
alter table public.events add column competition_season_id uuid references public.competition_seasons(id);
alter table public.event_classes add column competition_class_id uuid references public.competition_classes(id);
alter table public.entries add column registration_id uuid references public.competition_registrations(id);
create index events_competition_season_idx on public.events(competition_season_id);
create unique index entries_registration_key on public.entries(event_class_id,registration_id) where registration_id is not null;

create or replace function public.can_manage_competition(p_season_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.competition_seasons cs where cs.id=p_season_id and (
 (cs.track_id is not null and public.can_manage_track(cs.track_id)) or
 (cs.series_id is not null and exists(select 1 from public.series s where s.id=cs.series_id and (public.is_org_admin(s.organization_id) or public.is_platform_admin())))));
$$;
revoke all on function public.can_manage_competition(uuid) from public,anon;grant execute on function public.can_manage_competition(uuid) to authenticated;
-- Public competitions contain sporting names and points only; account/billing data stays private.
alter table public.competition_seasons enable row level security;
create policy competition_seasons_read on public.competition_seasons for select to anon,authenticated using(true);
create policy competition_seasons_update on public.competition_seasons for update to authenticated using(public.can_manage_competition(id)) with check(public.can_manage_competition(id));
do $$declare t text;begin foreach t in array array['competition_classes','competition_registrations','competition_points_rules'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy competition_read on public.%I for select to anon,authenticated using(true)',t);
 execute format('create policy competition_manage on public.%I for all to authenticated using(public.can_manage_competition(season_id)) with check(public.can_manage_competition(season_id))',t);
 execute format('grant select on public.%I to anon,authenticated',t);
 execute format('grant insert,update on public.%I to authenticated',t);
 end loop;end $$;
alter table public.competition_points_changes enable row level security;
alter table public.competition_result_versions enable row level security;
create policy competition_changes_read on public.competition_points_changes for select to anon,authenticated using(true);
create policy competition_versions_read on public.competition_result_versions for select to anon,authenticated using(true);
grant select on public.competition_seasons,public.competition_points_changes,public.competition_result_versions to anon,authenticated;
revoke insert,update,delete on public.competition_points_changes,public.competition_result_versions from public,anon,authenticated;
revoke insert,delete on public.competition_seasons from public,anon,authenticated;
revoke delete on public.competition_registrations from public,anon,authenticated;

create or replace function public.create_competition_season(p_track_id uuid,p_series_id uuid,p_name text,p_starts_on date,p_ends_on date default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid;begin
 if auth.uid() is null or (p_track_id is null)=(p_series_id is null) or
 (p_track_id is not null and not public.can_manage_track(p_track_id)) or
 (p_series_id is not null and not exists(select 1 from public.series where id=p_series_id and (public.is_org_admin(organization_id) or public.is_platform_admin()))) then raise exception 'Not authorized' using errcode='42501';end if;
 insert into public.competition_seasons(track_id,series_id,name,starts_on,ends_on) values(p_track_id,p_series_id,trim(p_name),p_starts_on,p_ends_on) returning id into v;
 if p_series_id is not null then
 insert into public.competition_classes(season_id,name,series_class_id) select v,name,id from public.series_classes where series_id=p_series_id order by order_num;
 insert into public.competition_points_rules(season_id,rank_start,rank_end,points) select v,rank_start,rank_end,points from public.series_points_rules where series_id=p_series_id;
 else
 insert into public.competition_classes(season_id,name,template_id) select v,name,id from public.class_templates where track_id=p_track_id and active order by order_num;
 if not exists(select 1 from public.competition_classes where season_id=v) then insert into public.competition_classes(season_id,name) select v,x->>'name' from public.tracks t cross join lateral jsonb_array_elements(coalesce(t.default_classes,'[]'::jsonb)) x where t.id=p_track_id;end if;
 end if;return v;end $$;
revoke all on function public.create_competition_season(uuid,uuid,text,date,date) from public,anon;grant execute on function public.create_competition_season(uuid,uuid,text,date,date) to authenticated;

create or replace function public.guard_competition_scope() returns trigger language plpgsql set search_path='' as $$
declare s public.competition_seasons;e public.events;r public.competition_registrations;
begin
 if tg_table_name='competition_seasons' then
  if (new.track_id,new.series_id) is distinct from (old.track_id,old.series_id) then raise exception 'Competition ownership cannot change';end if;
 elsif tg_table_name='events' then
  if new.competition_season_id is not null then select * into s from public.competition_seasons where id=new.competition_season_id;
   if (new.track_id,new.series_id) is distinct from (s.track_id,s.series_id) then raise exception 'Season belongs to another owner';end if;
   if new.local_date<s.starts_on or (s.ends_on is not null and new.local_date>s.ends_on) then raise exception 'Race date falls outside this season';end if;
  end if;
  if tg_op='UPDATE' and new.competition_season_id is distinct from old.competition_season_id and exists(select 1 from public.entries en join public.event_classes c on c.id=en.event_class_id where c.event_id=new.id and en.registration_id is not null) then raise exception 'Unlink registrations before changing season';end if;
 elsif tg_table_name='event_classes' then
  select * into e from public.events where id=new.event_id;
  if new.competition_class_id is not null and not exists(select 1 from public.competition_classes where id=new.competition_class_id and season_id=e.competition_season_id) then raise exception 'Championship class belongs to another season';end if;
  if tg_op='UPDATE' and new.competition_class_id is distinct from old.competition_class_id and exists(select 1 from public.entries where event_class_id=new.id and registration_id is not null) then raise exception 'Unlink registrations before changing championship class';end if;
 else
  if new.registration_id is not null then
   select * into e from public.events where id=(select event_id from public.event_classes where id=new.event_class_id);
   select * into r from public.competition_registrations where id=new.registration_id;
   if r.season_id is distinct from e.competition_season_id or r.class_id is distinct from (select competition_class_id from public.event_classes where id=new.event_class_id) then raise exception 'Registration belongs to another season or class';end if;
  end if;
 end if;return new;end $$;
create trigger guard_competition_owner before update on public.competition_seasons for each row execute function public.guard_competition_scope();
create trigger guard_event_competition before insert or update on public.events for each row execute function public.guard_competition_scope();
create trigger guard_class_competition before insert or update on public.event_classes for each row execute function public.guard_competition_scope();
create trigger guard_entry_competition before insert or update on public.entries for each row execute function public.guard_competition_scope();
revoke all on function public.guard_competition_scope() from public,anon,authenticated;

create or replace function public.invalidate_competition() returns trigger language plpgsql security definer set search_path='' as $$
declare v uuid;begin
 if tg_table_name='events' then v:=new.competition_season_id;
 elsif tg_table_name='entries' then
 select competition_season_id into v from public.events where id=(select event_id from public.event_classes where id=case when tg_op='DELETE' then old.event_class_id else new.event_class_id end);
 elsif tg_table_name='event_classes' then
 select competition_season_id into v from public.events where id=case when tg_op='DELETE' then old.event_id else new.event_id end;
 else v:=case when tg_op='DELETE' then old.season_id else new.season_id end;end if;
 if v is not null then update public.competition_seasons set rules_revision=rules_revision+1 where id=v;update public.competition_result_versions set is_current=false where season_id=v and is_current;end if;return null;end $$;
do $$declare t text;begin foreach t in array array['competition_classes','competition_registrations','competition_points_rules','competition_points_changes','entries','event_classes','events'] loop execute format('create trigger invalidate_competition after insert or update or delete on public.%I for each row execute function public.invalidate_competition()',t);end loop;end $$;
revoke all on function public.invalidate_competition() from public,anon,authenticated;

create or replace function public.validate_competition_rule() returns trigger language plpgsql set search_path='' as $$
begin perform 1 from public.competition_seasons where id=new.season_id for update;
 if exists(select 1 from public.competition_points_rules where season_id=new.season_id and id<>new.id and rank_start<=new.rank_end and rank_end>=new.rank_start) then raise exception 'Points bands overlap';end if;return new;end $$;
create trigger validate_competition_rule before insert or update on public.competition_points_rules for each row execute function public.validate_competition_rule();
revoke all on function public.validate_competition_rule() from public,anon,authenticated;

create or replace function public.attach_competition(p_event_id uuid,p_season_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin if not public.can_manage_race(p_event_id) or not public.can_manage_competition(p_season_id) then raise exception 'Not authorized' using errcode='42501';end if;
 if exists(select 1 from public.events where id=p_event_id and status='completed') then raise exception 'Reopen before editing championship';end if;
 update public.events set competition_season_id=p_season_id where id=p_event_id;
 update public.event_classes ec set competition_class_id=cc.id from public.competition_classes cc where ec.event_id=p_event_id and cc.season_id=p_season_id and ((ec.series_class_id is not null and cc.series_class_id=ec.series_class_id) or (ec.template_id is not null and cc.template_id=ec.template_id));
end $$;
revoke all on function public.attach_competition(uuid,uuid) from public,anon;grant execute on function public.attach_competition(uuid,uuid) to authenticated;

-- Freeze eligibility with every official result; future roster edits cannot erase old points.
do $$declare s text;begin select pg_get_functiondef('public.capture_official_result(uuid,jsonb,bigint,boolean)'::regprocedure) into s;
 s:=replace(s,'''entries'',','''registrations'',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object(''eligible'',e.local_date>=r.joined_on and (r.left_on is null or e.local_date<r.left_on))) from public.competition_registrations r where r.season_id=e.competition_season_id),''[]''::jsonb),''entries'',');execute s;end $$;

-- Preserve existing series/roster IDs by mapping them into an explicit initial season.
do $$declare s record;v uuid;begin for s in select * from public.series loop
 insert into public.competition_seasons(series_id,name,starts_on) values(s.id,'Initial season',coalesce((select min(local_date) from public.events where series_id=s.id),current_date)) returning id into v;
 insert into public.competition_classes(season_id,name,series_class_id) select v,name,id from public.series_classes where series_id=s.id;
 insert into public.competition_points_rules(season_id,rank_start,rank_end,points) select v,rank_start,rank_end,points from public.series_points_rules where series_id=s.id;
 insert into public.competition_registrations(season_id,class_id,display_name,joined_on,legacy_roster_id) select v,c.id,r.display_name,r.created_at::date,r.id from public.series_rosters r join public.competition_classes c on c.series_class_id=r.series_class_id and c.season_id=v where r.series_id=s.id;
 alter table public.events disable trigger guard_completed_metadata;
 update public.events set competition_season_id=v where series_id=s.id;
 alter table public.events enable trigger guard_completed_metadata;
 alter table public.event_classes disable trigger guard_race_data_change;
 update public.event_classes ec set competition_class_id=c.id from public.competition_classes c where c.season_id=v and c.series_class_id=ec.series_class_id and ec.event_id in(select id from public.events where series_id=s.id);
 alter table public.event_classes enable trigger guard_race_data_change;
 alter table public.entries disable trigger guard_race_data_change;
 update public.entries en set registration_id=r.id from public.competition_registrations r where r.season_id=v and r.legacy_roster_id=en.series_roster_id;
 alter table public.entries enable trigger guard_race_data_change;
 end loop;end $$;
notify pgrst,'reload schema';
