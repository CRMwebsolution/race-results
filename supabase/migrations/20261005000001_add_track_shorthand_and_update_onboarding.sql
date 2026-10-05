-- Migration: Add shorthand to tracks and add streamlined register_track RPC
-- Specification update: Registering a new track uses track name, optional shorthand, and timezone.
-- Slug auto-populates from shorthand if present, else from track name using hyphens.

-- 1. Add shorthand column to tracks table
alter table public.tracks add column if not exists shorthand text;

-- 2. Streamlined track registration RPC
create or replace function public.register_track(
  p_track_name text,
  p_shorthand text default null,
  p_timezone text default 'America/New_York',
  p_slug text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_user_email text;
  v_org_id uuid;
  v_track_id uuid;
  v_slug text;
  v_shorthand text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if trim(p_track_name) = '' then
    raise exception 'Track name is required';
  end if;

  v_user_email := coalesce(auth.jwt() ->> 'email', 'owner@trackscore.app');
  v_shorthand := nullif(trim(p_shorthand), '');

  -- Determine slug: if provided use it, otherwise derive from shorthand or track_name
  if p_slug is not null and trim(p_slug) <> '' then
    v_slug := lower(trim(p_slug));
  elsif v_shorthand is not null then
    v_slug := lower(regexp_replace(regexp_replace(v_shorthand, '\s+|%20', '-', 'g'), '[^a-z0-9-_]', '', 'g'));
  else
    v_slug := lower(regexp_replace(regexp_replace(trim(p_track_name), '\s+|%20', '-', 'g'), '[^a-z0-9-_]', '', 'g'));
  end if;

  -- Fallback if slug characters were completely stripped
  if v_slug = '' or v_slug is null then
    v_slug := 'track-' || substr(gen_random_uuid()::text, 1, 8);
  end if;

  -- 1. Insert organization (automatically named after track)
  insert into public.organizations (name, billing_email)
  values (trim(p_track_name), v_user_email)
  returning id into v_org_id;

  -- 2. Insert organization owner membership
  insert into public.organization_memberships (organization_id, user_id, role, active)
  values (v_org_id, v_user_id, 'owner', true);

  -- 3. Insert track
  insert into public.tracks (organization_id, slug, name, shorthand, timezone)
  values (v_org_id, v_slug, trim(p_track_name), v_shorthand, coalesce(p_timezone, 'America/New_York'))
  returning id into v_track_id;

  -- 4. Insert track owner membership
  insert into public.track_memberships (track_id, user_id, role, active)
  values (v_track_id, v_user_id, 'owner', true);

  -- 5. Record audit event
  insert into public.audit_events (
    organization_id,
    track_id,
    actor_id,
    action,
    target_type,
    target_id,
    after_data
  ) values (
    v_org_id,
    v_track_id,
    v_user_id,
    'create_track',
    'track',
    v_track_id,
    jsonb_build_object(
      'organization_id', v_org_id,
      'track_id', v_track_id,
      'track_slug', v_slug,
      'track_name', trim(p_track_name),
      'shorthand', v_shorthand
    )
  );

  return jsonb_build_object(
    'organization_id', v_org_id,
    'track_id', v_track_id,
    'slug', v_slug,
    'status', 'success'
  );
end;
$$;

revoke execute on function public.register_track(text, text, text, text) from public, anon;
grant execute on function public.register_track(text, text, text, text) to authenticated;
