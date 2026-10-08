begin;
insert into auth.users(id,email) values('be400000-0000-4000-8000-000000000001','credits@test.invalid');
insert into public.organizations(id,name,billing_email,event_quota) values('be500000-0000-4000-8000-000000000001','Credit test A','credits@test.invalid',1),('be500000-0000-4000-8000-000000000002','Credit test B','credits@test.invalid',0);
insert into public.organization_memberships(organization_id,user_id,role) values
 ('be500000-0000-4000-8000-000000000001','be400000-0000-4000-8000-000000000001','owner'),('be500000-0000-4000-8000-000000000002','be400000-0000-4000-8000-000000000001','owner');
insert into public.tracks(id,organization_id,name,slug) values('be600000-0000-4000-8000-000000000001','be500000-0000-4000-8000-000000000001','Credit track','credit-test');
insert into public.series(id,organization_id,name) values('be600000-0000-4000-8000-000000000002','be500000-0000-4000-8000-000000000002','Credit series');
do $$ begin
 begin insert into public.tracks(organization_id,name,slug) values('be500000-0000-4000-8000-000000000002','Second track','credit-test-second');
  raise exception 'Account-wide asset limit bypassed' using errcode='XX000'; exception when raise_exception then null; end;
end $$;
insert into public.events(id,series_id,name,slug,local_date,status) values('be700000-0000-4000-8000-000000000001','be600000-0000-4000-8000-000000000002','Calendar event','credit-calendar',current_date,'scheduled');
do $$ begin
 if (select event_quota from public.organizations where id='be500000-0000-4000-8000-000000000001')<>1 then raise exception 'Calendar consumed credit'; end if;
end $$;
update public.events set status='live' where id='be700000-0000-4000-8000-000000000001';
update public.events set status='scheduled' where id='be700000-0000-4000-8000-000000000001';
update public.events set status='live' where id='be700000-0000-4000-8000-000000000001';
do $$ begin
 if (select event_quota from public.organizations where id='be500000-0000-4000-8000-000000000001')<>0 then raise exception 'Credit not consumed exactly once'; end if;
 begin insert into public.events(series_id,name,slug,local_date,status) values('be600000-0000-4000-8000-000000000002','No credit','credit-empty',current_date,'live');
  raise exception 'Free event allowed' using errcode='XX000'; exception when raise_exception then null; end;
end $$;
delete from public.events where id='be700000-0000-4000-8000-000000000001';
update public.organizations set event_quota=1 where id='be500000-0000-4000-8000-000000000001';
do $$ begin
 begin insert into public.events(id,series_id,name,slug,local_date,status) values('be700000-0000-4000-8000-000000000001','be600000-0000-4000-8000-000000000002','Reused ID','credit-reused',current_date,'live');
  raise exception 'Deleted event credit reused' using errcode='XX000'; exception when raise_exception then null; end;
 if (select event_quota from public.organizations where id='be500000-0000-4000-8000-000000000001')<>1 then raise exception 'Failed reuse charged a credit'; end if;
end $$;
select 'event credits: PASS (calendar free, pooled across account, charged once, no free allowance)' as result;
rollback;