begin;
insert into auth.users(id,email) values('fd000000-0000-4000-8000-000000000001','judge-owner@test.invalid'),('fd000000-0000-4000-8000-000000000002','judge-official@test.invalid');
set local role authenticated;set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000001';
do $$ declare t jsonb;e uuid;c uuid;en uuid;j uuid;begin
 t:=public.register_track_with_state('Judging',null,'America/New_York','judging-test','NC');e:=public.create_track_event((t->>'track_id')::uuid,'Race',current_date,'judging-race',array[]::uuid[]);c:=public.create_event_class(e,'Freestyle','judged_points','{"judgeCount":1,"judgedRounds":1,"rubric":[{"key":"style","label":"Style","max":10}]}');en:=public.create_race_entry((t->>'track_id')::uuid,e,c,'Racer',null);
 insert into public.track_memberships(track_id,user_id,role) values((t->>'track_id')::uuid,'fd000000-0000-4000-8000-000000000002','official');
 perform public.set_class_judge(c,'fd000000-0000-4000-8000-000000000002','Judge A',true);select id into j from public.judge_assignments where event_class_id=c;
 begin perform public.save_judge_score(j,en,1,'{"style":0}',0);raise exception 'Owner impersonated judge' using errcode='XX000';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','fd000000-0000-4000-8000-000000000002',true);
 perform public.save_judge_score(j,en,1,'{"style":0}',0);
 begin perform public.save_judge_score(j,en,1,'{"style":11}',1);raise exception 'Out of bounds accepted' using errcode='XX000';exception when raise_exception then null;end;
 perform public.save_judge_score(j,en,1,'{"style":10}',1);
 begin perform public.save_judge_score(j,en,1,'{"style":9}',1);raise exception 'Stale judge score accepted' using errcode='XX000';exception when sqlstate 'PT409' then null;end;
 if (select count(*) from public.judge_scores where assignment_id=j)<>1 or (select save_version from public.judge_scores where assignment_id=j)<>2 then raise exception 'Incorrect correction/version';end if;
 perform set_config('request.jwt.claim.sub','fd000000-0000-4000-8000-000000000001',true);
 if (select count(*) from public.judge_score_history where event_class_id=c)<>2 then raise exception 'Missing judge audit';end if;
end $$;
reset role;select 'judging: PASS' result;rollback;
