create table billing_private.payment_receipts(
 session_id text primary key, stripe_event_id text not null unique, organization_id uuid not null references public.organizations(id),
 tier text not null check(tier in ('event_pass','standard','premium')), amount integer not null, currency text not null,
 notification jsonb not null, notified_at timestamptz, notification_attempts integer not null default 0, notification_error text,
 created_at timestamptz not null default now()
);
revoke all on billing_private.payment_receipts from public,anon,authenticated;
grant select,update on billing_private.payment_receipts to service_role;

create or replace function billing_private.apply_payment(p_session_id text,p_stripe_event_id text,p_org_id uuid,p_tier text,p_amount integer,p_currency text,p_notification jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_inserted text;
begin
 if coalesce(auth.jwt()->>'role','') <> 'service_role' and current_setting('role',true)<>'service_role' then raise exception 'Payment service required' using errcode='42501'; end if;
 if nullif(p_session_id,'') is null or nullif(p_stripe_event_id,'') is null or p_tier not in ('event_pass','standard','premium') or p_currency<>'usd'
 or p_amount <> (case p_tier when 'event_pass' then 4900 when 'standard' then 19900 when 'premium' then 34900 end) then raise exception 'Invalid payment details'; end if;
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
  update public.organizations set active_tier=case when active_tier='premium' and subscription_end_date>now() then 'premium' else p_tier end,
   subscription_end_date=greatest(now(),coalesce(subscription_end_date,now()))+interval '1 year',updated_at=now() where id=p_org_id;
 end if;
 insert into public.audit_events(organization_id,action,target_type,target_id,after_data)
 values(p_org_id,'paid_entitlement','organization',p_org_id,jsonb_build_object('session_id',p_session_id,'tier',p_tier,'amount',p_amount));
 return true;
end $$;
revoke all on function billing_private.apply_payment(text,text,uuid,text,integer,text,jsonb) from public,anon,authenticated;
grant execute on function billing_private.apply_payment(text,text,uuid,text,integer,text,jsonb) to service_role;
create or replace function public.apply_paid_entitlement(p_session_id text,p_stripe_event_id text,p_org_id uuid,p_tier text,p_amount integer,p_currency text,p_notification jsonb)
returns boolean language sql security invoker set search_path='' as $$
 select billing_private.apply_payment(p_session_id,p_stripe_event_id,p_org_id,p_tier,p_amount,p_currency,p_notification);
$$;
revoke all on function public.apply_paid_entitlement(text,text,uuid,text,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.apply_paid_entitlement(text,text,uuid,text,integer,text,jsonb) to service_role;

create or replace function public.pending_payment_notifications() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.jwt()->>'role','') <> 'service_role' and current_setting('role',true)<>'service_role' then raise exception 'Payment service required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(x)) from (select session_id,notification from billing_private.payment_receipts where notified_at is null order by created_at limit 20)x),'[]'::jsonb);
end $$;
create or replace function public.record_payment_notification(p_session_id text,p_success boolean,p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.jwt()->>'role','') <> 'service_role' and current_setting('role',true)<>'service_role' then raise exception 'Payment service required' using errcode='42501'; end if;
 update billing_private.payment_receipts set notification_attempts=notification_attempts+1,notified_at=case when p_success then now() else notified_at end,notification_error=left(p_error,500) where session_id=p_session_id;
end $$;
revoke all on function public.pending_payment_notifications(),public.record_payment_notification(text,boolean,text) from public,anon,authenticated;
grant execute on function public.pending_payment_notifications(),public.record_payment_notification(text,boolean,text) to service_role;
