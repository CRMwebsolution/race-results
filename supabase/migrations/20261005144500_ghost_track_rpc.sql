create or replace function public.create_ghost_track(
  p_org_id uuid,
  p_name text,
  p_slug text,
  p_timezone text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_track_id uuid;
begin
  if not exists (
    select 1 from public.organization_memberships
    where organization_id = p_org_id
      and user_id = auth.uid()
      and active = true
  ) and not public.is_platform_admin() then
    raise exception 'Not authorized to create tracks in this organization';
  end if;

  insert into public.tracks (organization_id, name, slug, timezone)
  values (p_org_id, p_name, p_slug, p_timezone)
  returning id into v_track_id;

  insert into public.track_memberships (track_id, user_id, role, active)
  values (v_track_id, auth.uid(), 'owner', true);

  return v_track_id;
end;
$$;
