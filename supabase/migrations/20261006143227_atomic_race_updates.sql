-- Atomic scoring writes, monotonically increasing revisions, and event completion.
alter table public.attempts add column save_version integer not null default 0;

create or replace function public.guard_race_data_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_event_id uuid; v_track_id uuid; v_status text;
begin
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
       (auth.uid() is null or not public.can_edit_track(v_track_id)) then
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
$$;

create or replace function public.revise_race_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_event_id uuid;
begin
  if tg_table_name='event_classes' then
    v_event_id := case when tg_op='DELETE' then old.event_id else new.event_id end;
  else
    select event_id into v_event_id from public.event_classes
      where id=case when tg_op='DELETE' then old.event_class_id else new.event_class_id end;
  end if;
  update public.events set working_revision=working_revision+1,
    published_revision=case when status='live' then working_revision+1 else published_revision end
    where id=v_event_id;
  return null;
end;
$$;

do $$ declare t text; begin
  foreach t in array array['event_classes','entries','attempts'] loop
    execute format('create trigger guard_race_data_change before insert or update or delete on public.%I for each row execute function public.guard_race_data_change()',t);
    execute format('create trigger revise_race_event after insert or update or delete on public.%I for each row execute function public.revise_race_event()',t);
  end loop;
end $$;
revoke all on function public.guard_race_data_change(),public.revise_race_event() from public,anon,authenticated;

-- Scoring writes use the checked RPC, so the version comparison cannot be bypassed by a direct API upsert.
revoke insert,update,delete on public.attempts from public,anon,authenticated;
create or replace function public.save_race_attempt(
  p_track_id uuid,p_event_id uuid,p_class_id uuid,p_entry_id uuid,p_ordinal integer,
  p_status text,p_elapsed_ms integer,p_distance_mm integer,p_penalty_ms integer,p_raw_input text,
  p_expected_version integer
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_event public.events; v_attempt public.attempts; v_version integer;
begin
  if auth.uid() is null or not public.can_edit_track(p_track_id) then raise exception 'Not authorized to score this track' using errcode='42501'; end if;
  select * into v_event from public.events where id=p_event_id and track_id=p_track_id for update;
  if not found then raise exception 'Event not found' using errcode='42501'; end if;
  if v_event.status='completed' then raise exception 'Completed results are locked' using errcode='55000'; end if;
  if not exists(select 1 from public.entries en join public.event_classes c on c.id=en.event_class_id
    where en.id=p_entry_id and c.id=p_class_id and c.event_id=p_event_id and c.track_id=p_track_id) then
    raise exception 'Entry, class and event do not match' using errcode='23514';
  end if;
  if p_ordinal is null or p_ordinal<1 or p_ordinal>100 or p_expected_version is null or p_expected_version<0 then
    raise exception 'Invalid pass number or save version' using errcode='22023';
  end if;
  select save_version into v_version from public.attempts where entry_id=p_entry_id and ordinal=p_ordinal;
  if coalesce(v_version,0)<>p_expected_version then
    raise exception 'This pass changed in another scoring session. Refresh before editing it again.' using errcode='40001';
  end if;
  insert into public.attempts(event_class_id,entry_id,ordinal,status,elapsed_ms,distance_mm,penalty_ms,raw_input)
    values(p_class_id,p_entry_id,p_ordinal,p_status,p_elapsed_ms,p_distance_mm,p_penalty_ms,p_raw_input)
    on conflict(entry_id,ordinal) do update set status=excluded.status,elapsed_ms=excluded.elapsed_ms,
      distance_mm=excluded.distance_mm,penalty_ms=excluded.penalty_ms,raw_input=excluded.raw_input
    returning * into v_attempt;
  select * into v_event from public.events where id=p_event_id;
  return jsonb_build_object('attempt',to_jsonb(v_attempt),'working_revision',v_event.working_revision,
    'published_revision',v_event.published_revision);
end;
$$;
revoke all on function public.save_race_attempt(uuid,uuid,uuid,uuid,integer,text,integer,integer,integer,text,integer) from public,anon;
grant execute on function public.save_race_attempt(uuid,uuid,uuid,uuid,integer,text,integer,integer,integer,text,integer) to authenticated;

-- Only owners/administrators can publish, change lifecycle state or delete events.
drop policy events_update on public.events;
create policy events_update on public.events for update to authenticated
  using(public.can_manage_track(track_id)) with check(public.can_manage_track(track_id));
drop policy events_delete on public.events;
create policy events_delete on public.events for delete to authenticated
  using(public.can_manage_track(track_id) and status<>'completed');

create or replace function public.guard_event_lifecycle()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.status is distinct from old.status then
    if current_setting('role',true) in ('authenticated','anon') and
       (auth.uid() is null or not public.can_manage_track(old.track_id)) then
      raise exception 'Only a track owner or administrator can change event status' using errcode='42501';
    end if;
    new.working_revision := old.working_revision+1;
    if new.status in ('live','completed') then new.published_revision:=new.working_revision;
    else new.published_revision:=null; end if;
    if new.status='completed' and current_setting('raceholler.completing',true) is distinct from new.id::text then
      raise exception 'Use atomic completion to finalize standings' using errcode='55000';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_event_lifecycle before update on public.events for each row execute function public.guard_event_lifecycle();
revoke all on function public.guard_event_lifecycle() from public,anon,authenticated;

create or replace function public.set_race_event_status(p_event_id uuid,p_status text,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_event public.events;
begin
  select * into v_event from public.events where id=p_event_id for update;
  if not found or auth.uid() is null or not public.can_manage_track(v_event.track_id) then raise exception 'Not authorized to manage this event' using errcode='42501'; end if;
  if p_expected_revision is null or p_expected_revision<>v_event.working_revision then raise exception 'Event changed; refresh and try again' using errcode='40001'; end if;
  if p_status not in ('draft','scheduled','live','cancelled') or p_status is null then raise exception 'Invalid event status'; end if;
  update public.events set status=p_status where id=p_event_id returning * into v_event;
  if v_event.status<>'completed' then
    update public.entries set final_rank=null where event_class_id in(select id from public.event_classes where event_id=p_event_id) and final_rank is not null;
  end if;
  return to_jsonb(v_event);
end;
$$;

create or replace function public.complete_race_event(p_event_id uuid,p_expected_revision bigint,p_ranks jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_event public.events; v_count integer;
begin
  select * into v_event from public.events where id=p_event_id for update;
  if not found or auth.uid() is null or not public.can_manage_track(v_event.track_id) then raise exception 'Not authorized to complete this event' using errcode='42501'; end if;
  if v_event.status='completed' then raise exception 'Reopen the event before finalizing again' using errcode='55000'; end if;
  if p_expected_revision is null or p_expected_revision<>v_event.working_revision then raise exception 'Results changed while standings were calculated. Try again.' using errcode='40001'; end if;
  if jsonb_typeof(p_ranks) is distinct from 'array' then raise exception 'Invalid standings'; end if;
  select count(*) into v_count from public.entries en join public.event_classes c on c.id=en.event_class_id where c.event_id=p_event_id;
  if jsonb_array_length(p_ranks)<>v_count or
     (select count(distinct id) from jsonb_to_recordset(p_ranks) as r(id uuid,final_rank integer))<>v_count or
     exists(select 1 from jsonb_to_recordset(p_ranks) as r(id uuid,final_rank integer) where
       r.final_rank<1 or not exists(select 1 from public.entries en join public.event_classes c on c.id=en.event_class_id where en.id=r.id and c.event_id=p_event_id)) then
    raise exception 'Standings must include every entry in this event exactly once' using errcode='23514';
  end if;
  update public.entries en set final_rank=r.final_rank from jsonb_to_recordset(p_ranks) as r(id uuid,final_rank integer) where en.id=r.id;
  perform set_config('raceholler.completing',p_event_id::text,true);
  update public.events set status='completed',published_revision=working_revision where id=p_event_id returning * into v_event;
  perform set_config('raceholler.completing','',true);
  return to_jsonb(v_event);
end;
$$;
revoke all on function public.set_race_event_status(uuid,text,bigint),public.complete_race_event(uuid,bigint,jsonb) from public,anon;
grant execute on function public.set_race_event_status(uuid,text,bigint),public.complete_race_event(uuid,bigint,jsonb) to authenticated;
notify pgrst,'reload schema';
