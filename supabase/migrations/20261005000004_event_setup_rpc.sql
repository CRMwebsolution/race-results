-- Migration: Event Setup RPC
-- Transactional creation of an event and copying class templates

create or replace function public.create_track_event(
  p_track_id uuid,
  p_name text,
  p_local_date date,
  p_slug text,
  p_template_ids uuid[] default array[]::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_template_id uuid;
  v_class_count integer := 0;
begin
  -- 1. Check permissions
  if not public.can_edit_track(p_track_id) then
    raise exception 'Not authorized to manage this track';
  end if;

  -- 2. Verify slug uniqueness for this track
  if exists (select 1 from public.events where track_id = p_track_id and slug = p_slug) then
    raise exception 'An event with this URL slug already exists for this track';
  end if;

  -- 3. Create the event
  insert into public.events (track_id, name, local_date, slug, status, working_revision)
  values (p_track_id, p_name, p_local_date, p_slug, 'draft', 1)
  returning id into v_event_id;

  -- 4. Copy templates if any were provided
  if array_length(p_template_ids, 1) > 0 then
    insert into public.event_classes (
      event_id,
      track_id,
      template_id,
      name,
      rules_text,
      entry_fee_text,
      scoring_type,
      scoring_config,
      order_num
    )
    select 
      v_event_id,
      p_track_id,
      ct.id,
      ct.name,
      ct.rules_text,
      ct.entry_fee_text,
      ct.scoring_type,
      ct.scoring_config,
      ct.order_num
    from public.class_templates ct
    where ct.id = any(p_template_ids)
      and ct.track_id = p_track_id
      and ct.active = true
    order by ct.order_num;
  end if;

  return v_event_id;
end;
$$;
