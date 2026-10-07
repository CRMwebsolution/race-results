begin;
insert into auth.users(id,email) values
  ('f8000000-0000-4000-8000-000000000001','session-two-owner@test.invalid'),
  ('f8000000-0000-4000-8000-000000000002','session-two-outsider@test.invalid');
set local role authenticated;
set local request.jwt.claim.sub='f8000000-0000-4000-8000-000000000001';
do $$
declare s jsonb; t jsonb; season uuid; class_id uuid; other_class uuid;
  member uuid; late_member uuid; wrong_class_member uuid; calendar uuid;
  race uuid; second_race uuid; race_class uuid; second_class uuid; entry uuid;
begin
  t:=public.register_track_with_state('Session two track',null,'America/New_York','session-two-track','NC');
  calendar:=public.schedule_track_calendar_event((t->>'track_id')::uuid,'Calendar only',current_date,'calendar-only');
  if (select status from public.events where id=calendar)<>'scheduled'
    or exists(select 1 from public.entries e join public.event_classes c on c.id=e.event_class_id where c.event_id=calendar)
    then raise exception 'Track calendar event requires racers or is not public'; end if;

  s:=public.create_series_with_organization('Session two series','',null,'Session two organizer');
  insert into public.series_classes(series_id,name) values((s->>'series_id')::uuid,'Open');
  season:=public.create_competition_season(null,(s->>'series_id')::uuid,'2026 season',current_date-10,null);
  select id into class_id from public.competition_classes where season_id=season;
  insert into public.competition_classes(season_id,name) values(season,'Other') returning id into other_class;
  insert into public.competition_registrations(season_id,class_id,display_name,vehicle_name,joined_on)
    values(season,class_id,'Jay','Truck one',current_date-1) returning id into member;
  insert into public.competition_registrations(season_id,class_id,display_name,vehicle_name,joined_on)
    values(season,class_id,'Late member','Truck two',current_date+1) returning id into late_member;
  insert into public.competition_registrations(season_id,class_id,display_name,vehicle_name,joined_on)
    values(season,other_class,'Other member','Truck three',current_date-1) returning id into wrong_class_member;

  insert into public.events(series_id,name,slug,local_date,status,venue_description)
    values((s->>'series_id')::uuid,'Series calendar only','series-calendar-only',current_date,'scheduled','Free-text venue') returning id into calendar;
  if (select competition_season_id from public.events where id=calendar) is not null
    or exists(select 1 from public.entries e join public.event_classes c on c.id=e.event_class_id where c.event_id=calendar)
    then raise exception 'Series calendar date requires a season or racers'; end if;

  insert into public.events(series_id,competition_season_id,name,slug,local_date,status,venue_description)
    values((s->>'series_id')::uuid,season,'First race','first-session-two-race',current_date,'scheduled','Venue one') returning id into race;
  insert into public.events(series_id,competition_season_id,name,slug,local_date,status,venue_description)
    values((s->>'series_id')::uuid,season,'Second race','second-session-two-race',current_date,'scheduled','Venue two') returning id into second_race;
  select id into race_class from public.event_classes where event_id=race;
  select id into second_class from public.event_classes where event_id=second_race;
  if exists(select 1 from public.entries where event_class_id in(race_class,second_class)) then
    raise exception 'Series members were automatically signed up'; end if;

  perform public.register_race_contestant((s->>'series_id')::uuid,race,race_class,'Jeremy local',null,null);
  entry:=public.register_race_contestant((s->>'series_id')::uuid,race,race_class,'Jay',null,member);
  if not exists(select 1 from public.entries where id=entry and order_num=2 and registration_id=member) then
    raise exception 'Member signup did not save its link and next running order'; end if;
  perform public.register_race_contestant((s->>'series_id')::uuid,second_race,second_class,'Jay',null,member);
  perform public.register_race_contestant((s->>'series_id')::uuid,second_race,second_class,'Jeremy local',null,null);
  if not exists(select 1 from public.entries where event_class_id=second_class and registration_id=member and order_num=1) then
    raise exception 'Running order carried over from a previous race'; end if;
  if (select count(*) from public.competition_registrations where season_id=season)<>3 then
    raise exception 'Local contestant was automatically enrolled in the series'; end if;

  begin
    perform public.register_race_contestant((s->>'series_id')::uuid,race,race_class,'Duplicate Jay',null,member);
    raise exception 'Duplicate membership signup accepted' using errcode='XX000';
  exception when unique_violation then null; end;
  begin
    perform public.register_race_contestant((s->>'series_id')::uuid,race,race_class,'Late member',null,late_member);
    raise exception 'Late membership accepted for earlier race' using errcode='XX000';
  exception when raise_exception then null; end;
  begin
    perform public.register_race_contestant((s->>'series_id')::uuid,race,race_class,'Wrong class',null,wrong_class_member);
    raise exception 'Wrong class membership accepted' using errcode='XX000';
  exception when raise_exception then null; end;
  perform set_config('request.jwt.claim.sub','f8000000-0000-4000-8000-000000000002',true);
  begin
    perform public.register_race_contestant((s->>'series_id')::uuid,race,race_class,'Unauthorized',null,null);
    raise exception 'Outsider signup accepted' using errcode='XX000';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','f8000000-0000-4000-8000-000000000001',true);
  if (select count(*) from public.entries where event_class_id=race_class)<>2 then
    raise exception 'Rejected signup left a partial entry'; end if;
end;
$$;
select 'PASS: individual signups, independent running orders, calendar-only dates, membership scope, and atomic rollback (two contestants per race)' as result;
rollback;
