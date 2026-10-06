-- Additive reconciliation of checked-in migrations and the inspected live schema.
alter table public.entries add column if not exists final_rank integer;
alter table public.series_bonuses add column if not exists created_at timestamptz not null default now();
alter function public.set_updated_at() set search_path = '';

create or replace function public.register_track_with_state(
  p_track_name text, p_shorthand text default null,
  p_timezone text default 'America/New_York', p_slug text default null,
  p_state text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if nullif(trim(p_track_name),'') is null then raise exception 'Track name is required'; end if;
  if p_state is not null and p_state !~ '^[A-Z]{2}$' then raise exception 'Invalid state'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone'; end if;
  result := public.register_track(p_track_name,p_shorthand,p_timezone,p_slug);
  update public.tracks set state=p_state where id=(result->>'track_id')::uuid;
  return result || jsonb_build_object('state',p_state);
end;
$$;
revoke all on function public.register_track_with_state(text,text,text,text,text) from public,anon;
grant execute on function public.register_track_with_state(text,text,text,text,text) to authenticated;

-- The existing UI uses JSON default classes. Copy them in the same transaction
-- as event creation; explicit templates remain supported and validated.
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
      or coalesce(c->>'type','') not in ('fastest_pass','consistency','combined_time','judged_points')) then
      raise exception 'Invalid default class name or scoring format';
    end if;
    insert into public.event_classes(event_id,track_id,name,scoring_type,order_num)
      select v_event_id,p_track_id,trim(c.value->>'name'),(c.value->>'type')::public.scoring_type,c.ordinality::integer
      from jsonb_array_elements(v_defaults) with ordinality c(value,ordinality);
  end if;
  return v_event_id;
end;
$$;
revoke all on function public.create_track_event(uuid,text,date,text,uuid[]) from public,anon;
grant execute on function public.create_track_event(uuid,text,date,text,uuid[]) to authenticated;

-- Bind roster/bonus references to their own series, including direct API writes.
alter table public.series_classes add constraint series_classes_series_id_id_key unique(series_id,id);
alter table public.series_rosters add constraint series_rosters_class_scope_fkey
  foreign key(series_id,series_class_id) references public.series_classes(series_id,id) on delete cascade;
alter table public.series_bonuses add constraint series_bonuses_class_scope_fkey
  foreign key(series_id,series_class_id) references public.series_classes(series_id,id) on delete cascade;

create or replace function public.check_event_series_scope()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.series_id is not null and not exists (
    select 1 from public.series s join public.tracks t on t.organization_id=s.organization_id
    where s.id=new.series_id and t.id=new.track_id
  ) then raise exception 'Event and series must belong to the same organization' using errcode='23514'; end if;
  return new;
end;
$$;
create trigger check_event_series_scope before insert or update of track_id,series_id on public.events
  for each row execute function public.check_event_series_scope();
revoke all on function public.check_event_series_scope() from public,anon,authenticated;

-- Retired application RPCs remain stored for reference, but are not race API
-- endpoints. This allowlist covers the inspected RaceHoller call sites/helpers.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef and p.proname not in (
      'is_org_member','is_org_admin','is_platform_admin','can_view_track','can_edit_track','can_manage_track',
      'register_track','register_track_with_state','create_organization_with_track','create_track_event',
      'create_ghost_track','create_series_with_organization','public_series_organization_name'
    )
  loop execute format('revoke execute on function %s from public,anon,authenticated',f.signature); end loop;
end $$;

-- Migration: Seasons and Points

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.tracks(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

create table if not exists public.season_events (
  season_id uuid not null references public.seasons(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  primary key (season_id, event_id)
);

create table if not exists public.season_points_allocations (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  rank integer not null,
  points integer not null
);

-- RLS
alter table public.seasons enable row level security;
alter table public.season_events enable row level security;
alter table public.season_points_allocations enable row level security;

-- Policies
drop policy if exists seasons_view on public.seasons;
create policy seasons_view on public.seasons for select to authenticated using (
  public.can_view_track(track_id) or public.is_platform_admin()
);
drop policy if exists seasons_edit on public.seasons;
create policy seasons_edit on public.seasons for all to authenticated using (
  public.can_edit_track(track_id) or public.is_platform_admin()
);

drop policy if exists season_events_view on public.season_events;
create policy season_events_view on public.season_events for select to authenticated using (
  exists (select 1 from public.seasons where id = season_id and (public.can_view_track(track_id) or public.is_platform_admin()))
);
drop policy if exists season_events_edit on public.season_events;
create policy season_events_edit on public.season_events for all to authenticated using (
  exists (select 1 from public.seasons where id = season_id and (public.can_edit_track(track_id) or public.is_platform_admin()))
);

drop policy if exists season_points_view on public.season_points_allocations;
create policy season_points_view on public.season_points_allocations for select to authenticated using (
  exists (select 1 from public.seasons where id = season_id and (public.can_view_track(track_id) or public.is_platform_admin()))
);
drop policy if exists season_points_edit on public.season_points_allocations;
create policy season_points_edit on public.season_points_allocations for all to authenticated using (
  exists (select 1 from public.seasons where id = season_id and (public.can_edit_track(track_id) or public.is_platform_admin()))
);

CREATE OR REPLACE FUNCTION public.create_series_with_organization(p_series_name text, p_series_description text, p_org_id uuid DEFAULT NULL::uuid, p_org_name text DEFAULT NULL::text)
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

  -- Create the series
  insert into public.series (organization_id, name, description)
  values (v_target_org_id, trim(p_series_name), nullif(trim(p_series_description), ''))
  returning id into v_series_id;

  -- Default points rule (Rank 1 = 50 pts)
  insert into public.series_points_rules (series_id, rank_start, rank_end, points)
  values (v_series_id, 1, 1, 50);

  return jsonb_build_object(
    'series_id', v_series_id,
    'organization_id', v_target_org_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
INSERT INTO public.profiles (id, is_premium, tier, email)
VALUES (new.id, false, 'free', new.email)
ON CONFLICT (id) DO NOTHING;
RETURN new;
END;
$function$;


revoke all on function public.create_series_with_organization(text,text,uuid,text) from public,anon;
grant execute on function public.create_series_with_organization(text,text,uuid,text) to authenticated;
revoke all on function public.handle_new_user() from public,anon,authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
notify pgrst, 'reload schema';
