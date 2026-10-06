-- Run as the database owner. All fixtures and writes are rolled back.
begin;
insert into auth.users (id, email) values
 ('f0000000-0000-4000-8000-000000000001', 'owner@permissions.invalid'),
 ('f0000000-0000-4000-8000-000000000002', 'outsider@permissions.invalid'),
 ('f0000000-0000-4000-8000-000000000003', 'official@permissions.invalid'),
 ('f0000000-0000-4000-8000-000000000004', 'member@permissions.invalid');
insert into public.organizations (id,name,billing_email) values
 ('f1000000-0000-4000-8000-000000000001','Test organization A','private@permissions.invalid'),
 ('f1000000-0000-4000-8000-000000000002','Test organization B','private-b@permissions.invalid');
insert into public.organization_memberships (organization_id,user_id,role) values
 ('f1000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','owner'),
 ('f1000000-0000-4000-8000-000000000002','f0000000-0000-4000-8000-000000000002','owner'),
 ('f1000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000004','member');
insert into public.tracks (id,organization_id,name,slug) values
 ('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','Test A','permissions-test-a'),
 ('f2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002','Test B','permissions-test-b');
insert into public.track_memberships (track_id,user_id,role) values
 ('f2000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','owner'),
 ('f2000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000003','official');
insert into public.events (id,track_id,name,slug,local_date,status,published_revision) values
 ('f3000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','Live','test-live',current_date,'live',1),
 ('f3000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000002','Scheduled','test-scheduled',current_date,'scheduled',null),
 ('f3000000-0000-4000-8000-000000000003','f2000000-0000-4000-8000-000000000001','Draft','test-draft',current_date,'draft',null);
insert into public.event_classes (id,event_id,track_id,name,scoring_type,order_num) values
 ('f4000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','Class','fastest_pass',1);
insert into public.entries (id,event_class_id,display_name,order_num) values
 ('f5000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000001','Racer',1);
insert into public.attempts (id,event_class_id,entry_id,ordinal,status,elapsed_ms) values
 ('f6000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000001',1,'valid',10000);

set local role authenticated;
set local request.jwt.claim.sub = 'f0000000-0000-4000-8000-000000000002';
do $$ begin
  if public.can_edit_track('f2000000-0000-4000-8000-000000000001') then raise exception 'Cross-tenant edit allowed'; end if;
  begin
    insert into public.organization_memberships(organization_id,user_id,role)
    values ('f1000000-0000-4000-8000-000000000001',auth.uid(),'owner');
    raise exception 'Self-enrollment succeeded';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set tier='premium' where id=auth.uid();
    raise exception 'Self-upgrade succeeded';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.profiles) <> 1 then raise exception 'Private profiles leaked'; end if;
  update public.profiles set display_name='Allowed edit' where id=auth.uid();
  if not found then raise exception 'Own profile update failed'; end if;
  if exists (select 1 from public.events where id='f3000000-0000-4000-8000-000000000003') then raise exception 'Private draft leaked'; end if;
end $$;

set local request.jwt.claim.sub = 'f0000000-0000-4000-8000-000000000003';
do $$ begin
  if not public.can_edit_track('f2000000-0000-4000-8000-000000000001') then raise exception 'Official cannot score'; end if;
  if public.can_manage_track('f2000000-0000-4000-8000-000000000001') then raise exception 'Official can manage memberships'; end if;
  update public.attempts set elapsed_ms=9900 where id='f6000000-0000-4000-8000-000000000001';
  if not found then raise exception 'Official result update failed'; end if;
  begin
    insert into public.track_memberships(track_id,user_id,role)
    values ('f2000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000004','owner');
    raise exception 'Official granted ownership';
  exception when insufficient_privilege then null; end;
end $$;

set local request.jwt.claim.sub = 'f0000000-0000-4000-8000-000000000004';
do $$ begin
  begin
    perform public.create_ghost_track('f1000000-0000-4000-8000-000000000001','Escalation','permissions-escalation','America/New_York');
    raise exception 'Ordinary member provisioned ownership';
  exception when insufficient_privilege then null; end;
end $$;

set local request.jwt.claim.sub = 'f0000000-0000-4000-8000-000000000001';
do $$ begin
  if not public.can_manage_track('f2000000-0000-4000-8000-000000000001') then raise exception 'Owner cannot manage track'; end if;
  insert into public.track_memberships(track_id,user_id,role)
    values ('f2000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000004','judge');
  begin
    update public.tracks set organization_id='f1000000-0000-4000-8000-000000000002'
      where id='f2000000-0000-4000-8000-000000000001';
    raise exception 'Unauthorized organization transfer succeeded';
  exception when insufficient_privilege then null; end;
  perform public.register_track('Onboarding test',null,'America/New_York','permissions-onboarding');
end $$;

set local role anon;
set local request.jwt.claim.sub = '';
do $$ begin
  if (select count(*) from public.tracks where slug in ('permissions-test-a','permissions-test-b')) <> 2 then raise exception 'Public tracks inaccessible'; end if;
  if (select count(*) from public.events where id in (
    'f3000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000002','f3000000-0000-4000-8000-000000000003')) <> 2 then raise exception 'Public event boundary incorrect'; end if;
  if not exists (select 1 from public.attempts where id='f6000000-0000-4000-8000-000000000001') then raise exception 'Spectator results inaccessible'; end if;
  begin
    perform 1 from public.profiles;
    raise exception 'Anonymous profile access permitted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.platform_admins(user_id) values ('f0000000-0000-4000-8000-000000000002');
set local role authenticated;
set local request.jwt.claim.sub = 'f0000000-0000-4000-8000-000000000002';
do $$ begin
  if not public.can_edit_track('f2000000-0000-4000-8000-000000000001') then raise exception 'Platform admin cannot score'; end if;
  if not public.can_manage_track('f2000000-0000-4000-8000-000000000001') then raise exception 'Platform admin cannot manage'; end if;
end $$;
reset role;
select 'tenant_permissions: PASS (owner, official, member, outsider, spectator)' as result;
rollback;
