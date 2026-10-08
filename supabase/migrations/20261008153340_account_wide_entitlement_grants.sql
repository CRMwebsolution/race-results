create or replace function billing_private.admin_grant(
 p_org_id uuid, p_tier text, p_quota integer, p_end_date timestamptz, p_reason text, p_limits_exempt boolean
) returns void language plpgsql security definer set search_path='' as $$
declare v_before jsonb;
begin
 if not public.is_platform_admin() then raise exception 'Only a platform admin can grant access' using errcode='42501'; end if;
 if p_tier is null or p_tier not in ('free','event_pass','standard','premium') or p_quota is null or p_quota<0 then raise exception 'Choose a valid plan and a non-negative credit count'; end if;
 if nullif(trim(p_reason),'') is null then raise exception 'Explain the reason for this grant'; end if;
 if p_tier in ('standard','premium') and p_end_date is null and not coalesce(p_limits_exempt,false) then raise exception 'A season pass needs an expiration date'; end if;
 perform pg_advisory_xact_lock(hashtextextended(billing_private.scope(p_org_id)::text,0));
 select to_jsonb(o) into v_before from public.organizations o where id=p_org_id for update;
 if not found then raise exception 'Organization not found'; end if;
 update public.organizations set active_tier=p_tier,event_quota=case when id=p_org_id then p_quota else 0 end,subscription_end_date=p_end_date,limits_exempt=coalesce(p_limits_exempt,false),updated_at=now() where id in(select billing_private.org_ids(p_org_id));
 insert into public.audit_events(organization_id,actor_id,action,target_type,target_id,before_data,after_data)
 values(p_org_id,auth.uid(),'admin_grant_entitlement','organization',p_org_id,v_before,jsonb_build_object('tier',p_tier,'remaining_credits',p_quota,'expires_at',p_end_date,'limits_exempt',p_limits_exempt,'reason',trim(p_reason)));
end $$;
create or replace function billing_private.apply_payment(p_session_id text,p_stripe_event_id text,p_org_id uuid,p_tier text,p_amount integer,p_currency text,p_notification jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_inserted text; v_end timestamptz; v_premium boolean;
begin
 if coalesce(auth.jwt()->>'role','') <> 'service_role' and current_setting('role',true)<>'service_role' then raise exception 'Payment service required' using errcode='42501'; end if;
 if nullif(p_session_id,'') is null or nullif(p_stripe_event_id,'') is null or p_tier not in ('event_pass','standard','premium') or p_currency<>'usd'
 or p_amount <> (case p_tier when 'event_pass' then 4900 when 'standard' then 19900 when 'premium' then 34900 end) then raise exception 'Invalid payment details'; end if;
 perform pg_advisory_xact_lock(hashtextextended(billing_private.scope(p_org_id)::text,0));
 perform 1 from public.organizations where id=p_org_id for update;
 if not found then raise exception 'Organization not found'; end if;
 insert into billing_private.payment_receipts(session_id,stripe_event_id,organization_id,tier,amount,currency,notification)
 values(p_session_id,p_stripe_event_id,p_org_id,p_tier,p_amount,p_currency,p_notification)
 on conflict do nothing returning session_id into v_inserted;
 if v_inserted is null then return false; end if;
 if p_tier='event_pass' then
  update public.organizations set event_quota=event_quota+1,
   active_tier=case when active_tier='free' then 'event_pass' else active_tier end,updated_at=now() where id=p_org_id;
 else
  select max(subscription_end_date),bool_or(active_tier='premium' and subscription_end_date>now()) into v_end,v_premium from public.organizations where id in(select billing_private.org_ids(p_org_id));
  update public.organizations set active_tier=case when v_premium then 'premium' else p_tier end,
   subscription_end_date=greatest(now(),coalesce(v_end,now()))+interval '1 year',updated_at=now() where id in(select billing_private.org_ids(p_org_id));
 end if;
 insert into public.audit_events(organization_id,action,target_type,target_id,after_data)
 values(p_org_id,'paid_entitlement','organization',p_org_id,jsonb_build_object('session_id',p_session_id,'tier',p_tier,'amount',p_amount));
 return true;
end $$;
