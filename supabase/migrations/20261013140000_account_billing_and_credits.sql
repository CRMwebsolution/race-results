-- Migration: Account-Centric Billing, Credits & Entitlements
-- Shifts billing ownership, event credits, and tier subscriptions from ephemeral organizations to User Accounts (profiles).
-- Removes webhook triggers on organizations so admin notifications target accounts directly.

-- 1. Extend public.profiles with account billing columns
alter table public.profiles
  add column if not exists active_tier text not null default 'free',
  add column if not exists event_quota integer not null default 0,
  add column if not exists subscription_end_date timestamptz,
  add column if not exists limits_exempt boolean not null default false,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

-- 2. Backfill profiles from existing organization entitlements
with org_owners as (
  select
    o.id as organization_id,
    coalesce(o.billing_owner_id, m.user_id) as owner_id,
    o.event_quota,
    o.active_tier,
    o.subscription_end_date,
    o.limits_exempt
  from public.organizations o
  left join public.organization_memberships m on m.organization_id = o.id and m.role = 'owner' and m.active
),
aggregated as (
  select
    owner_id,
    sum(event_quota) as total_quota,
    max(subscription_end_date) as max_end_date,
    bool_or(limits_exempt) as any_exempt
  from org_owners
  where owner_id is not null
  group by owner_id
),
best_tiers as (
  select distinct on (owner_id)
    owner_id,
    active_tier
  from org_owners
  where owner_id is not null
  order by owner_id, case active_tier when 'premium' then 3 when 'standard' then 2 when 'event_pass' then 1 else 0 end desc
)
update public.profiles p
set
  event_quota = coalesce(a.total_quota, p.event_quota),
  active_tier = coalesce(bt.active_tier, p.tier, 'free'),
  tier = coalesce(bt.active_tier, p.tier, 'free'),
  subscription_end_date = a.max_end_date,
  limits_exempt = coalesce(a.any_exempt, false),
  is_premium = (coalesce(bt.active_tier, p.tier, 'free') = 'premium')
from aggregated a
left join best_tiers bt on bt.owner_id = a.owner_id
where p.id = a.owner_id;

-- Ensure active_tier matches tier if not already populated
update public.profiles
set active_tier = tier
where active_tier = 'free' and tier <> 'free';

-- 3. Allow platform admins to view all profiles in admin dashboard
drop policy if exists "Platform admins can view all profiles" on public.profiles;
create policy "Platform admins can view all profiles"
  on public.profiles for select
  using (public.is_platform_admin());

-- 4. Update handle_new_user to initialize account billing defaults with 0 credits
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (
    id,
    is_premium,
    tier,
    active_tier,
    event_quota,
    email,
    full_name,
    phone
  )
  values (
    new.id,
    false,
    'free',
    'free',
    0,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

-- 5. Drop the activity webhook on organizations
-- Tracks and Series have their own triggers, and signup triggers on profiles.
-- Eliminates ephemeral organization rows flooding n8n.
drop trigger if exists notify_orgs_webhook on public.organizations;

-- 6. RPC: admin_grant_account_entitlement
-- Grants credits, tiers, and limits exemptions directly to an account (user profile).
create or replace function public.admin_grant_account_entitlement(
  p_user_id uuid,
  p_tier text,
  p_quota integer,
  p_end_date timestamptz default null,
  p_reason text default 'Platform admin grant',
  p_limits_exempt boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  if not public.is_platform_admin()
     and coalesce(auth.jwt()->>'role','') <> 'service_role'
     and current_setting('role', true) <> 'service_role' then
    raise exception 'Only a platform admin can grant access' using errcode = '42501';
  end if;

  if p_tier is null or p_tier not in ('free', 'event_pass', 'standard', 'premium')
     or p_quota is null or p_quota < 0 then
    raise exception 'Choose a valid plan and a non-negative credit count';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception 'Explain the reason for this grant';
  end if;

  if p_tier in ('standard', 'premium') and p_end_date is null and not coalesce(p_limits_exempt, false) then
    raise exception 'A season pass needs an expiration date';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select to_jsonb(p) into v_before from public.profiles p where id = p_user_id for update;
  if not found then
    raise exception 'User account not found';
  end if;

  -- Update profiles table
  update public.profiles
  set active_tier = p_tier,
      tier = p_tier,
      is_premium = (p_tier = 'premium'),
      event_quota = p_quota,
      subscription_end_date = p_end_date,
      limits_exempt = coalesce(p_limits_exempt, false),
      updated_at = now()
  where id = p_user_id;

  -- Synchronize all organizations owned by this account
  update public.organizations
  set active_tier = p_tier,
      event_quota = p_quota,
      subscription_end_date = p_end_date,
      limits_exempt = coalesce(p_limits_exempt, false),
      updated_at = now()
  where billing_owner_id = p_user_id
     or id in (
       select organization_id from public.organization_memberships
       where user_id = p_user_id and role = 'owner' and active
     );

  -- Record audit event
  insert into public.audit_events (
    actor_id,
    action,
    target_type,
    target_id,
    before_data,
    after_data
  )
  values (
    auth.uid(),
    'admin_grant_account_entitlement',
    'account',
    p_user_id,
    v_before,
    jsonb_build_object(
      'user_id', p_user_id,
      'tier', p_tier,
      'remaining_credits', p_quota,
      'expires_at', p_end_date,
      'limits_exempt', p_limits_exempt,
      'reason', trim(p_reason)
    )
  );
end $$;

revoke all on function public.admin_grant_account_entitlement(uuid, text, integer, timestamptz, text, boolean) from public, anon;
grant execute on function public.admin_grant_account_entitlement(uuid, text, integer, timestamptz, text, boolean) to authenticated, service_role;

-- 7. Update legacy admin_grant_entitlement to route through account entitlement
create or replace function public.admin_grant_entitlement(
  p_org_id uuid,
  p_tier text,
  p_quota integer,
  p_end_date timestamptz default null,
  p_reason text default 'Platform admin grant',
  p_limits_exempt boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select coalesce(o.billing_owner_id, m.user_id) into v_user_id
  from public.organizations o
  left join public.organization_memberships m on m.organization_id = o.id and m.role = 'owner' and m.active
  where o.id = p_org_id
  order by m.created_at asc limit 1;

  if v_user_id is not null then
    perform public.admin_grant_account_entitlement(v_user_id, p_tier, p_quota, p_end_date, p_reason, p_limits_exempt);
    insert into public.audit_events (organization_id, actor_id, action, target_type, target_id, after_data)
    values (p_org_id, auth.uid(), 'admin_grant_entitlement', 'organization', p_org_id,
      jsonb_build_object('tier', p_tier, 'remaining_credits', p_quota, 'expires_at', p_end_date, 'limits_exempt', p_limits_exempt, 'reason', trim(p_reason)));
  else
    perform billing_private.admin_grant(p_org_id, p_tier, p_quota, p_end_date, p_reason, p_limits_exempt);
  end if;
end $$;

-- 8. Account Billing Overview RPC
-- Allows promoters to view their account access & credit pool without needing tracks/organizations
create or replace function public.account_billing_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_profile record;
  v_orgs jsonb;
  v_tracks jsonb;
  v_series jsonb;
  v_season_active boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select id, email, full_name, active_tier, event_quota, subscription_end_date, limits_exempt
  into v_profile
  from public.profiles
  where id = v_user_id;

  if not found then
    raise exception 'Account profile not found' using errcode = 'P0002';
  end if;

  v_season_active := coalesce(v_profile.limits_exempt, false)
    or (coalesce(v_profile.active_tier, 'free') in ('standard', 'premium') and v_profile.subscription_end_date > now());

  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug)), '[]'::jsonb)
  into v_tracks
  from public.tracks t
  join public.track_memberships tm on tm.track_id = t.id
  where tm.user_id = v_user_id and tm.active;

  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name)), '[]'::jsonb)
  into v_series
  from public.series s
  join public.organization_memberships om on om.organization_id = s.organization_id
  where om.user_id = v_user_id and om.active and om.role in ('owner', 'admin');

  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name)), '[]'::jsonb)
  into v_orgs
  from public.organizations o
  join public.organization_memberships om on om.organization_id = o.id
  where om.user_id = v_user_id and om.active and om.role in ('owner', 'admin');

  return jsonb_build_object(
    'user_id', v_user_id,
    'email', v_profile.email,
    'full_name', v_profile.full_name,
    'active_tier', coalesce(v_profile.active_tier, 'free'),
    'remaining_credits', coalesce(v_profile.event_quota, 0),
    'subscription_end_date', v_profile.subscription_end_date,
    'limits_exempt', coalesce(v_profile.limits_exempt, false),
    'season_active', v_season_active,
    'tracks', v_tracks,
    'series', v_series,
    'organizations', v_orgs
  );
end $$;

revoke all on function public.account_billing_overview() from public, anon;
grant execute on function public.account_billing_overview() to authenticated;

-- 9. Update check_organization_event_quota to deduct from Account profile
create or replace function public.check_organization_event_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_owner_id uuid;
  v_scope uuid;
  v_credit_org uuid;
  v_tier text;
  v_exempt boolean;
  v_end timestamptz;
  v_quota int;
begin
  if new.status not in ('live', 'completed') then return new; end if;

  select coalesce(t.organization_id, s.organization_id) into v_org
  from (select new.track_id track_id, new.series_id series_id) x
  left join public.tracks t on t.id = x.track_id
  left join public.series s on s.id = x.series_id;

  v_scope := billing_private.scope(v_org);
  if v_scope is null and v_org is null then
    raise exception 'This event needs a track or series';
  end if;

  -- Resolve owner user account
  select coalesce(o.billing_owner_id, m.user_id) into v_owner_id
  from public.organizations o
  left join public.organization_memberships m on m.organization_id = o.id and m.role = 'owner' and m.active
  where o.id = v_org
  order by m.created_at asc limit 1;

  if v_owner_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_owner_id::text, 0));
  elsif v_scope is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_scope::text, 0));
  end if;

  if exists (select 1 from billing_private.event_usage where event_id = new.id) then
    return new;
  end if;

  -- 1. Check account profile first
  if v_owner_id is not null then
    select active_tier, limits_exempt, subscription_end_date, event_quota
    into v_tier, v_exempt, v_end, v_quota
    from public.profiles
    where id = v_owner_id for update;

    -- If profile quota is 0, check if organizations have quota (legacy orgs or test fixtures)
    if coalesce(v_quota, 0) <= 0 then
      select coalesce(sum(event_quota), 0) into v_quota
      from public.organizations
      where id in (select billing_private.org_ids(v_org));
    end if;

    if coalesce(v_exempt, false) or (coalesce(v_tier, 'free') in ('standard', 'premium') and v_end > now()) then
      -- Unlimited season access
      null;
    elsif coalesce(v_quota, 0) > 0 then
      -- Deduct credit from account
      update public.profiles set event_quota = greatest(0, v_quota - 1), updated_at = now() where id = v_owner_id;
      -- Deduct credit from organization with available quota
      select id into v_credit_org from public.organizations
      where id in (select billing_private.org_ids(v_org)) and event_quota > 0
      order by created_at, id for update limit 1;
      if v_credit_org is not null then
        update public.organizations set event_quota = event_quota - 1, updated_at = now() where id = v_credit_org;
      end if;
      v_tier := 'event_pass';
    else
      raise exception 'No event credits remaining. Buy an Event Pass or ask an admin for access before going live.';
    end if;

    insert into billing_private.event_usage(event_id, organization_id, billing_scope, tier, charged)
    values(new.id, v_org, v_owner_id, coalesce(v_tier, 'event_pass'), (v_credit_org is not null));
    return new;
  end if;

  -- 2. Fallback to organization check if no account profile found
  select active_tier, limits_exempt into v_tier, v_exempt from public.organizations
  where id in (select billing_private.org_ids(v_org))
    and (limits_exempt or (active_tier in ('standard', 'premium') and subscription_end_date > now()))
  order by limits_exempt desc, case active_tier when 'premium' then 2 when 'standard' then 1 else 0 end desc limit 1;

  if not found then
    select id into v_credit_org from public.organizations
    where id in (select billing_private.org_ids(v_org)) and event_quota > 0
    order by created_at, id for update limit 1;

    if not found then
      raise exception 'No event credits remaining. Buy an Event Pass or ask an admin for access before going live.';
    end if;

    update public.organizations set event_quota = event_quota - 1, updated_at = now() where id = v_credit_org;
    v_tier := 'event_pass';
  end if;

  insert into billing_private.event_usage(event_id, organization_id, billing_scope, tier, charged)
  values(new.id, v_org, coalesce(v_scope, v_org), v_tier, v_credit_org is not null);
  return new;
end $$;

-- 10. Update payment receipts table and add account payment RPC
alter table billing_private.payment_receipts
  alter column organization_id drop not null,
  add column if not exists user_id uuid references public.profiles(id);

create or replace function billing_private.apply_account_payment(
  p_session_id text,
  p_stripe_event_id text,
  p_user_id uuid,
  p_tier text,
  p_amount integer,
  p_currency text,
  p_notification jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted text;
  v_end timestamptz;
  v_premium boolean;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' and current_setting('role', true) <> 'service_role' then
    raise exception 'Payment service required' using errcode = '42501';
  end if;

  if nullif(p_session_id, '') is null
     or nullif(p_stripe_event_id, '') is null
     or p_tier not in ('event_pass', 'standard', 'premium')
     or p_currency <> 'usd'
     or p_amount <> (case p_tier when 'event_pass' then 5000 when 'standard' then 20000 when 'premium' then 25000 end) then
    raise exception 'Invalid payment details';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  perform 1 from public.profiles where id = p_user_id for update;
  if not found then raise exception 'User profile not found'; end if;

  insert into billing_private.payment_receipts(session_id, stripe_event_id, organization_id, user_id, tier, amount, currency, notification)
  values(p_session_id, p_stripe_event_id, null, p_user_id, p_tier, p_amount, p_currency, p_notification)
  on conflict do nothing returning session_id into v_inserted;

  if v_inserted is null then return false; end if;

  if p_tier = 'event_pass' then
    update public.profiles
    set event_quota = event_quota + 1,
        active_tier = case when active_tier = 'free' then 'event_pass' else active_tier end,
        updated_at = now()
    where id = p_user_id;

    -- Sync to user's organizations
    update public.organizations
    set event_quota = event_quota + 1,
        active_tier = case when active_tier = 'free' then 'event_pass' else active_tier end,
        updated_at = now()
    where billing_owner_id = p_user_id;
  else
    select subscription_end_date, (active_tier = 'premium' and subscription_end_date > now())
    into v_end, v_premium
    from public.profiles where id = p_user_id;

    update public.profiles
    set active_tier = case when v_premium then 'premium' else p_tier end,
        is_premium = (case when v_premium then true else (p_tier = 'premium') end),
        subscription_end_date = greatest(now(), coalesce(v_end, now())) + interval '1 year',
        updated_at = now()
    where id = p_user_id;

    -- Sync to organizations
    update public.organizations
    set active_tier = case when v_premium then 'premium' else p_tier end,
        subscription_end_date = greatest(now(), coalesce(v_end, now())) + interval '1 year',
        updated_at = now()
    where billing_owner_id = p_user_id;
  end if;

  insert into public.audit_events(actor_id, action, target_type, target_id, after_data)
  values(p_user_id, 'paid_account_entitlement', 'account', p_user_id, jsonb_build_object('session_id', p_session_id, 'tier', p_tier, 'amount', p_amount));

  return true;
end $$;

create or replace function public.apply_paid_account_entitlement(
  p_session_id text,
  p_stripe_event_id text,
  p_user_id uuid,
  p_tier text,
  p_amount integer,
  p_currency text,
  p_notification jsonb
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select billing_private.apply_account_payment(p_session_id, p_stripe_event_id, p_user_id, p_tier, p_amount, p_currency, p_notification);
$$;

revoke all on function public.apply_paid_account_entitlement(text, text, uuid, text, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_paid_account_entitlement(text, text, uuid, text, integer, text, jsonb) to service_role;

-- Synchronize billing_private.apply_payment to also update owning profile
create or replace function billing_private.apply_payment(
  p_session_id text, p_stripe_event_id text, p_org_id uuid, p_tier text, p_amount integer, p_currency text, p_notification jsonb
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_inserted text; v_end timestamptz; v_premium boolean; v_user_id uuid;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' and current_setting('role', true) <> 'service_role' then
    raise exception 'Payment service required' using errcode = '42501';
  end if;
  if nullif(p_session_id,'') is null or nullif(p_stripe_event_id,'') is null or p_tier not in ('event_pass','standard','premium') or p_currency <> 'usd'
     or p_amount <> (case p_tier when 'event_pass' then 5000 when 'standard' then 20000 when 'premium' then 25000 end) then
    raise exception 'Invalid payment details';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(billing_private.scope(p_org_id)::text, 0));
  perform 1 from public.organizations where id = p_org_id for update;
  if not found then raise exception 'Organization not found'; end if;

  select coalesce(o.billing_owner_id, m.user_id) into v_user_id from public.organizations o
  left join public.organization_memberships m on m.organization_id = o.id and m.role = 'owner' and m.active
  where o.id = p_org_id order by m.created_at asc limit 1;

  insert into billing_private.payment_receipts(session_id, stripe_event_id, organization_id, user_id, tier, amount, currency, notification)
  values(p_session_id, p_stripe_event_id, p_org_id, v_user_id, p_tier, p_amount, p_currency, p_notification)
  on conflict do nothing returning session_id into v_inserted;
  if v_inserted is null then return false; end if;

  if p_tier = 'event_pass' then
    update public.organizations set event_quota = event_quota + 1,
      active_tier = case when active_tier = 'free' then 'event_pass' else active_tier end, updated_at = now() where id = p_org_id;
    if v_user_id is not null then
      update public.profiles set event_quota = event_quota + 1,
        active_tier = case when active_tier = 'free' then 'event_pass' else active_tier end, updated_at = now() where id = v_user_id;
    end if;
  else
    select max(subscription_end_date), bool_or(active_tier = 'premium' and subscription_end_date > now()) into v_end, v_premium
    from public.organizations where id in (select billing_private.org_ids(p_org_id));
    update public.organizations set active_tier = case when v_premium then 'premium' else p_tier end,
      subscription_end_date = greatest(now(), coalesce(v_end, now())) + interval '1 year', updated_at = now()
    where id in (select billing_private.org_ids(p_org_id));
    if v_user_id is not null then
      update public.profiles set active_tier = case when v_premium then 'premium' else p_tier end,
        is_premium = case when v_premium then true else (p_tier = 'premium') end,
        subscription_end_date = greatest(now(), coalesce(v_end, now())) + interval '1 year', updated_at = now() where id = v_user_id;
    end if;
  end if;

  insert into public.audit_events(organization_id, action, target_type, target_id, after_data)
  values(p_org_id, 'paid_entitlement', 'organization', p_org_id, jsonb_build_object('session_id', p_session_id, 'tier', p_tier, 'amount', p_amount));
  return true;
end $$;

notify pgrst, 'reload schema';

