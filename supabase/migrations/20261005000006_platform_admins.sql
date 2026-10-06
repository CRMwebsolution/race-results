-- Migration: Platform Admins
-- Create ultra-admin architecture

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Enable RLS on platform_admins
alter table public.platform_admins enable row level security;
create policy select_platform_admins on public.platform_admins
  for select to authenticated using (user_id = auth.uid());

-- Admin check function
create or replace function public.is_platform_admin()
returns boolean
language sql security definer set search_path = public
as $$
  select exists(
    select 1 from auth.users where id = auth.uid() and email = 'cody@southernautomate.com'
  ) or exists(
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

-- Global Admin Access Policies
create policy admin_all_orgs on public.organizations for all to authenticated using (public.is_platform_admin());
create policy admin_all_members on public.organization_memberships for all to authenticated using (public.is_platform_admin());
create policy admin_all_track_members on public.track_memberships for all to authenticated using (public.is_platform_admin());
create policy admin_all_tracks on public.tracks for all to authenticated using (public.is_platform_admin());
create policy admin_all_events on public.events for all to authenticated using (public.is_platform_admin());
create policy admin_all_templates on public.class_templates for all to authenticated using (public.is_platform_admin());
create policy admin_all_classes on public.event_classes for all to authenticated using (public.is_platform_admin());
create policy admin_all_entries on public.entries for all to authenticated using (public.is_platform_admin());
create policy admin_all_attempts on public.attempts for all to authenticated using (public.is_platform_admin());
