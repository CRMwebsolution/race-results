alter table public.series_classes add column scoring_type public.scoring_type not null default 'fastest_pass';
alter table public.series_classes add column scoring_config jsonb not null default '{}';
alter table public.event_classes add column series_class_id uuid references public.series_classes(id) on delete set null;
alter table public.events add column defaults_initialized boolean not null default false;
alter table public.events add column setup_request_id uuid unique;
create index event_classes_series_class_idx on public.event_classes(series_class_id);

create or replace function public.initialize_series_event(p_event_id uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare e public.events; n integer;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or (current_setting('role',true) in ('anon','authenticated') and (auth.uid() is null or not public.can_manage_track(e.track_id))) then raise exception 'Not authorized' using errcode='42501'; end if;
 if e.defaults_initialized or e.series_id is null then return 0; end if;
 if e.status not in ('draft','scheduled') or exists(select 1 from public.event_classes where event_id=e.id) then raise exception 'Initialize only an empty unstarted event'; end if;
 insert into public.event_classes(event_id,track_id,series_class_id,name,rules_text,entry_fee_text,scoring_type,scoring_config,order_num)
 select e.id,e.track_id,id,name,rules_text,entry_fee_text,scoring_type,scoring_config,row_number() over(order by order_num,id) from public.series_classes where series_id=e.series_id;
 get diagnostics n=row_count;
 update public.events set defaults_initialized=true where id=e.id;
 return n;
end $$;
create or replace function public.copy_series_event_defaults() returns trigger
language plpgsql security definer set search_path='' as $$
begin if new.series_id is not null then perform public.initialize_series_event(new.id); end if; return null; end $$;
create trigger copy_series_event_defaults after insert on public.events for each row execute function public.copy_series_event_defaults();
revoke all on function public.copy_series_event_defaults() from public,anon,authenticated;
revoke all on function public.initialize_series_event(uuid) from public,anon;
grant execute on function public.initialize_series_event(uuid) to authenticated;
-- Initialize only untouched scheduled/draft events; preserve existing race-specific work.
do $$ declare e record; begin for e in select id from public.events where series_id is not null and status in ('draft','scheduled') and not exists(select 1 from public.event_classes c where c.event_id=events.id) loop perform public.initialize_series_event(e.id); end loop; end $$;
update public.events set defaults_initialized=true where exists(select 1 from public.event_classes c where c.event_id=events.id);

-- Venue moves are atomic and stay in the authorized organization.
do $$ declare n text; begin select conname into n from pg_constraint where conrelid='public.event_classes'::regclass and contype='f' and confrelid='public.events'::regclass; execute format('alter table public.event_classes alter constraint %I deferrable initially immediate',n); end $$;
-- Defer class position uniqueness within checked atomic reorder operations.
do $$ declare n text; begin select conname into n from pg_constraint where conrelid='public.event_classes'::regclass and contype='u' and pg_get_constraintdef(oid) like 'UNIQUE (event_id, order_num)%'; if n is not null then execute format('alter table public.event_classes drop constraint %I',n); end if; end $$;
alter table public.event_classes add constraint event_classes_event_order_key unique(event_id,order_num) deferrable initially immediate;
create or replace function public.reorder_event_classes(p_event_id uuid,p_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or auth.uid() is null or not public.can_manage_track(e.track_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_ids is null or cardinality(p_ids)<>(select count(*) from public.event_classes where event_id=e.id) or (select count(distinct x) from unnest(p_ids) x)<>cardinality(p_ids) or exists(select 1 from unnest(p_ids) x where not exists(select 1 from public.event_classes where id=x and event_id=e.id)) then raise exception 'Class list changed; reload before reordering'; end if;
 set constraints public.event_classes_event_order_key deferred;
 update public.event_classes c set order_num=u.n from unnest(p_ids) with ordinality u(id,n) where c.id=u.id;
 set constraints public.event_classes_event_order_key immediate;
end $$;
create or replace function public.create_event_class(p_event_id uuid,p_name text,p_type public.scoring_type,p_config jsonb default '{}') returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.events; c uuid;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or auth.uid() is null or not public.can_manage_track(e.track_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 if nullif(trim(p_name),'') is null then raise exception 'Class name is required'; end if;
 insert into public.event_classes(event_id,track_id,name,scoring_type,scoring_config,order_num) select e.id,e.track_id,trim(p_name),p_type,p_config,coalesce(max(order_num),0)+1 from public.event_classes where event_id=e.id returning id into c;
 return c;
end $$;
create or replace function public.remove_event_class(p_event_id uuid,p_class_id uuid,p_confirm boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or auth.uid() is null or not public.can_manage_track(e.track_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 if not p_confirm and exists(select 1 from public.entries where event_class_id=p_class_id) then raise exception 'Confirm removal of this class and its racers/results'; end if;
 delete from public.event_classes where id=p_class_id and event_id=e.id;
 if not found then raise exception 'Class not found'; end if;
end $$;
create or replace function public.edit_race_event(p_event_id uuid,p_name text,p_date date,p_track_id uuid,p_expected_revision bigint) returns void
language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or auth.uid() is null or not public.can_manage_track(e.track_id) or not public.can_manage_track(p_track_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 if e.status='completed' then raise exception 'Reopen before editing a completed event'; end if;
 if e.working_revision<>p_expected_revision then raise exception 'Event changed; reload' using errcode='40001'; end if;
 if nullif(trim(p_name),'') is null or p_date is null then raise exception 'Name and date required'; end if;
 if e.track_id<>p_track_id then
  if exists(select 1 from public.entries en join public.event_classes c on c.id=en.event_class_id where c.event_id=e.id) then raise exception 'Venue cannot change after racers are registered'; end if;
  set constraints all deferred;
  update public.events set track_id=p_track_id where id=e.id;
  update public.event_classes set track_id=p_track_id where event_id=e.id;
  set constraints all immediate;
 end if;
 update public.events set name=trim(p_name),local_date=p_date,working_revision=working_revision+1,published_revision=case when status='live' then working_revision+1 else published_revision end where id=e.id;
end $$;
create or replace function public.delete_or_withdraw_event(p_event_id uuid,p_confirm boolean) returns text
language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or auth.uid() is null or not public.can_publish_track(e.track_id) then raise exception 'Only an owner can delete or withdraw an event' using errcode='42501'; end if;
 if not p_confirm then raise exception 'Confirmation required'; end if;
 if e.status='completed' or exists(select 1 from public.entries en join public.event_classes c on c.id=en.event_class_id where c.event_id=e.id) then
  update public.events set status='cancelled' where id=e.id; return 'withdrawn';
 end if;
 delete from public.events where id=e.id; return 'deleted';
end $$;
revoke all on function public.reorder_event_classes(uuid,uuid[]),public.create_event_class(uuid,text,public.scoring_type,jsonb),public.remove_event_class(uuid,uuid,boolean),public.edit_race_event(uuid,text,date,uuid,bigint),public.delete_or_withdraw_event(uuid,boolean) from public,anon;
grant execute on function public.reorder_event_classes(uuid,uuid[]),public.create_event_class(uuid,text,public.scoring_type,jsonb),public.remove_event_class(uuid,uuid,boolean),public.edit_race_event(uuid,text,date,uuid,bigint),public.delete_or_withdraw_event(uuid,boolean) to authenticated;
notify pgrst,'reload schema';

create or replace function public.guard_completed_metadata() returns trigger language plpgsql set search_path='' as $$
begin if old.status='completed' and (new.name,new.local_date,new.track_id,new.series_id) is distinct from (old.name,old.local_date,old.track_id,old.series_id) then raise exception 'Reopen before editing completed metadata'; end if; return new; end $$;
create trigger guard_completed_metadata before update on public.events for each row execute function public.guard_completed_metadata();
revoke all on function public.guard_completed_metadata() from public,anon,authenticated;
revoke delete on public.events from anon,authenticated;
