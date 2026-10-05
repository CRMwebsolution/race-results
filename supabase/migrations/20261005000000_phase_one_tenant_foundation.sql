-- Phase One: Tenant Foundation, Memberships, Track Isolation, and Audit Events
-- Specification: docs/PRODUCT_BLUEPRINT.md

-- 1. Create Organizations table
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  billing_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Create Tracks table
create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracks_organization_id_id_key unique (organization_id, id),
  constraint tracks_slug_key unique (slug)
);

-- 3. Create Organization Memberships table
create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_memberships_org_user_key unique (organization_id, user_id)
);

-- 4. Create Track Memberships table
create table if not exists public.track_memberships (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.tracks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'administrator', 'official', 'judge', 'read_only')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint track_memberships_track_user_key unique (track_id, user_id)
);

-- 5. Create Audit Events table
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  track_id uuid references public.tracks(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

-- 6. Performance Indexes (covering foreign keys and queries)
create index if not exists idx_tracks_organization_id on public.tracks (organization_id);
create index if not exists idx_org_memberships_user_id on public.organization_memberships (user_id);
create index if not exists idx_org_memberships_org_id on public.organization_memberships (organization_id);
create index if not exists idx_track_memberships_user_id on public.track_memberships (user_id);
create index if not exists idx_track_memberships_track_id on public.track_memberships (track_id);
create index if not exists idx_audit_events_org_created on public.audit_events (organization_id, created_at desc);
create index if not exists idx_audit_events_track_created on public.audit_events (track_id, created_at desc);
create index if not exists idx_audit_events_actor on public.audit_events (actor_id);

-- 7. Security Definer Authorization Functions with strict search_path
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = p_org_id
      and m.user_id = auth.uid()
      and m.active = true
  );
$$;

create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = p_org_id
      and m.user_id = auth.uid()
      and m.active = true
      and m.role in ('owner', 'admin')
  );
$$;

create or replace function public.can_view_track(p_track_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.track_memberships tm
    where tm.track_id = p_track_id
      and tm.user_id = auth.uid()
      and tm.active = true
  ) or exists (
    select 1
    from public.tracks t
    join public.organization_memberships om on om.organization_id = t.organization_id
    where t.id = p_track_id
      and om.user_id = auth.uid()
      and om.active = true
  );
$$;

create or replace function public.can_edit_track(p_track_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.track_memberships tm
    where tm.track_id = p_track_id
      and tm.user_id = auth.uid()
      and tm.active = true
      and tm.role in ('owner', 'administrator', 'official')
  ) or exists (
    select 1
    from public.tracks t
    join public.organization_memberships om on om.organization_id = t.organization_id
    where t.id = p_track_id
      and om.user_id = auth.uid()
      and om.active = true
      and om.role in ('owner', 'admin')
  );
$$;

-- Revoke execute from anon/public and grant to authenticated
revoke execute on function public.is_org_member(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;

revoke execute on function public.is_org_admin(uuid) from public, anon;
grant execute on function public.is_org_admin(uuid) to authenticated;

revoke execute on function public.can_view_track(uuid) from public, anon;
grant execute on function public.can_view_track(uuid) to authenticated;

revoke execute on function public.can_edit_track(uuid) from public, anon;
grant execute on function public.can_edit_track(uuid) to authenticated;

-- 8. Row Level Security Policies

-- Enable RLS on every table
alter table public.organizations enable row level security;
alter table public.tracks enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.track_memberships enable row level security;
alter table public.audit_events enable row level security;

-- organizations policies
create policy org_select on public.organizations
  for select to authenticated
  using (public.is_org_member(id));

create policy org_update on public.organizations
  for update to authenticated
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

create policy org_insert on public.organizations
  for insert to authenticated
  with check (true);

-- tracks policies
create policy track_select on public.tracks
  for select to authenticated
  using (public.can_view_track(id));

create policy track_insert on public.tracks
  for insert to authenticated
  with check (public.is_org_admin(organization_id));

create policy track_update on public.tracks
  for update to authenticated
  using (public.can_edit_track(id))
  with check (public.can_edit_track(id));

create policy track_delete on public.tracks
  for delete to authenticated
  using (public.is_org_admin(organization_id));

-- organization_memberships policies
create policy org_mem_select on public.organization_memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_org_admin(organization_id));

create policy org_mem_insert on public.organization_memberships
  for insert to authenticated
  with check (user_id = (select auth.uid()) or public.is_org_admin(organization_id));

create policy org_mem_update on public.organization_memberships
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy org_mem_delete on public.organization_memberships
  for delete to authenticated
  using (public.is_org_admin(organization_id) and user_id <> (select auth.uid()));

-- track_memberships policies
create policy track_mem_select on public.track_memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or public.can_edit_track(track_id));

create policy track_mem_insert on public.track_memberships
  for insert to authenticated
  with check (public.can_edit_track(track_id));

create policy track_mem_update on public.track_memberships
  for update to authenticated
  using (public.can_edit_track(track_id))
  with check (public.can_edit_track(track_id));

create policy track_mem_delete on public.track_memberships
  for delete to authenticated
  using (public.can_edit_track(track_id) and user_id <> (select auth.uid()));

-- audit_events policies
create policy audit_select on public.audit_events
  for select to authenticated
  using (
    (organization_id is not null and public.is_org_admin(organization_id))
    or (track_id is not null and public.can_edit_track(track_id))
  );

create policy audit_insert on public.audit_events
  for insert to authenticated
  with check (actor_id = (select auth.uid()));

-- 9. Transactional Onboarding Procedure (atomic creation of org, track, memberships, and audit)
create or replace function public.create_organization_with_track(
  p_org_name text,
  p_billing_email text,
  p_track_name text,
  p_track_slug text,
  p_timezone text default 'America/New_York'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_track_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if trim(p_org_name) = '' or trim(p_billing_email) = '' or trim(p_track_name) = '' or trim(p_track_slug) = '' then
    raise exception 'All fields are required';
  end if;

  -- 1. Insert organization
  insert into public.organizations (name, billing_email)
  values (trim(p_org_name), trim(p_billing_email))
  returning id into v_org_id;

  -- 2. Insert organization owner membership
  insert into public.organization_memberships (organization_id, user_id, role, active)
  values (v_org_id, v_user_id, 'owner', true);

  -- 3. Insert track
  insert into public.tracks (organization_id, slug, name, timezone)
  values (v_org_id, lower(trim(p_track_slug)), trim(p_track_name), coalesce(p_timezone, 'America/New_York'))
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
    'create_organization_and_track',
    'organization',
    v_org_id,
    jsonb_build_object(
      'organization_id', v_org_id,
      'org_name', p_org_name,
      'track_id', v_track_id,
      'track_slug', lower(trim(p_track_slug)),
      'track_name', p_track_name
    )
  );

  return jsonb_build_object(
    'organization_id', v_org_id,
    'track_id', v_track_id,
    'slug', lower(trim(p_track_slug)),
    'status', 'success'
  );
end;
$$;

revoke execute on function public.create_organization_with_track(text, text, text, text, text) from public, anon;
grant execute on function public.create_organization_with_track(text, text, text, text, text) to authenticated;

-- 10. Explicit Data API Grants
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.organizations to authenticated;
grant select, insert, update, delete on public.tracks to authenticated;
grant select, insert, update, delete on public.organization_memberships to authenticated;
grant select, insert, update, delete on public.track_memberships to authenticated;
grant select, insert on public.audit_events to authenticated;
