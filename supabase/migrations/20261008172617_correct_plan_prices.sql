-- Match the live Stripe catalog: Event Pass $50, Standard $200, Premium $250 (USD cents).
-- Same body as 20261008154611 apart from the accepted amounts.
create or replace function billing_private.apply_payment(p_session_id text,p_stripe_event_id text,p_org_id uuid,p_tier text,p_amount integer,p_currency text,p_notification jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_inserted text; v_end timestamptz;
begin
 if coalesce(auth.jwt()->>'role','') <> 'service_role' and current_setting('role',true)<>'service_role' then raise exception 'Payment service required' using errcode='42501'; end if;
 if nullif(p_session_id,'') is null or nullif(p_stripe_event_id,'') is null or p_tier is null or p_amount is null or p_currency is null or p_tier not in ('event_pass','standard','premium') or p_currency<>'usd'
 or p_amount <> (case p_tier when 'event_pass' then 5000 when 'standard' then 20000 when 'premium' then 25000 end) then raise exception 'Invalid payment details'; end if;
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
  select max(subscription_end_date) into v_end from public.organizations where id in(select billing_private.org_ids(p_org_id)) and active_tier=p_tier;
  update public.organizations set active_tier=p_tier,
   subscription_end_date=greatest(now(),coalesce(v_end,now()))+interval '1 year',updated_at=now() where id in(select billing_private.org_ids(p_org_id));
 end if;
 insert into public.audit_events(organization_id,action,target_type,target_id,after_data)
 values(p_org_id,'paid_entitlement','organization',p_org_id,jsonb_build_object('session_id',p_session_id,'tier',p_tier,'amount',p_amount));
 return true;
end $$;
