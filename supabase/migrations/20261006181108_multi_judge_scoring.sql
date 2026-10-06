create table public.judge_assignments(id uuid primary key default gen_random_uuid(),event_class_id uuid not null references public.event_classes(id) on delete cascade,user_id uuid references auth.users(id),label text not null,active boolean not null default true,legacy boolean not null default false,unique(event_class_id,user_id));
create table public.judge_scores(id uuid primary key default gen_random_uuid(),event_class_id uuid not null references public.event_classes(id) on delete cascade,assignment_id uuid not null references public.judge_assignments(id) on delete cascade,entry_id uuid not null,ordinal integer not null check(ordinal between 1 and 100),"values" jsonb not null,save_version integer not null default 1,updated_at timestamptz not null default now(),unique(assignment_id,entry_id,ordinal),foreign key(event_class_id,entry_id) references public.entries(event_class_id,id) on delete cascade);
create table public.judge_score_history(id uuid primary key default gen_random_uuid(),event_class_id uuid not null,score_id uuid not null,actor_id uuid,changed_at timestamptz not null default now(),before_data jsonb,after_data jsonb not null);
create index judge_scores_class_idx on public.judge_scores(event_class_id);
create index judge_assignments_user_idx on public.judge_assignments(user_id);
alter table public.judge_assignments enable row level security;alter table public.judge_scores enable row level security;alter table public.judge_score_history enable row level security;
create policy judges_read on public.judge_assignments for select to anon,authenticated using(exists(select 1 from public.event_classes c where c.id=event_class_id));
create policy judge_scores_read on public.judge_scores for select to anon,authenticated using(exists(select 1 from public.event_classes c where c.id=event_class_id) and exists(select 1 from public.judge_assignments j where j.id=assignment_id and j.active));
create policy judge_history_read on public.judge_score_history for select to authenticated using(exists(select 1 from public.event_classes c where c.id=event_class_id and public.can_manage_track(c.track_id)));
grant select on public.judge_assignments,public.judge_scores to anon,authenticated;grant select on public.judge_score_history to authenticated;
revoke insert,update,delete on public.judge_assignments,public.judge_scores,public.judge_score_history from public,anon,authenticated;
create or replace function public.judge_candidates(p_track_id uuid) returns table(user_id uuid,label text) language sql stable security definer set search_path='' as $$
 select distinct p.id,coalesce(nullif(p.display_name,''),p.email) from public.profiles p where public.can_manage_track(p_track_id) and (exists(select 1 from public.track_memberships m where m.user_id=p.id and m.track_id=p_track_id and m.active and m.role in ('owner','administrator','official')) or exists(select 1 from public.organization_memberships m join public.tracks t on t.organization_id=m.organization_id where m.user_id=p.id and t.id=p_track_id and m.active and m.role in ('owner','admin')));
$$;
create or replace function public.set_class_judge(p_class_id uuid,p_user_id uuid,p_label text,p_active boolean default true) returns void language plpgsql security definer set search_path='' as $$
declare c public.event_classes;e public.events;
begin select * into c from public.event_classes where id=p_class_id;select * into e from public.events where id=c.event_id for update;
 if not found or auth.uid() is null or not public.can_manage_track(e.track_id) then raise exception 'Not authorized' using errcode='42501';end if;
 if e.status='completed' then raise exception 'Completed results are locked';end if;
 if not exists(select 1 from public.judge_candidates(e.track_id) where user_id=p_user_id) then raise exception 'Assign an existing owner, administrator or official of this track';end if;
 insert into public.judge_assignments(event_class_id,user_id,label,active) values(c.id,p_user_id,p_label,p_active) on conflict(event_class_id,user_id) do update set label=excluded.label,active=excluded.active;
 update public.events set working_revision=working_revision+1,published_revision=case when status='live' then working_revision+1 else published_revision end where id=e.id;
end $$;
create or replace function public.save_judge_score(p_assignment_id uuid,p_entry_id uuid,p_ordinal integer,p_values jsonb,p_expected_version integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.judge_assignments;c public.event_classes;e public.events;s public.judge_scores;old_s public.judge_scores;r jsonb;category jsonb;value numeric;
begin select * into j from public.judge_assignments where id=p_assignment_id;select * into c from public.event_classes where id=j.event_class_id;select * into e from public.events where id=c.event_id for update;
 if not found or auth.uid() is null or j.user_id is distinct from auth.uid() or not j.active or not public.can_edit_track(e.track_id) then raise exception 'Only the assigned judge may enter these scores' using errcode='42501';end if;
 if e.status='completed' then raise exception 'Completed results are locked';end if;
 if c.scoring_type<>'judged_points' or not exists(select 1 from public.entries where id=p_entry_id and event_class_id=c.id) then raise exception 'Entry does not belong to judged class';end if;
 if p_ordinal is null or p_ordinal<1 or p_ordinal>coalesce((c.scoring_config->>'judgedRounds')::integer,1) then raise exception 'Invalid judged round';end if;
 r:=coalesce(c.scoring_config->'rubric','[{"key":"total","label":"Total","max":100}]'::jsonb);
 if jsonb_typeof(p_values)<>'object' or (select count(*) from jsonb_object_keys(p_values))<>jsonb_array_length(r) then raise exception 'Submit all configured categories';end if;
 for category in select * from jsonb_array_elements(r) loop
  if jsonb_typeof(p_values->(category->>'key')) is distinct from 'number' then raise exception 'Category score must be a number';end if;
  value:=(p_values->>(category->>'key'))::numeric;
  if value<0 or value>(category->>'max')::numeric or scale(value)>3 then raise exception 'Category score is outside its limits or precision';end if;
 end loop;
 select * into old_s from public.judge_scores where assignment_id=j.id and entry_id=p_entry_id and ordinal=p_ordinal;
 if p_expected_version is null or coalesce(old_s.save_version,0)<>p_expected_version then raise exception 'Judge score changed; reload before saving' using errcode='40001';end if;
 insert into public.judge_scores(event_class_id,assignment_id,entry_id,ordinal,"values") values(c.id,j.id,p_entry_id,p_ordinal,p_values) on conflict(assignment_id,entry_id,ordinal) do update set "values"=excluded."values",save_version=judge_scores.save_version+1,updated_at=now() returning * into s;
 insert into public.judge_score_history(event_class_id,score_id,actor_id,before_data,after_data) values(c.id,s.id,auth.uid(),case when old_s.id is null then null else to_jsonb(old_s) end,to_jsonb(s));
 update public.events set working_revision=working_revision+1,published_revision=case when status='live' then working_revision+1 else published_revision end where id=e.id;
 return to_jsonb(s);
end $$;
revoke all on function public.judge_candidates(uuid),public.set_class_judge(uuid,uuid,text,boolean),public.save_judge_score(uuid,uuid,integer,jsonb,integer) from public,anon;
grant execute on function public.judge_candidates(uuid),public.set_class_judge(uuid,uuid,text,boolean),public.save_judge_score(uuid,uuid,integer,jsonb,integer) to authenticated;
-- Keep old numerical totals while moving point storage out of elapsed time.
alter table public.event_classes disable trigger guard_race_data_change;
alter table public.event_classes disable trigger revise_race_event;
do $$ declare c record;j uuid;max_total numeric;begin
 for c in select * from public.event_classes where scoring_type='judged_points' and exists(select 1 from public.attempts where event_class_id=event_classes.id and status='valid' and elapsed_ms is not null) loop
  select greatest(100,coalesce(max(total),0)) into max_total from (select sum(elapsed_ms)/1000.0 total from public.attempts where event_class_id=c.id and status='valid' group by entry_id) x;
  update public.event_classes set scoring_config=scoring_config || jsonb_build_object('judgeCount',1,'judgedRounds',1,'aggregation','sum','rubric',jsonb_build_array(jsonb_build_object('key','total','label','Total','max',max_total))) where id=c.id;
  -- Completed metadata is preserved; converted working scores are for future reopening only.
  insert into public.judge_assignments(event_class_id,label,legacy) values(c.id,'Imported legacy total',true) returning id into j;
  insert into public.judge_scores(event_class_id,assignment_id,entry_id,ordinal,"values") select c.id,j,entry_id,1,jsonb_build_object('total',sum(elapsed_ms)/1000.0) from public.attempts where event_class_id=c.id and status='valid' and elapsed_ms is not null group by entry_id;
 end loop;
end $$;
alter table public.event_classes enable trigger guard_race_data_change;
alter table public.event_classes enable trigger revise_race_event;

create or replace function public.capture_official_result(p_event_id uuid,p_rows jsonb,p_source bigint,p_reconstructed boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.events; v_id uuid; v_payload jsonb;
begin
 select * into e from public.events where id=p_event_id for update;
 v_payload:=jsonb_build_object('event',to_jsonb(e),'classes',coalesce((select jsonb_agg(to_jsonb(c) order by c.order_num,c.id) from public.event_classes c where event_id=e.id),'[]'::jsonb),
 'entries',coalesce((select jsonb_agg(to_jsonb(en) order by en.order_num,en.id) from public.entries en join public.event_classes c on c.id=en.event_class_id where c.event_id=e.id),'[]'::jsonb),
 'attempts',coalesce((select jsonb_agg(to_jsonb(a) order by a.entry_id,a.ordinal) from public.attempts a join public.event_classes c on c.id=a.event_class_id where c.event_id=e.id),'[]'::jsonb),
 'judge_assignments',coalesce((select jsonb_agg(to_jsonb(j)) from public.judge_assignments j join public.event_classes c on c.id=j.event_class_id where c.event_id=e.id),'[]'::jsonb),'judge_scores',coalesce((select jsonb_agg(to_jsonb(s)) from public.judge_scores s join public.event_classes c on c.id=s.event_class_id where c.event_id=e.id),'[]'::jsonb),
 'results',coalesce(p_rows,'[]'::jsonb),'engine_version',1);
 insert into public.event_result_versions(event_id,track_id,version,source_revision,actor_id,finalized_at,reconstructed,payload)
 select e.id,e.track_id,coalesce(max(version),0)+1,p_source,case when p_reconstructed then null else auth.uid() end,case when p_reconstructed then null else now() end,p_reconstructed,v_payload from public.event_result_versions where event_id=e.id returning id into v_id;
 return v_id;
end $$;

create or replace function public.save_race_attempt(
  p_track_id uuid,p_event_id uuid,p_class_id uuid,p_entry_id uuid,p_ordinal integer,
  p_status text,p_elapsed_ms integer,p_distance_mm integer,p_penalty_ms integer,p_raw_input text,
  p_expected_version integer
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_event public.events; v_attempt public.attempts; v_version integer;
begin
  if auth.uid() is null or not public.can_edit_track(p_track_id) then raise exception 'Not authorized to score this track' using errcode='42501'; end if;
  select * into v_event from public.events where id=p_event_id and track_id=p_track_id for update;
  if not found then raise exception 'Event not found' using errcode='42501'; end if;
  if v_event.status='completed' then raise exception 'Completed results are locked' using errcode='55000'; end if;
  if not exists(select 1 from public.entries en join public.event_classes c on c.id=en.event_class_id
    where en.id=p_entry_id and c.id=p_class_id and c.event_id=p_event_id and c.track_id=p_track_id) then
    raise exception 'Entry, class and event do not match' using errcode='23514';
  end if;
  if exists(select 1 from public.event_classes where id=p_class_id and scoring_type='judged_points') then raise exception 'Use the dedicated judge scoring form';end if;
  if p_ordinal is null or p_ordinal<1 or p_ordinal>100 or p_expected_version is null or p_expected_version<0 then
    raise exception 'Invalid pass number or save version' using errcode='22023';
  end if;
  select save_version into v_version from public.attempts where entry_id=p_entry_id and ordinal=p_ordinal;
  if coalesce(v_version,0)<>p_expected_version then
    raise exception 'This pass changed in another scoring session. Refresh before editing it again.' using errcode='40001';
  end if;
  insert into public.attempts(event_class_id,entry_id,ordinal,status,elapsed_ms,distance_mm,penalty_ms,raw_input)
    values(p_class_id,p_entry_id,p_ordinal,p_status,p_elapsed_ms,p_distance_mm,p_penalty_ms,p_raw_input)
    on conflict(entry_id,ordinal) do update set status=excluded.status,elapsed_ms=excluded.elapsed_ms,
      distance_mm=excluded.distance_mm,penalty_ms=excluded.penalty_ms,raw_input=excluded.raw_input
    returning * into v_attempt;
  select * into v_event from public.events where id=p_event_id;
  return jsonb_build_object('attempt',to_jsonb(v_attempt),'working_revision',v_event.working_revision,
    'published_revision',v_event.published_revision);
end;
$$;
revoke all on function public.save_race_attempt(uuid,uuid,uuid,uuid,integer,text,integer,integer,integer,text,integer) from public,anon;
grant execute on function public.save_race_attempt(uuid,uuid,uuid,uuid,integer,text,integer,integer,integer,text,integer) to authenticated;


notify pgrst,'reload schema';

create or replace function public.deactivate_judge(p_assignment_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.event_classes;e public.events;begin select c0.* into c from public.event_classes c0 join public.judge_assignments j on j.event_class_id=c0.id where j.id=p_assignment_id;select * into e from public.events where id=c.event_id for update;if not found or auth.uid() is null or not public.can_manage_track(e.track_id) then raise exception 'Not authorized' using errcode='42501';end if;if e.status='completed' then raise exception 'Completed results locked';end if;update public.judge_assignments set active=false where id=p_assignment_id;update public.events set working_revision=working_revision+1,published_revision=case when status='live' then working_revision+1 else published_revision end where id=e.id;end $$;
revoke all on function public.deactivate_judge(uuid) from public,anon;grant execute on function public.deactivate_judge(uuid) to authenticated;

create or replace function public.complete_race_event(p_event_id uuid,p_expected_revision bigint,p_ranks jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_event public.events; v_count integer;
begin
  select * into v_event from public.events where id=p_event_id for update;
  if not found or auth.uid() is null or not public.can_publish_track(v_event.track_id) then raise exception 'Not authorized to complete this event' using errcode='42501'; end if;
  if v_event.status='completed' then raise exception 'Reopen the event before finalizing again' using errcode='55000'; end if;
  if p_expected_revision is null or p_expected_revision<>v_event.working_revision then raise exception 'Results changed while standings were calculated. Try again.' using errcode='40001'; end if;
  if jsonb_typeof(p_ranks) is distinct from 'array' then raise exception 'Invalid standings'; end if;
  select count(*) into v_count from public.entries en join public.event_classes c on c.id=en.event_class_id where c.event_id=p_event_id;
  if jsonb_array_length(p_ranks)<>v_count or
     (select count(distinct id) from jsonb_to_recordset(p_ranks) as r(id uuid,final_rank integer))<>v_count or
     exists(select 1 from jsonb_to_recordset(p_ranks) as r(id uuid,final_rank integer) where
       r.final_rank<1 or not exists(select 1 from public.entries en join public.event_classes c on c.id=en.event_class_id where en.id=r.id and c.event_id=p_event_id)) then
    raise exception 'Standings must include every entry in this event exactly once' using errcode='23514';
  end if;
  if exists(select 1 from public.event_classes c join public.entries en on en.event_class_id=c.id cross join lateral generate_series(1,coalesce((c.scoring_config->>'judgedRounds')::integer,1)) round where c.event_id=p_event_id and c.scoring_type='judged_points' and (select count(*) from public.judge_scores s join public.judge_assignments j on j.id=s.assignment_id where s.entry_id=en.id and s.ordinal=round and j.active)<>coalesce((c.scoring_config->>'judgeCount')::integer,1)) then raise exception 'All required judge submissions must be complete before finalizing';end if;
  perform set_config('raceholler.result_rows',p_ranks::text,true);
  perform set_config('raceholler.result_source',p_expected_revision::text,true);
  update public.entries en set final_rank=r.final_rank from jsonb_to_recordset(p_ranks) as r(id uuid,final_rank integer) where en.id=r.id;
  perform set_config('raceholler.completing',p_event_id::text,true);
  update public.events set status='completed',published_revision=working_revision where id=p_event_id returning * into v_event;
  perform set_config('raceholler.completing','',true);
  return to_jsonb(v_event);
end;
$$;


create or replace function public.validate_judge_config() returns trigger language plpgsql set search_path='' as $$
declare c jsonb;r jsonb;begin
 if new.scoring_type='judged_points' then c:=new.scoring_config;
 if jsonb_typeof(c)<>'object' or coalesce((c->>'judgeCount')::integer,1) not between 1 and 20 or coalesce((c->>'judgedRounds')::integer,1) not between 1 and 100 or coalesce(c->>'aggregation','sum') not in ('sum','average') then raise exception 'Invalid judge configuration';end if;
 r:=coalesce(c->'rubric','[{"key":"total","label":"Total","max":100}]'::jsonb);
 if jsonb_typeof(r)<>'array' or jsonb_array_length(r) not between 1 and 10 or (select count(distinct x->>'key') from jsonb_array_elements(r) x)<>jsonb_array_length(r) or exists(select 1 from jsonb_array_elements(r) x where nullif(x->>'key','') is null or nullif(x->>'label','') is null or jsonb_typeof(x->'max') is distinct from 'number' or (x->>'max')::numeric<=0 or (x->>'max')::numeric>1000000000) then raise exception 'Invalid judge categories or limits';end if;
 end if;return new;
end $$;
create trigger validate_judge_config before insert or update on public.event_classes for each row execute function public.validate_judge_config();
create trigger validate_judge_config before insert or update on public.series_classes for each row execute function public.validate_judge_config();
revoke all on function public.validate_judge_config() from public,anon,authenticated;
