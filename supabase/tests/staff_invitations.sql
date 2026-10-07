begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('f8000000-0000-4000-8000-000000000001','invite-owner@test.invalid',now()),
 ('f8000000-0000-4000-8000-000000000002','invite-scorer@test.invalid',now()),
 ('f8000000-0000-4000-8000-000000000003','invite-judge@test.invalid',now()),
 ('f8000000-0000-4000-8000-000000000004','invite-other@test.invalid',now()),
 ('f8000000-0000-4000-8000-000000000005','invite-unconfirmed@test.invalid',null);
set local role authenticated;
set local request.jwt.claim.sub='f8000000-0000-4000-8000-000000000001';
do $$declare t jsonb;s jsonb;e uuid;e2 uuid;je uuid;jc uuid;en uuid;i uuid;begin
 t:=public.register_track_with_state('Invite Track',null,'America/New_York','invite-track','NC');
 e:=public.create_track_event((t->>'track_id')::uuid,'Invited race',current_date,'invited-race',array[]::uuid[]);
 e2:=public.create_track_event((t->>'track_id')::uuid,'Other private race',current_date,'other-private',array[]::uuid[]);
 s:=public.create_series_with_organization('Invite Series','',null,'Invite Organizer');
 insert into public.events(series_id,name,slug,local_date,status) values((s->>'series_id')::uuid,'Judged race','invite-judged',current_date,'draft') returning id into je;
 jc:=public.create_event_class(je,'Judged','judged_points','{"judgeCount":1,"rubric":[{"key":"total","label":"Total","max":10}]}');
 en:=public.create_race_entry((s->>'series_id')::uuid,je,jc,'One fixture contestant',null);
 perform set_config('test.invite.event',e::text,true);perform set_config('test.invite.other_event',e2::text,true);perform set_config('test.invite.judge_event',je::text,true);perform set_config('test.invite.entry',en::text,true);
 i:=public.create_race_staff_invitation(e,' INVITE-SCORER@test.invalid ','official');
 perform set_config('test.invite.scorer_token',(select token::text from public.race_staff_invitations where id=i),true);
 i:=public.create_race_staff_invitation(je,'invite-judge@test.invalid','judge',jc,'Judge One');
 perform set_config('test.invite.judge_token',(select token::text from public.race_staff_invitations where id=i),true);
 begin perform public.create_race_staff_invitation(e,'invite-other@test.invalid','judge',jc,'Wrong race');raise exception 'Cross-race class accepted' using errcode='XX000';exception when raise_exception then null;end;
 i:=public.create_race_staff_invitation(e,'invite-other@test.invalid','official');perform public.cancel_race_staff_invitation(i);
 perform set_config('test.invite.cancelled',(select token::text from public.race_staff_invitations where id=i),true);
 i:=public.create_race_staff_invitation(e,'invite-other@test.invalid','official');perform set_config('test.invite.expired',(select token::text from public.race_staff_invitations where id=i),true);
 i:=public.create_race_staff_invitation(e,'invite-unconfirmed@test.invalid','official');perform set_config('test.invite.unconfirmed',(select token::text from public.race_staff_invitations where id=i),true);
end $$;
reset role;
update public.race_staff_invitations set expires_at=now()-interval '1 second' where token=current_setting('test.invite.expired')::uuid;
-- A fresh judge invitation must not restore a previously removed scorer role.
insert into public.race_staff(event_id,user_id,role,active) values(current_setting('test.invite.judge_event')::uuid,'f8000000-0000-4000-8000-000000000003','official',false);
set local role authenticated;set local request.jwt.claim.sub='f8000000-0000-4000-8000-000000000004';
do $$begin
 begin perform public.accept_race_staff_invitation(current_setting('test.invite.scorer_token')::uuid);raise exception 'Wrong email accepted' using errcode='XX000';exception when insufficient_privilege then null;end;
 begin perform public.accept_race_staff_invitation(current_setting('test.invite.cancelled')::uuid);raise exception 'Cancelled accepted' using errcode='XX000';exception when raise_exception then null;end;
 begin perform public.accept_race_staff_invitation(current_setting('test.invite.expired')::uuid);raise exception 'Expired accepted' using errcode='XX000';exception when raise_exception then null;end;
 if (select count(*) from public.race_staff_invitations)>0 then raise exception 'Invitation emails/tokens leaked';end if;
end $$;
set local request.jwt.claim.sub='f8000000-0000-4000-8000-000000000005';
do $$begin
 begin perform public.accept_race_staff_invitation(current_setting('test.invite.unconfirmed')::uuid);raise exception 'Unconfirmed email accepted' using errcode='XX000';exception when insufficient_privilege then null;end;
end $$;
set local request.jwt.claim.sub='f8000000-0000-4000-8000-000000000002';
do $$declare result jsonb;e uuid:=current_setting('test.invite.event')::uuid;begin
 result:=public.accept_race_staff_invitation(current_setting('test.invite.scorer_token')::uuid);
 if result->>'path' not like '%/scoring' then raise exception 'Wrong scorer destination';end if;
 perform public.accept_race_staff_invitation(current_setting('test.invite.scorer_token')::uuid);
 if not public.can_edit_race(e) or public.can_manage_race(e) or public.can_publish_race(e) then raise exception 'Wrong scorer authority';end if;
 if public.can_view_staff_race(current_setting('test.invite.other_event')::uuid) or exists(select 1 from public.events where id=current_setting('test.invite.other_event')::uuid) then raise exception 'Other private race leaked';end if;
 begin perform public.create_race_staff_invitation(e,'invite-other@test.invalid','official');raise exception 'Scorer delegated authority' using errcode='XX000';exception when insufficient_privilege then null;end;
 begin insert into public.race_staff(event_id,user_id,role) values(current_setting('test.invite.other_event')::uuid,auth.uid(),'official');raise exception 'Direct staff insert allowed' using errcode='XX000';exception when insufficient_privilege then null;end;
end $$;
set local request.jwt.claim.sub='f8000000-0000-4000-8000-000000000003';
do $$declare j uuid;e uuid:=current_setting('test.invite.judge_event')::uuid;begin
 if public.accept_race_staff_invitation(current_setting('test.invite.judge_token')::uuid)->>'path' not like '%/judging' then raise exception 'Wrong judge destination';end if;
 if not public.can_judge_race(e) or public.can_edit_race(e) or public.can_manage_race(e) or public.can_publish_race(e) then raise exception 'Judge escalated role';end if;
 select id into j from public.judge_assignments where user_id=auth.uid();
 if j is null then raise exception 'Judge not automatically assigned';end if;
 perform public.save_judge_score(j,current_setting('test.invite.entry')::uuid,1,'{"total":8}',0);
 perform set_config('test.invite.assignment',j::text,true);
 if exists(select 1 from public.organization_memberships where user_id=auth.uid()) then raise exception 'Race invite added organization membership';end if;
end $$;
set local request.jwt.claim.sub='f8000000-0000-4000-8000-000000000001';
do $$begin
 perform public.remove_race_staff(current_setting('test.invite.judge_event')::uuid,'f8000000-0000-4000-8000-000000000003');
end $$;
set local request.jwt.claim.sub='f8000000-0000-4000-8000-000000000003';
do $$begin
 if public.can_judge_race(current_setting('test.invite.judge_event')::uuid) then raise exception 'Revoked judge kept access';end if;
 begin perform public.accept_race_staff_invitation(current_setting('test.invite.judge_token')::uuid);raise exception 'Used token reactivated revoked staff' using errcode='XX000';exception when raise_exception then null;end;
 begin perform public.save_judge_score(current_setting('test.invite.assignment')::uuid,current_setting('test.invite.entry')::uuid,1,'{"total":9}',1);raise exception 'Revoked judge saved score' using errcode='XX000';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin if (select count(*) from public.judge_scores where assignment_id=current_setting('test.invite.assignment')::uuid)<>1 then raise exception 'Revocation erased stored scores';end if;end $$;
set local role anon;
do $$begin
 if public.can_view_staff_race(current_setting('test.invite.event')::uuid) then raise exception 'Anonymous staff access';end if;
 begin perform public.accept_race_staff_invitation(current_setting('test.invite.scorer_token')::uuid);raise exception 'Anonymous accepted invite' using errcode='XX000';exception when insufficient_privilege then null;end;
end $$;
reset role;select 'race staff invitations: PASS' result;rollback;
