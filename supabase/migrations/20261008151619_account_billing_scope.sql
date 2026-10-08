-- Scope paid access to the original owning account, across its organizations.
alter table public.organizations add column billing_owner_id uuid;
update public.organizations o set billing_owner_id=(select m.user_id from public.organization_memberships m where m.organization_id=o.id and m.role='owner' and m.active order by m.created_at,m.user_id limit 1);
create or replace function billing_private.assign_billing_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.role='owner' and new.active then update public.organizations set billing_owner_id=new.user_id where id=new.organization_id and billing_owner_id is null; end if;
 return new;
end $$;
revoke all on function billing_private.assign_billing_owner() from public,anon,authenticated;
create trigger assign_billing_owner after insert or update of role,active on public.organization_memberships for each row execute function billing_private.assign_billing_owner();

create or replace function billing_private.scope(p_org_id uuid) returns uuid language sql stable security definer set search_path='' as $$
 select coalesce(billing_owner_id,id) from public.organizations where id=p_org_id;
$$;
create or replace function billing_private.org_ids(p_org_id uuid) returns setof uuid language sql stable security definer set search_path='' as $$
 select id from public.organizations where coalesce(billing_owner_id,id)=billing_private.scope(p_org_id);
$$;
revoke all on function billing_private.scope(uuid),billing_private.org_ids(uuid) from public,anon,authenticated;

