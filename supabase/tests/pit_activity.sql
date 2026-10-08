begin;
insert into public.organizations(id,name,billing_email,limits_exempt) values('bf500000-0000-4000-8000-000000000001','Activity test','activity@test.invalid',true);
insert into public.tracks(id,organization_id,name,slug) values('bf600000-0000-4000-8000-000000000001','bf500000-0000-4000-8000-000000000001','Activity track','activity-test');
insert into public.events(id,track_id,name,slug,local_date,status) values('bf700000-0000-4000-8000-000000000001','bf600000-0000-4000-8000-000000000001','Activity race','activity-race',current_date,'live');
insert into public.event_classes(id,event_id,track_id,name,scoring_type,order_num) values('bf800000-0000-4000-8000-000000000001','bf700000-0000-4000-8000-000000000001','bf600000-0000-4000-8000-000000000001','Class','fastest_pass',1);
insert into public.entries(id,event_class_id,display_name,order_num) values('bf900000-0000-4000-8000-000000000001','bf800000-0000-4000-8000-000000000001','One racer',1);
insert into public.attempts(id,event_class_id,entry_id,ordinal,status,elapsed_ms) values('bfa00000-0000-4000-8000-000000000001','bf800000-0000-4000-8000-000000000001','bf900000-0000-4000-8000-000000000001',1,'valid',10000);
do $$ declare first_stamp timestamptz; begin
 select updated_at into first_stamp from public.attempts where id='bfa00000-0000-4000-8000-000000000001';
 if first_stamp is null then raise exception 'Insert timestamp missing'; end if;
 update public.attempts set elapsed_ms=9000,updated_at='1900-01-01' where id='bfa00000-0000-4000-8000-000000000001';
 if (select updated_at from public.attempts where id='bfa00000-0000-4000-8000-000000000001')<=first_stamp then raise exception 'Edit timestamp did not advance'; end if;
end $$;
select 'pit activity: PASS (one contestant, server timestamp advances and overrides supplied value)' as result;
rollback;