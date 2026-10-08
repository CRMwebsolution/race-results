create or replace function public.check_organization_event_quota()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_org uuid;v_scope uuid;v_credit_org uuid;v_tier text;v_exempt boolean;
begin
 if new.status not in ('live','completed') then return new; end if;
 select coalesce(t.organization_id,s.organization_id) into v_org from (select new.track_id track_id,new.series_id series_id) x
 left join public.tracks t on t.id=x.track_id left join public.series s on s.id=x.series_id;
 v_scope:=billing_private.scope(v_org);
 if v_scope is null then raise exception 'This event needs a track or series'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_scope::text,0));
 if exists(select 1 from billing_private.event_usage where event_id=new.id) then
  if TG_OP='INSERT' then raise exception 'That event identifier was already used. Create a new event instead.'; end if;
  return new;
 end if;
 select active_tier,limits_exempt into v_tier,v_exempt from public.organizations
 where id in(select billing_private.org_ids(v_org)) and (limits_exempt or (active_tier in ('standard','premium') and subscription_end_date>now()))
 order by limits_exempt desc,case active_tier when 'premium' then 2 when 'standard' then 1 else 0 end desc limit 1;
 if not found then
  select id into v_credit_org from public.organizations where id in(select billing_private.org_ids(v_org)) and event_quota>0 order by created_at,id for update limit 1;
  if not found then raise exception 'No event credits remaining. Buy an Event Pass or ask an admin for access before going live.'; end if;
  update public.organizations set event_quota=event_quota-1,updated_at=now() where id=v_credit_org;
  v_tier:='event_pass';
 end if;
 insert into billing_private.event_usage(event_id,organization_id,billing_scope,tier,charged)
 values(new.id,v_org,v_scope,v_tier,v_credit_org is not null);
 return new;
end $$;
create or replace function billing_private.apply_payment(p_session_id text,p_stripe_event_id text,p_org_id uuid,p_tier text,p_amount integer,p_currency text,p_notification jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_inserted text; v_end timestamptz;
begin
 if coalesce(auth.jwt()->>'role','') <> 'service_role' and current_setting('role',true)<>'service_role' then raise exception 'Payment service required' using errcode='42501'; end if;
 if nullif(p_session_id,'') is null or nullif(p_stripe_event_id,'') is null or p_tier is null or p_amount is null or p_currency is null or p_tier not in ('event_pass','standard','premium') or p_currency<>'usd'
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
  select max(subscription_end_date) into v_end from public.organizations where id in(select billing_private.org_ids(p_org_id)) and active_tier=p_tier;
  update public.organizations set active_tier=p_tier,
   subscription_end_date=greatest(now(),coalesce(v_end,now()))+interval '1 year',updated_at=now() where id in(select billing_private.org_ids(p_org_id));
 end if;
 insert into public.audit_events(organization_id,action,target_type,target_id,after_data)
 values(p_org_id,'paid_entitlement','organization',p_org_id,jsonb_build_object('session_id',p_session_id,'tier',p_tier,'amount',p_amount));
 return true;
end $$;
