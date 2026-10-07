-- Copy default class rules with the race, preserving existing events.
create or replace function public.create_track_event(
  p_track_id uuid, p_name text, p_local_date date, p_slug text,
  p_template_ids uuid[] default array[]::uuid[]
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_event_id uuid; v_defaults jsonb;
begin
  if auth.uid() is null or not public.can_edit_track(p_track_id) then
    raise exception 'Not authorized to manage this track' using errcode='42501';
  end if;
  if nullif(trim(p_name),'') is null or p_local_date is null or nullif(trim(p_slug),'') is null then
    raise exception 'Event name, date and slug are required';
  end if;
  if exists (select 1 from public.events where track_id=p_track_id and slug=p_slug) then
    raise exception 'An event with this URL slug already exists for this track';
  end if;
  if exists (select 1 from unnest(p_template_ids) x(id) where not exists (
    select 1 from public.class_templates ct where ct.id=x.id and ct.track_id=p_track_id and ct.active
  )) then raise exception 'Invalid class template'; end if;
  insert into public.events(track_id,name,local_date,slug,status,working_revision)
    values(p_track_id,trim(p_name),p_local_date,trim(p_slug),'draft',1) returning id into v_event_id;
  if cardinality(p_template_ids)>0 then
    insert into public.event_classes(event_id,track_id,template_id,name,rules_text,entry_fee_text,scoring_type,scoring_config,order_num)
    select v_event_id,p_track_id,ct.id,ct.name,ct.rules_text,ct.entry_fee_text,ct.scoring_type,ct.scoring_config,
      row_number() over(order by ct.order_num,ct.id)::integer
    from public.class_templates ct where ct.id=any(p_template_ids);
  else
    select default_classes into v_defaults from public.tracks where id=p_track_id;
    if jsonb_typeof(v_defaults)<>'array' then raise exception 'Invalid default classes'; end if;
    if exists (select 1 from jsonb_array_elements(v_defaults) c where nullif(trim(c->>'name'),'') is null
      or coalesce(c->>'type','') not in ('fastest_pass','consistency','combined_time','judged_points','stopped_distance')) then
      raise exception 'Invalid default class name or scoring format';
    end if;
    insert into public.event_classes(event_id,track_id,name,scoring_type,scoring_config,rules_text,entry_fee_text,order_num)
      select v_event_id,p_track_id,trim(c.value->>'name'),(c.value->>'type')::public.scoring_type,
        coalesce(nullif(c.value->'scoring_config','null'::jsonb),'{}'::jsonb),c.value->>'rules_text',c.value->>'entry_fee_text',c.ordinality::integer
      from jsonb_array_elements(v_defaults) with ordinality c(value,ordinality);
  end if;
  return v_event_id;
end;
$$;
revoke all on function public.create_track_event(uuid,text,date,text,uuid[]) from public,anon;
grant execute on function public.create_track_event(uuid,text,date,text,uuid[]) to authenticated;

