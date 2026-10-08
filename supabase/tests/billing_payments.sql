begin;
insert into auth.users(id,email) values('be200000-0000-4000-8000-000000000001','payment@test.invalid');
insert into public.organizations(id,name,billing_email,active_tier,subscription_end_date,event_quota) values('be300000-0000-4000-8000-000000000001','Payment test','payment@test.invalid','premium',now()+interval '1 year',0);
insert into public.organization_memberships(organization_id,user_id,role) values('be300000-0000-4000-8000-000000000001','be200000-0000-4000-8000-000000000001','owner');
set local role authenticated;
set local request.jwt.claim.sub='be200000-0000-4000-8000-000000000001';
do $$ begin
 begin perform public.apply_paid_entitlement('test_session','test_event','be300000-0000-4000-8000-000000000001','event_pass',5000,'usd','{}'); raise exception 'Owner payment grant allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
select public.apply_paid_entitlement('test_session','test_event','be300000-0000-4000-8000-000000000001','event_pass',5000,'usd','{}');
select public.apply_paid_entitlement('test_session','test_event_retry','be300000-0000-4000-8000-000000000001','event_pass',5000,'usd','{}');
reset role;
do $$ begin
 if not exists(select 1 from public.organizations where id='be300000-0000-4000-8000-000000000001' and event_quota=1 and active_tier='premium') then raise exception 'Duplicate payment or event-pass downgrade'; end if;
 if (select count(*) from billing_private.payment_receipts where session_id='test_session')<>1 then raise exception 'Receipt not idempotent'; end if;
end $$;
select 'payment fulfillment: PASS (duplicate retry, service only, premium retained)' as result;
rollback;