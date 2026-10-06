begin;
insert into auth.users(id,email) values('ff000000-0000-4000-8000-000000000001','offline@test.invalid');set local role authenticated;set local request.jwt.claim.sub='ff000000-0000-4000-8000-000000000001';
do $$declare t jsonb;e uuid;c uuid;en uuid;op uuid:=gen_random_uuid();first_save jsonb;second_save jsonb;v bigint;packet jsonb;begin
 t:=public.register_track_with_state('Offline',null,'America/New_York','offline-test','NC');e:=public.create_track_event((t->>'track_id')::uuid,'Race',current_date,'offline-race',array[]::uuid[]);c:=public.create_event_class(e,'Class','fastest_pass');en:=public.create_race_entry((t->>'track_id')::uuid,e,c,'Racer',null);
 first_save:=public.save_race_attempt_operation(op,(t->>'track_id')::uuid,e,c,en,1,'valid',1000,null,0,'1.000',0);second_save:=public.save_race_attempt_operation(op,(t->>'track_id')::uuid,e,c,en,1,'valid',1000,null,0,'1.000',0);
 if first_save<>second_save or (select save_version from public.attempts where entry_id=en)<>1 then raise exception 'Lost acknowledgement duplicated a save';end if;
 begin perform public.save_race_attempt_operation(op,(t->>'track_id')::uuid,e,c,en,1,'valid',2000,null,0,'2.000',0);raise exception 'Operation payload changed' using errcode='XX000';exception when raise_exception then null;end;
 packet:=public.prepare_offline_event(e,gen_random_uuid());select working_revision into v from public.events where id=e;
 begin perform public.complete_race_event(e,v,jsonb_build_array(jsonb_build_object('id',en,'final_rank',1)));raise exception 'Finalized with open device' using errcode='XX000';exception when raise_exception then null;end;
 perform public.close_offline_session((packet->>'sessionId')::uuid);perform public.complete_race_event(e,v,jsonb_build_array(jsonb_build_object('id',en,'final_rank',1)));
 if public.save_race_attempt_operation(op,(t->>'track_id')::uuid,e,c,en,1,'valid',1000,null,0,'1.000',0)<>first_save then raise exception 'Receipt unavailable after completion';end if;
end $$;reset role;select 'offline_operations: PASS' result;rollback;
