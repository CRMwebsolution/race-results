-- Migration: Cascade deletions and admin delete functions
-- Provides platform admins the ability to delete events, organizations, series, tracks, and accounts
-- with strict confirmation fail-safes and robust on delete cascade guarantees.

-- 1. Ensure on delete cascade / set null on all dependent tables

-- payment_receipts
alter table billing_private.payment_receipts drop constraint if exists payment_receipts_organization_id_fkey;
alter table billing_private.payment_receipts add constraint payment_receipts_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete set null;

alter table billing_private.payment_receipts drop constraint if exists payment_receipts_user_id_fkey;
alter table billing_private.payment_receipts add constraint payment_receipts_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

-- event_usage (cleaned up via trigger to allow BEFORE INSERT status triggers on events)
alter table billing_private.event_usage drop constraint if exists event_usage_event_id_fkey;
alter table billing_private.event_usage drop constraint if exists event_usage_organization_id_fkey;

-- race_staff_invitations
alter table public.race_staff_invitations drop constraint if exists race_staff_invitations_created_by_fkey;
alter table public.race_staff_invitations add constraint race_staff_invitations_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete cascade;

alter table public.race_staff_invitations drop constraint if exists race_staff_invitations_accepted_by_fkey;
alter table public.race_staff_invitations add constraint race_staff_invitations_accepted_by_fkey
  foreign key (accepted_by) references auth.users(id) on delete set null;

-- judge_assignments
alter table public.judge_assignments drop constraint if exists judge_assignments_user_id_fkey;
alter table public.judge_assignments add constraint judge_assignments_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- events -> competition_seasons
alter table public.events drop constraint if exists events_competition_season_id_fkey;
alter table public.events add constraint events_competition_season_id_fkey
  foreign key (competition_season_id) references public.competition_seasons(id) on delete set null;

-- event_classes -> competition_classes
alter table public.event_classes drop constraint if exists event_classes_competition_class_id_fkey;
alter table public.event_classes add constraint event_classes_competition_class_id_fkey
  foreign key (competition_class_id) references public.competition_classes(id) on delete set null;

-- event_classes -> series_classes
alter table public.event_classes drop constraint if exists event_classes_series_class_id_fkey;
alter table public.event_classes add constraint event_classes_series_class_id_fkey
  foreign key (series_class_id) references public.series_classes(id) on delete set null;

-- event_classes -> class_templates
alter table public.event_classes drop constraint if exists event_classes_template_id_fkey;
alter table public.event_classes add constraint event_classes_template_id_fkey
  foreign key (template_id) references public.class_templates(id) on delete set null;

-- entries -> competition_registrations
alter table public.entries drop constraint if exists entries_registration_id_fkey;
alter table public.entries add constraint entries_registration_id_fkey
  foreign key (registration_id) references public.competition_registrations(id) on delete set null;

-- competition_classes -> series_classes & class_templates
alter table public.competition_classes drop constraint if exists competition_classes_series_class_id_fkey;
alter table public.competition_classes add constraint competition_classes_series_class_id_fkey
  foreign key (series_class_id) references public.series_classes(id) on delete set null;

alter table public.competition_classes drop constraint if exists competition_classes_template_id_fkey;
alter table public.competition_classes add constraint competition_classes_template_id_fkey
  foreign key (template_id) references public.class_templates(id) on delete set null;

-- competition_points_changes
alter table public.competition_points_changes drop constraint if exists competition_points_changes_season_id_fkey;
alter table public.competition_points_changes add constraint competition_points_changes_season_id_fkey
  foreign key (season_id) references public.competition_seasons(id) on delete cascade;

alter table public.competition_points_changes drop constraint if exists competition_points_changes_season_id_registration_id_fkey;
alter table public.competition_points_changes add constraint competition_points_changes_season_id_registration_id_fkey
  foreign key (season_id, registration_id) references public.competition_registrations(season_id, id) on delete cascade;

-- competition_result_versions
alter table public.competition_result_versions drop constraint if exists competition_result_versions_season_id_fkey;
alter table public.competition_result_versions add constraint competition_result_versions_season_id_fkey
  foreign key (season_id) references public.competition_seasons(id) on delete cascade;

-- competition_points_rules
alter table public.competition_points_rules drop constraint if exists competition_points_rules_season_id_fkey;
alter table public.competition_points_rules add constraint competition_points_rules_season_id_fkey
  foreign key (season_id) references public.competition_seasons(id) on delete cascade;

-- competition_bonuses
alter table public.competition_bonuses drop constraint if exists competition_bonuses_season_id_fkey;
alter table public.competition_bonuses add constraint competition_bonuses_season_id_fkey
  foreign key (season_id) references public.competition_seasons(id) on delete cascade;

-- 2. Deletion triggers to bypass lock checks and clean up auxiliary records during cascade
create or replace function public.set_deleting_parent()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('raceholler.deleting_parent', 'true', true);
  if tg_table_name = 'events' then
    delete from billing_private.event_usage where event_id = old.id;
  elsif tg_table_name = 'organizations' then
    delete from billing_private.event_usage where organization_id = old.id;
  end if;
  return old;
end;
$$;

drop trigger if exists set_deleting_organization on public.organizations;
create trigger set_deleting_organization
  before delete on public.organizations
  for each row execute function public.set_deleting_parent();

drop trigger if exists set_deleting_profiles on public.profiles;
create trigger set_deleting_profiles
  before delete on public.profiles
  for each row execute function public.set_deleting_parent();

-- 2b. Ensure check_organization_asset_limits respects account profile entitlement
create or replace function public.check_organization_asset_limits()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_scope uuid;
  v_tier text;
  v_exempt boolean;
  v_tracks integer;
  v_series integer;
begin
  v_scope := billing_private.scope(new.organization_id);
  if v_scope is null then raise exception 'Organization not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_scope::text, 0));

  select active_tier, limits_exempt into v_tier, v_exempt
  from public.profiles where id = v_scope
    and (limits_exempt or (active_tier in ('standard', 'premium') and (subscription_end_date is null or subscription_end_date > now())));

  if v_tier is null then
    select active_tier, limits_exempt into v_tier, v_exempt
    from public.organizations where id in (select billing_private.org_ids(new.organization_id))
    order by limits_exempt desc,
    case when active_tier in ('standard', 'premium') and subscription_end_date > now()
         then case active_tier when 'premium' then 3 else 2 end else 1 end desc limit 1;
  end if;

  if coalesce(v_exempt, false) then return new; end if;
  if v_tier is null then v_tier := 'free'; end if;

  select count(*) into v_tracks from public.tracks where (TG_TABLE_NAME <> 'tracks' or id <> new.id) and organization_id in (select billing_private.org_ids(new.organization_id));
  select count(*) into v_series from public.series where (TG_TABLE_NAME <> 'series' or id <> new.id) and organization_id in (select billing_private.org_ids(new.organization_id));

  if TG_TABLE_NAME = 'tracks' then v_tracks := v_tracks + 1; else v_series := v_series + 1; end if;

  if v_tier = 'standard' and (v_tracks > 3 or v_series > 3 or (v_tracks > 0 and v_series > 0)) then
    raise exception 'Standard allows up to 3 Tracks OR 3 Series across your account. Premium allows both.';
  end if;
  if v_tier = 'premium' and (v_tracks > 3 or v_series > 3) then
    raise exception 'Premium allows up to 3 Tracks and 3 Series across your account.';
  end if;
  if v_tier in ('free', 'event_pass') and (v_tracks > 1 or v_series > 1) then
    raise exception 'This plan allows 1 Track and 1 Series across your account. Upgrade to add more.';
  end if;
  return new;
end $$;
revoke all on function public.check_organization_asset_limits() from public,anon,authenticated;

-- 3. Platform Admin RPC Functions with typed-name validation

-- Delete Event
create or replace function public.admin_delete_event(p_event_id uuid, p_confirm_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform administrators can delete events' using errcode = '42501';
  end if;
  select name into v_name from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if lower(trim(v_name)) <> lower(trim(coalesce(p_confirm_name, ''))) then
    raise exception 'Confirmation name does not match event name "%"', v_name;
  end if;

  perform set_config('raceholler.deleting_parent', 'true', true);
  delete from billing_private.event_usage where event_id = p_event_id;
  delete from public.events where id = p_event_id;
  return jsonb_build_object('success', true, 'id', p_event_id, 'name', v_name);
end;
$$;

-- Delete Track
create or replace function public.admin_delete_track(p_track_id uuid, p_confirm_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform administrators can delete tracks' using errcode = '42501';
  end if;
  select name into v_name from public.tracks where id = p_track_id for update;
  if not found then
    raise exception 'Track not found' using errcode = 'P0002';
  end if;
  if lower(trim(v_name)) <> lower(trim(coalesce(p_confirm_name, ''))) then
    raise exception 'Confirmation name does not match track name "%"', v_name;
  end if;

  perform set_config('raceholler.deleting_parent', 'true', true);
  delete from public.tracks where id = p_track_id;
  return jsonb_build_object('success', true, 'id', p_track_id, 'name', v_name);
end;
$$;

-- Delete Series
create or replace function public.admin_delete_series(p_series_id uuid, p_confirm_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform administrators can delete series' using errcode = '42501';
  end if;
  select name into v_name from public.series where id = p_series_id for update;
  if not found then
    raise exception 'Series not found' using errcode = 'P0002';
  end if;
  if lower(trim(v_name)) <> lower(trim(coalesce(p_confirm_name, ''))) then
    raise exception 'Confirmation name does not match series name "%"', v_name;
  end if;

  perform set_config('raceholler.deleting_parent', 'true', true);
  delete from public.series where id = p_series_id;
  return jsonb_build_object('success', true, 'id', p_series_id, 'name', v_name);
end;
$$;

-- Delete Organization
create or replace function public.admin_delete_organization(p_org_id uuid, p_confirm_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform administrators can delete organizations' using errcode = '42501';
  end if;
  select name into v_name from public.organizations where id = p_org_id for update;
  if not found then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;
  if lower(trim(v_name)) <> lower(trim(coalesce(p_confirm_name, ''))) then
    raise exception 'Confirmation name does not match organization name "%"', v_name;
  end if;

  perform set_config('raceholler.deleting_parent', 'true', true);
  delete from public.organizations where id = p_org_id;
  return jsonb_build_object('success', true, 'id', p_org_id, 'name', v_name);
end;
$$;

-- Delete Account
create or replace function public.admin_delete_account(
  p_user_id uuid,
  p_confirm_name text,
  p_cascade_organizations boolean default true
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_full_name text;
  v_org_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform administrators can delete accounts' using errcode = '42501';
  end if;
  if auth.uid() is not null and auth.uid() = p_user_id then
    raise exception 'Admins cannot delete their own active account';
  end if;

  select email, full_name into v_email, v_full_name from public.profiles where id = p_user_id for update;
  if v_email is null then
    select email into v_email from auth.users where id = p_user_id;
  end if;
  if v_email is null then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;

  if lower(trim(coalesce(p_confirm_name, ''))) not in (
    lower(trim(v_email)),
    lower(trim(coalesce(v_full_name, '')))
  ) then
    raise exception 'Confirmation name does not match account email ("%")', v_email;
  end if;

  perform set_config('raceholler.deleting_parent', 'true', true);

  -- Cascade organizations owned by this account if requested
  if p_cascade_organizations then
    for v_org_id in (
      select id from public.organizations
      where billing_owner_id = p_user_id
         or id in (select organization_id from public.organization_memberships where user_id = p_user_id and role = 'owner')
    ) loop
      delete from public.organizations where id = v_org_id;
    end loop;
  end if;

  delete from public.profiles where id = p_user_id;
  return jsonb_build_object('success', true, 'id', p_user_id, 'email', v_email);
end;
$$;

-- Grant permissions
revoke all on function public.admin_delete_event(uuid, text) from public, anon;
grant execute on function public.admin_delete_event(uuid, text) to authenticated, service_role;

revoke all on function public.admin_delete_track(uuid, text) from public, anon;
grant execute on function public.admin_delete_track(uuid, text) to authenticated, service_role;

revoke all on function public.admin_delete_series(uuid, text) from public, anon;
grant execute on function public.admin_delete_series(uuid, text) to authenticated, service_role;

revoke all on function public.admin_delete_organization(uuid, text) from public, anon;
grant execute on function public.admin_delete_organization(uuid, text) to authenticated, service_role;

revoke all on function public.admin_delete_account(uuid, text, boolean) from public, anon;
grant execute on function public.admin_delete_account(uuid, text, boolean) to authenticated, service_role;
