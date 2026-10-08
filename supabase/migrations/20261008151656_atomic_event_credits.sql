create table billing_private.event_usage(
 event_id uuid primary key, organization_id uuid not null, billing_scope uuid not null, tier text not null, charged boolean not null,
 activated_at timestamptz not null default now()
);
revoke all on billing_private.event_usage from public,anon,authenticated;
-- Existing active/completed events keep their access; no historical credit deduction.
insert into billing_private.event_usage(event_id,organization_id,billing_scope,tier,charged)
 select e.id,o.id,coalesce(o.billing_owner_id,o.id),o.active_tier,false
 from public.events e left join public.tracks t on t.id=e.track_id left join public.series s on s.id=e.series_id
 join public.organizations o on o.id=coalesce(t.organization_id,s.organization_id) where e.status in ('live','completed');

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
 if exists(select 1 from billing_private.event_usage where event_id=new.id) then return new; end if;
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
drop trigger if exists enforce_event_quota on public.events;
create trigger enforce_event_quota before insert or update of status on public.events for each row execute function public.check_organization_event_quota();
revoke all on function public.check_organization_event_quota() from public,anon,authenticated;

