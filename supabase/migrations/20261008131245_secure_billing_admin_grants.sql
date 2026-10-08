-- Billing fields are writable only through checked billing functions.
alter table public.organizations add column if not exists limits_exempt boolean not null default false;
alter table public.organizations add constraint organizations_billing_tier_check check (active_tier in ('free','event_pass','standard','premium'));
alter table public.organizations add constraint organizations_billing_quota_check check (event_quota >= 0);
revoke insert, update on public.organizations from anon, authenticated;
grant update (name, billing_email, updated_at) on public.organizations to authenticated;

create schema if not exists billing_private;
revoke all on schema billing_private from public, anon;
grant usage on schema billing_private to authenticated, service_role;

create or replace function billing_private.admin_grant(
 p_org_id uuid, p_tier text, p_quota integer, p_end_date timestamptz, p_reason text, p_limits_exempt boolean
) returns void language plpgsql security definer set search_path='' as $$
declare v_before jsonb;
begin
 if not public.is_platform_admin() then raise exception 'Only a platform admin can grant access' using errcode='42501'; end if;
 if p_tier is null or p_tier not in ('free','event_pass','standard','premium') or p_quota is null or p_quota<0 then raise exception 'Choose a valid plan and a non-negative credit count'; end if;
 if nullif(trim(p_reason),'') is null then raise exception 'Explain the reason for this grant'; end if;
 if p_tier in ('standard','premium') and p_end_date is null and not coalesce(p_limits_exempt,false) then raise exception 'A season pass needs an expiration date'; end if;
 select to_jsonb(o) into v_before from public.organizations o where id=p_org_id for update;
 if not found then raise exception 'Organization not found'; end if;
 update public.organizations set active_tier=p_tier,event_quota=p_quota,subscription_end_date=p_end_date,limits_exempt=coalesce(p_limits_exempt,false),updated_at=now() where id=p_org_id;
 insert into public.audit_events(organization_id,actor_id,action,target_type,target_id,before_data,after_data)
 values(p_org_id,auth.uid(),'admin_grant_entitlement','organization',p_org_id,v_before,jsonb_build_object('tier',p_tier,'remaining_credits',p_quota,'expires_at',p_end_date,'limits_exempt',p_limits_exempt,'reason',trim(p_reason)));
end $$;
revoke all on function billing_private.admin_grant(uuid,text,integer,timestamptz,text,boolean) from public,anon,service_role;
grant execute on function billing_private.admin_grant(uuid,text,integer,timestamptz,text,boolean) to authenticated;

create or replace function public.admin_grant_entitlement(
 p_org_id uuid,p_tier text,p_quota integer,p_end_date timestamptz,p_reason text,p_limits_exempt boolean default false
) returns void language sql security invoker set search_path='' as $$
 select billing_private.admin_grant(p_org_id,p_tier,p_quota,p_end_date,p_reason,p_limits_exempt);
$$;
revoke all on function public.admin_grant_entitlement(uuid,text,integer,timestamptz,text,boolean) from public,anon,service_role;
grant execute on function public.admin_grant_entitlement(uuid,text,integer,timestamptz,text,boolean) to authenticated;

create or replace function public.grant_organization_entitlement(p_org_id uuid,p_tier text,p_quota integer,p_end_date timestamptz)
returns void language sql security invoker set search_path='' as $$
 select billing_private.admin_grant(p_org_id,p_tier,p_quota,p_end_date,'Legacy platform admin grant',false);
$$;
revoke all on function public.grant_organization_entitlement(uuid,text,integer,timestamptz) from public,anon,service_role;
grant execute on function public.grant_organization_entitlement(uuid,text,integer,timestamptz) to authenticated;
