-- Keep onboarding atomic through the existing authenticated RPCs; never allow
-- callers to bootstrap ownership by inserting themselves into an arbitrary org.
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists (select 1 from auth.users where id = auth.uid()
      and email = 'cody@southernautomate.com' and email_confirmed_at is not null)
    or exists (select 1 from public.platform_admins where user_id = auth.uid())
  );
$$;
revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to anon, authenticated;
alter function public.is_org_member(uuid) set search_path = '';
alter function public.is_org_admin(uuid) set search_path = '';

create or replace function public.can_view_track(p_track_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_platform_admin() or exists (
    select 1 from public.track_memberships tm where tm.track_id = p_track_id
      and tm.user_id = auth.uid() and tm.active
  ) or exists (
    select 1 from public.tracks t join public.organization_memberships om on om.organization_id = t.organization_id
    where t.id = p_track_id and om.user_id = auth.uid() and om.active
  );
$$;
create or replace function public.can_edit_track(p_track_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_platform_admin() or exists (
    select 1 from public.track_memberships tm where tm.track_id = p_track_id
      and tm.user_id = auth.uid() and tm.active and tm.role in ('owner','administrator','official')
  ) or exists (
    select 1 from public.tracks t where t.id = p_track_id and public.is_org_admin(t.organization_id)
  );
$$;

alter policy org_mem_insert on public.organization_memberships
  with check (public.is_org_admin(organization_id));
revoke insert on public.organizations from authenticated;

create or replace function public.can_manage_track(p_track_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_platform_admin() or exists (
    select 1 from public.track_memberships tm
    where tm.track_id = p_track_id and tm.user_id = auth.uid()
      and tm.active and tm.role in ('owner', 'administrator')
  ) or exists (
    select 1 from public.tracks t
    where t.id = p_track_id and public.is_org_admin(t.organization_id)
  );
$$;
revoke all on function public.can_manage_track(uuid) from public, anon;
grant execute on function public.can_manage_track(uuid) to authenticated;

-- Officials can enter results, but cannot grant themselves or others ownership.
alter policy track_mem_insert on public.track_memberships
  with check (public.can_manage_track(track_id));
alter policy track_mem_update on public.track_memberships
  using (public.can_manage_track(track_id))
  with check (public.can_manage_track(track_id));
alter policy track_mem_delete on public.track_memberships
  using (public.can_manage_track(track_id) and user_id <> auth.uid());
alter policy track_update on public.tracks
  using (public.can_manage_track(id)) with check (public.can_manage_track(id));

create or replace function public.check_track_organization_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.organization_id is distinct from old.organization_id
     and not (public.is_platform_admin() or public.is_org_admin(new.organization_id)) then
    raise exception 'Not authorized to transfer this track' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger check_track_organization_change before update on public.tracks
  for each row execute function public.check_track_organization_change();
revoke all on function public.check_track_organization_change() from public, anon, authenticated;

create or replace function public.create_ghost_track(
  p_org_id uuid, p_name text, p_slug text, p_timezone text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_track_id uuid;
begin
  if auth.uid() is null or not (public.is_org_admin(p_org_id) or public.is_platform_admin()) then
    raise exception 'Not authorized to create tracks in this organization' using errcode = '42501';
  end if;
  if nullif(trim(p_name), '') is null or nullif(trim(p_slug), '') is null then
    raise exception 'Track name and slug are required';
  end if;
  insert into public.tracks (organization_id, name, slug, timezone)
    values (p_org_id, trim(p_name), trim(p_slug), p_timezone) returning id into v_track_id;
  insert into public.track_memberships (track_id, user_id, role, active)
    values (v_track_id, auth.uid(), 'owner', true);
  return v_track_id;
end;
$$;
revoke all on function public.create_ghost_track(uuid, text, text, text) from public, anon;
grant execute on function public.create_ghost_track(uuid, text, text, text) to authenticated;
revoke all on function public.create_track_event(uuid, text, date, text, uuid[]) from public, anon;
grant execute on function public.create_track_event(uuid, text, date, text, uuid[]) to authenticated;

-- Public policies invoke can_view_track even for anonymous requests. Its result
-- is strictly scoped to auth.uid(), so granting execution does not expose rows.
grant execute on function public.can_view_track(uuid) to anon;
alter policy track_select_public on public.tracks using (
  exists (select 1 from public.events e where e.track_id = tracks.id
    and (e.status = 'scheduled' or
      (e.status in ('live', 'completed') and coalesce(e.published_revision, 0) > 0)))
);
alter policy events_select on public.events using (
  public.can_view_track(track_id) or public.is_platform_admin() or status = 'scheduled'
  or (status in ('live', 'completed') and coalesce(published_revision, 0) > 0)
);
grant select on public.tracks, public.events, public.event_classes,
  public.entries, public.attempts, public.series, public.series_classes,
  public.series_rosters, public.series_points_rules, public.series_bonuses to anon;

-- Only self/private profile access is currently required. Future public racer
-- profiles must expose an explicit safe projection rather than this whole table.
drop policy if exists "Public can view basic profiles" on public.profiles;
revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, home_track_id) on public.profiles to authenticated;

-- Audit writes originate in checked RPCs, not arbitrary client-supplied JSON.
revoke insert, update, delete on public.audit_events from authenticated;

-- Return only the public promoter name; do not open organizations/billing_email.
create or replace function public.public_series_organization_name(p_series_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select o.name from public.organizations o
    join public.series s on s.organization_id = o.id where s.id = p_series_id;
$$;
revoke all on function public.public_series_organization_name(uuid) from public;
grant execute on function public.public_series_organization_name(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
