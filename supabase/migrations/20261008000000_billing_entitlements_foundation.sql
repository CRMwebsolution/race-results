-- Phase 4: Billing and Entitlements Foundation

-- 1. Add billing fields to organizations
alter table public.organizations
add column if not exists stripe_customer_id text unique,
add column if not exists active_tier text not null default 'free',
add column if not exists event_quota integer not null default 0,
add column if not exists subscription_end_date timestamptz;

-- The allowed tiers will be:
-- 'free' (default, maybe 1 trial event)
-- 'event_pass' (pay per event)
-- 'standard' (Track OR Series subscription, max 3)
-- 'premium' (Track AND Series subscription, max 3 each)

-- 2. Create an admin RPC to grant entitlements
create or replace function public.grant_organization_entitlement(
  p_org_id uuid,
  p_tier text,
  p_quota integer,
  p_end_date timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Unauthorized: Only platform admins can grant entitlements';
  end if;

  update public.organizations
  set active_tier = p_tier,
      event_quota = p_quota,
      subscription_end_date = p_end_date,
      updated_at = now()
  where id = p_org_id;
end;
$$;
