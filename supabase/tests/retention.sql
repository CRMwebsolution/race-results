begin;
insert into auth.users(id,email) values('bf000000-0000-4000-8000-000000000001','retention@test.invalid');
insert into public.organizations(id,name,billing_email,active_tier,subscription_end_date,limits_exempt) values
 ('bf100000-0000-4000-8000-000000000001','Retention test','retention@test.invalid','event_pass',null,true);
insert into public.organization_memberships(organization_id,user_id,role) values('bf100000-0000-4000-8000-000000000001','bf000000-0000-4000-8000-000000000001','owner');
insert into public.tracks(id,organization_id,name,slug) values('bf200000-0000-4000-8000-000000000001','bf100000-0000-4000-8000-000000000001','Retention track','retention-test');
insert into public.events(id,track_id,name,slug,local_date,status,published_revision,completed_at) values
 ('bf300000-0000-4000-8000-000000000001','bf200000-0000-4000-8000-000000000001','Expired results','retention-expired',current_date,'completed',1,now()-interval '40 days'),
 ('bf300000-0000-4000-8000-000000000002','bf200000-0000-4000-8000-000000000001','Recent results','retention-recent',current_date-100,'completed',1,now());
do $$ declare v_until timestamptz; begin
 select public_until into v_until from public.events where id='bf300000-0000-4000-8000-000000000002';
 update public.organizations set active_tier='premium',subscription_end_date=now()+interval '1 year' where id='bf100000-0000-4000-8000-000000000001';
 update public.events set public_until=now()+interval '10 years' where id='bf300000-0000-4000-8000-000000000002';
 if (select public_until from public.events where id='bf300000-0000-4000-8000-000000000002')<>v_until then raise exception 'Deadline changed with plan or race date'; end if;
end $$;
set local role anon;
do $$ begin
 if exists(select 1 from public.events where id='bf300000-0000-4000-8000-000000000001') then raise exception 'Expired event public'; end if;
 if public.can_view_race('bf300000-0000-4000-8000-000000000001') then raise exception 'Expired race helper public'; end if;
 if not exists(select 1 from public.events where id='bf300000-0000-4000-8000-000000000002') then raise exception 'Recently completed event hidden based on race date'; end if;
end $$;
reset role;
select public.sweep_expired_events();
do $$ begin
 if (select archived_at from public.events where id='bf300000-0000-4000-8000-000000000001') is null then raise exception 'Sweep failed'; end if;
end $$;
set local role authenticated;
set local request.jwt.claim.sub='bf000000-0000-4000-8000-000000000001';
do $$ begin
 if not exists(select 1 from public.events where id='bf300000-0000-4000-8000-000000000001') then raise exception 'Owner history lost'; end if;
 begin perform public.sweep_expired_events(); raise exception 'Owner maintenance allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'retention: PASS (completion date, frozen deadline, anonymous RLS, owner history, sweep)' as result;
rollback;