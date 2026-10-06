begin;
insert into auth.users(id,email) values
 ('fb000000-0000-4000-8000-000000000001','atomic-owner@test.invalid'),
 ('fb000000-0000-4000-8000-000000000002','atomic-official@test.invalid'),
 ('fb000000-0000-4000-8000-000000000003','atomic-admin@test.invalid');
set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000001';
do $$ declare t jsonb; v_event uuid; v_class uuid; v_entry uuid; extra_entry uuid; auto_entry uuid; r jsonb; before_rev bigint; after_rev bigint; begin
  t:=public.register_track_with_state('Atomic track',null,'America/New_York','atomic-test-track',null);
  v_event:=public.create_track_event((t->>'track_id')::uuid,'Atomic event',current_date,'atomic-test-event',array[]::uuid[]);
  insert into public.event_classes(event_id,track_id,name,scoring_type,order_num) values(v_event,(t->>'track_id')::uuid,'Class','fastest_pass',1) returning id into v_class;
  insert into public.entries(event_class_id,display_name,order_num) values(v_class,'Driver',1) returning id into v_entry;
  extra_entry:=public.create_race_entry((t->>'track_id')::uuid,v_event,v_class,'Extra',3);
  auto_entry:=public.create_race_entry((t->>'track_id')::uuid,v_event,v_class,'Automatic',null);
  if (select order_num from public.entries where id=auto_entry)<>4 then raise exception 'Automatic draw used count instead of maximum'; end if;
  delete from public.entries where id in(extra_entry,auto_entry);
  insert into public.track_memberships(track_id,user_id,role) values((t->>'track_id')::uuid,'fb000000-0000-4000-8000-000000000002','official');
  insert into public.track_memberships(track_id,user_id,role) values((t->>'track_id')::uuid,'fb000000-0000-4000-8000-000000000003','administrator');
  perform set_config('test.track_id',t->>'track_id',true);
  perform set_config('test.event_id',v_event::text,true);
  perform set_config('test.class_id',v_class::text,true);
  perform set_config('test.entry_id',v_entry::text,true);
  select working_revision into before_rev from public.events where id=v_event;
  r:=public.save_race_attempt((t->>'track_id')::uuid,v_event,v_class,v_entry,1,'valid',9000,null,500,'9',0);
  if (r->>'working_revision')::bigint<>before_rev+1 or r->>'published_revision' is not null then raise exception 'Draft save revision incorrect'; end if;
  before_rev:=(r->>'working_revision')::bigint;
  begin
    perform public.save_race_attempt((t->>'track_id')::uuid,v_event,v_class,v_entry,1,'valid',8000,null,0,'8',0);
    raise exception 'Stale cell version accepted' using errcode='XX000';
  exception when sqlstate 'PT409' then null; end;
  if (select working_revision from public.events where id=v_event)<>before_rev then raise exception 'Rejected save revised event'; end if;
  perform public.set_race_event_status(v_event,'live',before_rev);
  select working_revision into before_rev from public.events where id=v_event;
  r:=public.save_race_attempt((t->>'track_id')::uuid,v_event,v_class,v_entry,1,'valid',9100,null,500,'9.1',1);
  r:=public.save_race_attempt((t->>'track_id')::uuid,v_event,v_class,v_entry,2,'valid',9200,null,0,'9.2',0);
  if (r->>'working_revision')::bigint<>before_rev+2 or r->>'working_revision'<>r->>'published_revision' then raise exception 'Rapid saves lost revisions'; end if;
  before_rev:=(r->>'working_revision')::bigint;
  begin
    perform public.save_race_attempt((t->>'track_id')::uuid,v_event,v_class,v_entry,3,'valid',0,null,0,'0',0);
    raise exception 'Invalid time accepted' using errcode='XX000';
  exception when check_violation then null; end;
  if (select working_revision from public.events where id=v_event)<>before_rev then raise exception 'Invalid attempt revised event'; end if;
  begin
    perform public.complete_race_event(v_event,before_rev-1,jsonb_build_array(jsonb_build_object('id',v_entry,'final_rank',1)));
    raise exception 'Stale finalization accepted' using errcode='XX000';
  exception when sqlstate 'PT409' then null; end;
  begin
    perform public.complete_race_event(v_event,before_rev,'[]');
    raise exception 'Incomplete ranks accepted' using errcode='XX000';
  exception when check_violation then null; end;
  perform public.complete_race_event(v_event,before_rev,jsonb_build_array(jsonb_build_object('id',v_entry,'final_rank',1)));
  if (select status from public.events where id=v_event)<>'completed' or (select final_rank from public.entries where id=v_entry)<>1 then raise exception 'Completion failed'; end if;
  begin
    perform public.save_race_attempt((t->>'track_id')::uuid,v_event,v_class,v_entry,3,'valid',9000,null,0,'9',0);
    raise exception 'Completed results changed' using errcode='XX000';
  exception when object_not_in_prerequisite_state then null; end;
  begin
    update public.entries set display_name='Changed' where id=v_entry;
    raise exception 'Completed roster changed' using errcode='XX000';
  exception when object_not_in_prerequisite_state then null; end;
  select working_revision into after_rev from public.events where id=v_event;
  perform public.set_race_event_status(v_event,'live',after_rev);
  if (select final_rank from public.entries where id=v_entry) is not null then raise exception 'Reopening retained old rank'; end if;
  if not exists(select 1 from public.audit_events where target_id=v_event and action='event_reopened' and actor_id=auth.uid()) then raise exception 'Reopening was not audited'; end if;
end $$;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000002';
do $$ declare r jsonb; begin
  r:=public.save_race_attempt(current_setting('test.track_id')::uuid,current_setting('test.event_id')::uuid,
    current_setting('test.class_id')::uuid,current_setting('test.entry_id')::uuid,3,'valid',10000,null,0,'10',0);
  begin
    perform public.set_race_event_status(current_setting('test.event_id')::uuid,'draft',(r->>'working_revision')::bigint);
    raise exception 'Official changed lifecycle' using errcode='XX000';
  exception when insufficient_privilege then null; end;
  begin
    update public.attempts set elapsed_ms=1000 where entry_id=current_setting('test.entry_id')::uuid;
    raise exception 'Direct attempt update bypassed version check' using errcode='XX000';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_race_attempt(current_setting('test.track_id')::uuid,gen_random_uuid(),
      current_setting('test.class_id')::uuid,current_setting('test.entry_id')::uuid,4,'valid',10000,null,0,'10',0);
    raise exception 'Wrong event accepted' using errcode='XX000';
  exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000003';
do $$ begin
  if public.can_publish_track(current_setting('test.track_id')::uuid) then raise exception 'Administrator has owner-only publication rights'; end if;
  begin
    update public.events set status='draft' where id=current_setting('test.event_id')::uuid;
    raise exception 'Administrator bypassed owner lifecycle gate' using errcode='XX000';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'atomic_updates: PASS (revisions, conflicts, rollback, completion, locks, roles)' as result;
rollback;
