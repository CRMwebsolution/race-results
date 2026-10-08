begin;
insert into auth.users(id,email) values('be000000-0000-4000-8000-000000000001','billing-owner@test.invalid'),('be000000-0000-4000-8000-000000000002','billing-admin@test.invalid');
insert into public.platform_admins(user_id) values('be000000-0000-4000-8000-000000000002');
insert into public.organizations(id,name,billing_email) values('be100000-0000-4000-8000-000000000001','Billing test','billing@test.invalid');
insert into public.organization_memberships(organization_id,user_id,role) values('be100000-0000-4000-8000-000000000001','be000000-0000-4000-8000-000000000001','owner');
set local role authenticated;
set local request.jwt.claim.sub='be000000-0000-4000-8000-000000000001';
do $$ begin
 begin update public.organizations set active_tier='premium' where id='be100000-0000-4000-8000-000000000001'; raise exception 'Owner self-upgrade allowed'; exception when insufficient_privilege then null; end;
 begin perform public.admin_grant_entitlement('be100000-0000-4000-8000-000000000001','premium',2,now()+interval '1 year','Attempted owner grant',false); raise exception 'Owner grant allowed'; exception when insufficient_privilege then null; end;
 update public.organizations set name='Allowed name' where id='be100000-0000-4000-8000-000000000001';
 if not found then raise exception 'Normal organization edit broken'; end if;
end $$;
set local request.jwt.claim.sub='be000000-0000-4000-8000-000000000002';
select public.admin_grant_entitlement('be100000-0000-4000-8000-000000000001','premium',2,now()+interval '1 year','Complimentary access',false);
do $$ begin
 if not exists(select 1 from public.organizations where id='be100000-0000-4000-8000-000000000001' and active_tier='premium' and event_quota=2) then raise exception 'Unpaid admin grant failed'; end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.audit_events where target_id='be100000-0000-4000-8000-000000000001' and after_data->>'reason'='Complimentary access') then raise exception 'Grant reason missing'; end if;
end $$;
reset role;
select 'billing permissions: PASS (no contestants)' as result;
rollback;
