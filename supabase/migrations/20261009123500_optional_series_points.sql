-- Migration: Optional series points tracking upon creation

CREATE OR REPLACE FUNCTION public.create_series_with_organization(
  p_series_name text, 
  p_series_description text, 
  p_org_id uuid DEFAULT NULL::uuid, 
  p_org_name text DEFAULT NULL::text,
  p_track_points boolean DEFAULT true
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid;
  v_user_email text;
  v_target_org_id uuid;
  v_series_id uuid;
  v_points_mode text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select email into v_user_email from auth.users where id = v_user_id;

  if nullif(trim(p_series_name), '') is null then
    raise exception 'Series name is required';
  end if;

  v_target_org_id := p_org_id;

  -- If no existing org provided, create a new one
  if v_target_org_id is null then
    if p_org_name is null or trim(p_org_name) = '' then
      raise exception 'Organization name is required';
    end if;

    insert into public.organizations (name, billing_email)
    values (trim(p_org_name), coalesce(v_user_email, 'unknown@example.com'))
    returning id into v_target_org_id;

    insert into public.organization_memberships (organization_id, user_id, role, active)
    values (v_target_org_id, v_user_id, 'owner', true);
  else
    -- Verify the user is an admin or owner of the existing org
    if not (public.is_org_admin(v_target_org_id) or public.is_platform_admin()) then
      raise exception 'You do not have permission to create a series for this organization';
    end if;
  end if;

  v_points_mode := case when p_track_points then 'race_and_total' else 'none' end;

  -- Create the series with appropriate spectator points mode
  insert into public.series (organization_id, name, description, spectator_points_mode)
  values (v_target_org_id, trim(p_series_name), nullif(trim(p_series_description), ''), v_points_mode)
  returning id into v_series_id;

  -- Only create default points rule if tracking points
  if p_track_points then
    insert into public.series_points_rules (series_id, rank_start, rank_end, points)
    values (v_series_id, 1, 1, 50);
  end if;

  return jsonb_build_object(
    'series_id', v_series_id,
    'organization_id', v_target_org_id,
    'spectator_points_mode', v_points_mode
  );
end;
$function$;

revoke all on function public.create_series_with_organization(text,text,uuid,text,boolean) from public,anon;
grant execute on function public.create_series_with_organization(text,text,uuid,text,boolean) to authenticated;
