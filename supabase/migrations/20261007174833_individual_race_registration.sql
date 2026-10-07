-- Save an individual race signup and its optional series membership atomically.
-- The existing creation function supplies authorization and a per-event order lock.
create or replace function public.register_race_contestant(
  p_owner_id uuid, p_event_id uuid, p_class_id uuid, p_display_name text,
  p_order_num integer default null, p_registration_id uuid default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_event public.events; v_entry uuid; v_class uuid; v_rows integer;
begin
  if auth.uid() is null or not public.can_edit_race(p_event_id) then
    raise exception 'You do not have permission to register contestants for this race' using errcode='42501';
  end if;
  select * into v_event from public.events
    where id=p_event_id and coalesce(track_id,series_id)=p_owner_id for update;
  if not found then raise exception 'Choose a race belonging to this track or series' using errcode='42501'; end if;
  select competition_class_id into v_class from public.event_classes where id=p_class_id and event_id=p_event_id;
  if not found then raise exception 'Choose a class from this race'; end if;
  if p_registration_id is not null and not exists (
    select 1 from public.competition_registrations r
    where r.id=p_registration_id and r.season_id=v_event.competition_season_id and r.class_id=v_class
      and r.joined_on<=v_event.local_date and (r.left_on is null or v_event.local_date<r.left_on)
  ) then
    raise exception 'Choose an eligible series registration for this class and race date, or enter the contestant as a local';
  end if;
  v_entry:=public.create_race_entry(p_owner_id,p_event_id,p_class_id,p_display_name,p_order_num);
  if p_registration_id is not null then
    update public.entries set registration_id=p_registration_id where id=v_entry;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'The series registration could not be saved. Try again'; end if;
  end if;
  return v_entry;
end;
$$;
revoke all on function public.register_race_contestant(uuid,uuid,uuid,text,integer,uuid) from public,anon;
grant execute on function public.register_race_contestant(uuid,uuid,uuid,text,integer,uuid) to authenticated;

-- A calendar date needs no contestant entries; retain default classes for later use.
create or replace function public.schedule_track_calendar_event(
  p_track_id uuid, p_name text, p_local_date date, p_slug text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_event uuid; v_revision bigint;
begin
  v_event:=public.create_track_event(p_track_id,p_name,p_local_date,p_slug,array[]::uuid[]);
  select working_revision into v_revision from public.events where id=v_event;
  perform public.set_race_event_status(v_event,'scheduled',v_revision);
  return v_event;
end;
$$;
revoke all on function public.schedule_track_calendar_event(uuid,text,date,text) from public,anon;
grant execute on function public.schedule_track_calendar_event(uuid,text,date,text) to authenticated;
