-- ADR-004 reserves official completion/reopening for owners; platform admins
-- retain their documented emergency management authority (ADR-001).
create or replace function public.can_publish_track(p_track_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.is_platform_admin() or exists(
    select 1 from public.track_memberships m where m.track_id=p_track_id
      and m.user_id=auth.uid() and m.active and m.role='owner'
  ) or exists(
    select 1 from public.tracks t join public.organization_memberships m on m.organization_id=t.organization_id
      where t.id=p_track_id and m.user_id=auth.uid() and m.active and m.role='owner'
  );
$$;
revoke all on function public.can_publish_track(uuid) from public,anon;
grant execute on function public.can_publish_track(uuid) to authenticated;

create or replace function public.create_race_entry(p_track_id uuid,p_event_id uuid,p_class_id uuid,p_display_name text,p_order_num integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_event public.events; v_order integer; v_entry uuid;
begin
  if auth.uid() is null or not public.can_edit_track(p_track_id) then raise exception 'Not authorized to manage this roster' using errcode='42501'; end if;
  select e.* into v_event from public.events e join public.event_classes c on c.event_id=e.id
    where e.id=p_event_id and e.track_id=p_track_id and c.id=p_class_id for update of e;
  if not found then raise exception 'Class and event do not match' using errcode='42501'; end if;
  if nullif(trim(p_display_name),'') is null then raise exception 'Racer name is required'; end if;
  select coalesce(max(order_num),0)+1 into v_order from public.entries where event_class_id=p_class_id;
  v_order:=coalesce(p_order_num,v_order);
  if v_order<1 then raise exception 'Draw number must be a positive integer'; end if;
  insert into public.entries(event_class_id,display_name,order_num) values(p_class_id,trim(p_display_name),v_order) returning id into v_entry;
  return v_entry;
end;
$$;
revoke all on function public.create_race_entry(uuid,uuid,uuid,text,integer) from public,anon;
grant execute on function public.create_race_entry(uuid,uuid,uuid,text,integer) to authenticated;

create or replace function public.audit_event_lifecycle()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status is distinct from old.status then
    insert into public.audit_events(organization_id,track_id,actor_id,action,target_type,target_id,before_data,after_data)
    select t.organization_id,new.track_id,auth.uid(),
      case when old.status='completed' then 'event_reopened' when new.status='completed' then 'event_completed' else 'event_status_changed' end,
      'event',new.id,
      jsonb_build_object('status',old.status,'working_revision',old.working_revision,'published_revision',old.published_revision),
      jsonb_build_object('status',new.status,'working_revision',new.working_revision,'published_revision',new.published_revision)
    from public.tracks t where t.id=new.track_id;
  end if;
  return null;
end;
$$;
create trigger audit_event_lifecycle after update on public.events for each row execute function public.audit_event_lifecycle();
revoke all on function public.audit_event_lifecycle() from public,anon,authenticated;
revoke insert,update,delete on public.audit_events from public,anon,authenticated;


create or replace function public.guard_event_lifecycle()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.status is distinct from old.status then
    if current_setting('role',true) in ('authenticated','anon') and
       (auth.uid() is null or not public.can_publish_track(old.track_id)) then
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

create or replace function public.set_race_event_status(p_event_id uuid,p_status text,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_event public.events;
begin
  select * into v_event from public.events where id=p_event_id for update;
  if not found or auth.uid() is null or not public.can_publish_track(v_event.track_id) then raise exception 'Not authorized to manage this event' using errcode='42501'; end if;
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
  if not found or auth.uid() is null or not public.can_publish_track(v_event.track_id) then raise exception 'Not authorized to complete this event' using errcode='42501'; end if;
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
notify pgrst,'reload schema';
