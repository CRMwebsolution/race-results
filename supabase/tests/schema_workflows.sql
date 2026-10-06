begin;
insert into auth.users (id,email) values
 ('fa000000-0000-4000-8000-000000000001','schema-owner@test.invalid'),
 ('fa000000-0000-4000-8000-000000000002','schema-outsider@test.invalid');
set local role authenticated;
set local request.jwt.claim.sub='fa000000-0000-4000-8000-000000000001';
do $$ declare t jsonb; s jsonb; foreign_series jsonb; foreign_class uuid; v_event_id uuid; begin
  t := public.register_track_with_state('Schema workflow track',null,'America/New_York','schema-test-track','NC');
  if (select state from public.tracks where id=(t->>'track_id')::uuid)<>'NC' then raise exception 'State not saved'; end if;
  perform set_config('test.track_id',t->>'track_id',true);
  perform set_config('test.org_id',t->>'organization_id',true);
  s := public.create_series_with_organization('Schema test series','Test',(t->>'organization_id')::uuid,null);
  if not exists (select 1 from public.series where id=(s->>'series_id')::uuid) then raise exception 'Series creation failed'; end if;
  update public.tracks set default_classes='[{"name":"Fastest","type":"fastest_pass"},{"name":"Consistency","type":"consistency"}]'
    where id=(t->>'track_id')::uuid;
  v_event_id := public.create_track_event((t->>'track_id')::uuid,'Good event',current_date,'schema-test-good',array[]::uuid[]);
  if (select count(*) from public.event_classes where event_classes.event_id=v_event_id)<>2 then raise exception 'Default classes missing'; end if;
  foreign_series := public.create_series_with_organization('Other series','',null,'Other organization');
  insert into public.series_classes(series_id,name) values((foreign_series->>'series_id')::uuid,'Foreign class') returning id into foreign_class;
  begin
    update public.events set series_id=(foreign_series->>'series_id')::uuid where id=v_event_id;
    raise exception 'Cross-organization event assignment accepted' using errcode='XX000';
  exception when check_violation then null; end;
  begin
    insert into public.series_rosters(series_id,series_class_id,display_name)
      values((s->>'series_id')::uuid,foreign_class,'Driver');
    raise exception 'Cross-series roster accepted' using errcode='XX000';
  exception when foreign_key_violation then null; end;
  update public.tracks set default_classes='[{"name":"Broken","type":"bogus"}]' where id=(t->>'track_id')::uuid;
  begin
    perform public.create_track_event((t->>'track_id')::uuid,'Broken event',current_date,'schema-test-broken',array[]::uuid[]);
    raise exception 'Invalid defaults accepted' using errcode='XX000';
  exception when raise_exception then null; end;
  if exists (select 1 from public.events where slug='schema-test-broken') then raise exception 'Failed creation left an orphan event'; end if;
end $$;
set local request.jwt.claim.sub='fa000000-0000-4000-8000-000000000002';
do $$ begin
  begin
    perform public.create_track_event(current_setting('test.track_id')::uuid,'Unauthorized',current_date,'schema-test-unauthorized',array[]::uuid[]);
    raise exception 'Outsider created event' using errcode='XX000';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_series_with_organization('Unauthorized','',current_setting('test.org_id')::uuid,null);
    raise exception 'Outsider created series' using errcode='XX000';
  exception when raise_exception then null; end;
end $$;
reset role;
select 'schema_workflows: PASS (state, series, atomic defaults)' as result;
rollback;
