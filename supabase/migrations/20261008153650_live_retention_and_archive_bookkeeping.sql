alter table public.events add column retention_finalized boolean not null default false;
create or replace function billing_private.event_retention_deadline() returns trigger language plpgsql security definer set search_path='' as $$
declare v_tier text;v_base timestamptz;
begin
 if TG_OP='UPDATE' then
  new.public_until:=old.public_until;
  new.retention_finalized:=old.retention_finalized;
  if coalesce(auth.jwt()->>'role','')<>'service_role' and current_setting('role',true)<>'service_role' and session_user not in('postgres','supabase_admin') then new.archived_at:=old.archived_at; end if;
 else
  new.public_until:=null;
  new.archived_at:=null;
  new.retention_finalized:=false;
  if new.status='completed' and auth.uid() is not null then raise exception 'Use Complete the race to publish official results'; end if;
 end if;
 if (new.status='completed' and not new.retention_finalized) or (new.status='live' and new.public_until is null) then
  select tier,activated_at into v_tier,v_base from billing_private.event_usage where event_id=new.id;
  if new.status='completed' then v_base:=coalesce(new.completed_at,now()); new.retention_finalized:=true; end if;
  v_base:=coalesce(v_base,now());
  new.public_until:=v_base+interval '30 days';
  if v_tier in('standard','premium') then new.public_until:=greatest(new.public_until,(date_trunc('year',v_base at time zone 'UTC')+interval '1 year') at time zone 'UTC'); end if;
 end if;
 return new;
end $$;
-- Legacy live events receive a grace window from the ledger migration; completed events use completion timestamps.
update public.events set public_until=public_until where status in('live','completed');
