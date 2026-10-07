begin;
insert into auth.users(id,email) values('fa000000-0000-4000-8000-000000000001','integrity@test.invalid');
set local role authenticated;
set local request.jwt.claim.sub='fa000000-0000-4000-8000-000000000001';
do $$declare t jsonb;s jsonb;c uuid;c2 uuid;e uuid;ec uuid;v bigint;begin
 t:=public.register_track_with_state('Integrity',null,'America/New_York','integrity-test','NC');
 s:=public.create_series_with_organization('Integrity','',(t->>'organization_id')::uuid,null);
 insert into public.series_classes(series_id,name) values((s->>'series_id')::uuid,'Original') returning id into c;
 insert into public.series_classes(series_id,name,order_num) values((s->>'series_id')::uuid,'Other',2) returning id into c2;
 insert into public.series_rosters(series_id,series_class_id,display_name) values((s->>'series_id')::uuid,c,'Identity');
 insert into public.events(track_id,series_id,name,slug,local_date,status) values(null,(s->>'series_id')::uuid,'Race','integrity-race',current_date,'draft') returning id into e;
 perform public.import_series_roster(e);
 select id into ec from public.event_classes where event_id=e and series_class_id=c;
 begin update public.event_classes set series_class_id=c2 where id=ec; raise exception 'Linked class remap accepted' using errcode='XX000'; exception when raise_exception then null;end;
 -- Empty finals still have history after reopening and must be withdrawn rather than deleted.
 insert into public.events(track_id,name,slug,local_date,status) values((t->>'track_id')::uuid,'Empty','integrity-empty',current_date,'draft') returning id into e;
 select working_revision into v from public.events where id=e;
 perform public.complete_race_event(e,v,'[]');
 select working_revision into v from public.events where id=e;
 perform public.set_race_event_status(e,'draft',v);
 if public.delete_or_withdraw_event(e,true)<>'withdrawn' then raise exception 'Historical empty race deleted';end if;
 if not exists(select 1 from public.event_result_versions where event_id=e) then raise exception 'Official history lost';end if;
end $$;
reset role;
select 'acceptance integrity: PASS' as result;
rollback;
