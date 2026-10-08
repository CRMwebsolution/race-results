-- Track and touring series are independent owners. Preserve race IDs and snapshots.
alter table public.events add column venue_description text;
alter table public.events alter column track_id drop not null;
alter table public.event_classes alter column track_id drop not null;
alter table public.event_result_versions alter column track_id drop not null;
drop trigger if exists check_event_series_scope on public.events;
alter table public.events disable trigger guard_completed_metadata;
alter table public.event_classes disable trigger guard_race_data_change;
alter table public.event_classes disable trigger revise_race_event;
set constraints all deferred;
update public.events e set venue_description=t.name from public.tracks t where e.series_id is not null and t.id=e.track_id;
update public.event_classes c set track_id=null from public.events e where e.id=c.event_id and e.series_id is not null;
update public.events set track_id=null where series_id is not null;
set constraints all immediate;
alter table public.event_classes enable trigger guard_race_data_change;
alter table public.event_classes enable trigger revise_race_event;
alter table public.events enable trigger guard_completed_metadata;
alter table public.events add constraint events_exclusive_owner check ((track_id is null) <> (series_id is null));
alter table public.event_classes add constraint event_classes_parent_fkey foreign key(event_id) references public.events(id) on delete cascade;
create unique index events_series_slug_key on public.events(series_id,slug) where series_id is not null;
create index events_series_dates_idx on public.events(series_id,local_date);

create or replace function public.can_view_race(p_event_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.events e where e.id=p_event_id and (
 (e.track_id is not null and public.can_view_track(e.track_id)) or
 (e.series_id is not null and exists(select 1 from public.series s where s.id=e.series_id and (public.is_org_member(s.organization_id) or public.is_platform_admin()))) or
 e.status='scheduled' or (e.status in ('live','completed') and e.published_revision>0)));
$$;
create or replace function public.can_edit_race(p_event_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.events e where e.id=p_event_id and (
 (e.track_id is not null and public.can_edit_track(e.track_id)) or
 (e.series_id is not null and exists(select 1 from public.series s where s.id=e.series_id and (public.is_org_admin(s.organization_id) or public.is_platform_admin())))));
$$;
create or replace function public.can_manage_race(p_event_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.events e where e.id=p_event_id and (
 (e.track_id is not null and public.can_manage_track(e.track_id)) or
 (e.series_id is not null and exists(select 1 from public.series s where s.id=e.series_id and (public.is_org_admin(s.organization_id) or public.is_platform_admin())))));
$$;
create or replace function public.can_publish_race(p_event_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.events e where e.id=p_event_id and (
 (e.track_id is not null and public.can_publish_track(e.track_id)) or
 (e.series_id is not null and exists(select 1 from public.series s where s.id=e.series_id and (public.is_org_admin(s.organization_id) or public.is_platform_admin())))));
$$;
revoke all on function public.can_view_race(uuid),public.can_edit_race(uuid),public.can_manage_race(uuid),public.can_publish_race(uuid) from public;
grant execute on function public.can_view_race(uuid) to anon,authenticated;
grant execute on function public.can_edit_race(uuid),public.can_manage_race(uuid),public.can_publish_race(uuid) to authenticated;

create or replace function public.can_view_series_account(p_series_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.series where id=p_series_id and (public.is_org_member(organization_id) or public.is_platform_admin()));
$$;
revoke all on function public.can_view_series_account(uuid) from public;grant execute on function public.can_view_series_account(uuid) to anon,authenticated;

-- Rebuild racing policies against the owner of the race, never its venue name.
do $$ declare p record;begin for p in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('events','event_classes','entries','attempts','event_result_versions') loop execute format('drop policy %I on public.%I',p.policyname,p.tablename);end loop;end $$;
create policy events_read on public.events for select to anon,authenticated using((track_id is not null and public.can_view_track(track_id)) or public.can_view_series_account(series_id) or status='scheduled' or (status in ('live','completed') and published_revision>0));
create policy events_insert on public.events for insert to authenticated with check(
 (track_id is not null and series_id is null and public.can_manage_track(track_id)) or
 (track_id is null and series_id is not null and exists(select 1 from public.series s where s.id=series_id and (public.is_org_admin(s.organization_id) or public.is_platform_admin()))));
create policy events_update on public.events for update to authenticated using(public.can_manage_race(id)) with check(public.can_manage_race(id));
create policy classes_read on public.event_classes for select to anon,authenticated using(public.can_view_race(event_id));
create policy classes_manage on public.event_classes for all to authenticated using(public.can_manage_race(event_id)) with check(public.can_manage_race(event_id));
create policy entries_read on public.entries for select to anon,authenticated using(exists(select 1 from public.event_classes c where c.id=event_class_id and public.can_view_race(c.event_id)));
create policy entries_manage on public.entries for all to authenticated using(exists(select 1 from public.event_classes c where c.id=event_class_id and public.can_edit_race(c.event_id))) with check(exists(select 1 from public.event_classes c where c.id=event_class_id and public.can_edit_race(c.event_id)));
create policy attempts_read on public.attempts for select to anon,authenticated using(exists(select 1 from public.event_classes c where c.id=event_class_id and public.can_view_race(c.event_id)));
create policy attempts_manage on public.attempts for all to authenticated using(exists(select 1 from public.event_classes c where c.id=event_class_id and public.can_edit_race(c.event_id))) with check(exists(select 1 from public.event_classes c where c.id=event_class_id and public.can_edit_race(c.event_id)));
create policy versions_read on public.event_result_versions for select to anon,authenticated using(public.can_view_race(event_id));

-- Checked actions retain their signatures for prepared device queues.

CREATE OR REPLACE FUNCTION public.capture_official_result(p_event_id uuid, p_rows jsonb, p_source bigint, p_reconstructed boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.complete_race_event(p_event_id uuid, p_expected_revision bigint, p_ranks jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_event public.events; v_count integer;
begin
  select * into v_event from public.events where id=p_event_id for update;
  if not found or auth.uid() is null or not public.can_publish_race(v_event.id) then raise exception 'Not authorized to complete this event' using errcode='42501'; end if;
  if exists(select 1 from public.offline_scoring_sessions where event_id=p_event_id and closed_at is null) then raise exception 'Upload and close every prepared offline scoring session before finalizing';end if;
  if v_event.status='completed' then raise exception 'Reopen the event before finalizing again' using errcode='55000'; end if;
  if p_expected_revision is null or p_expected_revision<>v_event.working_revision then raise exception 'Results changed while standings were calculated. Try again.' using errcode='PT409'; end if;
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_race_entry(p_track_id uuid, p_event_id uuid, p_class_id uuid, p_display_name text, p_order_num integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_event public.events; v_order integer; v_entry uuid;
begin
  if auth.uid() is null or not public.can_edit_race(p_event_id) then raise exception 'Not authorized to manage this roster' using errcode='42501'; end if;
  select e.* into v_event from public.events e join public.event_classes c on c.event_id=e.id
    where e.id=p_event_id and coalesce(e.track_id,e.series_id)=p_track_id and c.id=p_class_id for update of e;
  if not found then raise exception 'Class and event do not match' using errcode='42501'; end if;
  if nullif(trim(p_display_name),'') is null then raise exception 'Racer name is required'; end if;
  select coalesce(max(order_num),0)+1 into v_order from public.entries where event_class_id=p_class_id;
  v_order:=coalesce(p_order_num,v_order);
  if v_order<1 then raise exception 'Draw number must be a positive integer'; end if;
  insert into public.entries(event_class_id,display_name,order_num) values(p_class_id,trim(p_display_name),v_order) returning id into v_entry;
  return v_entry;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.deactivate_judge(p_assignment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.event_classes;e public.events;begin select c0.* into c from public.event_classes c0 join public.judge_assignments j on j.event_class_id=c0.id where j.id=p_assignment_id;select * into e from public.events where id=c.event_id for update;if not found or auth.uid() is null or not public.can_manage_race(e.id) then raise exception 'Not authorized' using errcode='42501';end if;if e.status='completed' then raise exception 'Completed results locked';end if;update public.judge_assignments set active=false where id=p_assignment_id;update public.events set working_revision=working_revision+1,published_revision=case when status='live' then working_revision+1 else published_revision end where id=e.id;end $function$
;

CREATE OR REPLACE FUNCTION public.delete_or_withdraw_event(p_event_id uuid, p_confirm boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.events;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or auth.uid() is null or not public.can_publish_race(e.id)
 then raise exception 'Only an owner can delete or withdraw an event' using errcode='42501'; end if;
 if not p_confirm then raise exception 'Confirmation required'; end if;
 if e.status='completed'
 or exists(select 1 from public.entries en join public.event_classes c on c.id=en.event_class_id where c.event_id=e.id)
 or exists(select 1 from public.event_result_versions where event_id=e.id)
 or exists(select 1 from public.series_manual_awards where event_id=e.id)
 then
  update public.events set status='cancelled' where id=e.id;
  return 'withdrawn';
 end if;
 delete from public.events where id=e.id;
 return 'deleted';
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_race_data_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_event_id uuid; v_track_id uuid; v_status text;
begin
  if tg_table_name='event_classes' then
    v_event_id := case when tg_op='DELETE' then old.event_id else new.event_id end;
    if tg_op='UPDATE' and new.event_id<>old.event_id then raise exception 'Cannot move a class to another event'; end if;
  else
    select event_id into v_event_id from public.event_classes
      where id=case when tg_op='DELETE' then old.event_class_id else new.event_class_id end;
    if tg_op='UPDATE' and new.event_class_id<>old.event_class_id then raise exception 'Cannot move race data between classes'; end if;
  end if;
  select track_id,status into v_track_id,v_status from public.events where id=v_event_id for update;
  -- Cascades from a deleted event/class have no surviving parent to revise.
  if found then
    if current_setting('role',true) in ('authenticated','anon') and
       (auth.uid() is null or not public.can_edit_race(v_event_id)) then
      raise exception 'Not authorized to score this event' using errcode='42501';
    end if;
    if v_status='completed' then raise exception 'Completed results are locked; an owner must reopen the event' using errcode='55000'; end if;
  end if;
  if tg_table_name='attempts' and tg_op<>'DELETE' then
    new.save_version := case when tg_op='INSERT' then 1 else old.save_version+1 end;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.import_series_roster(p_event_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.events;c record;r record;n integer:=0;
begin select * into e from public.events where id=p_event_id for update;if not found or auth.uid() is null or not public.can_edit_race(e.id) then raise exception 'Not authorized' using errcode='42501';end if;
 if e.status='completed' then raise exception 'Reopen before editing roster';end if;
 for c in select * from public.event_classes where event_id=e.id and series_class_id is not null order by order_num loop
  for r in select * from public.series_rosters where series_id=e.series_id and series_class_id=c.series_class_id order by created_at,id loop
   if not exists(select 1 from public.entries where event_class_id=c.id and series_roster_id=r.id) then
    insert into public.entries(event_class_id,display_name,order_num,series_roster_id) select c.id,r.display_name,coalesce(max(order_num),0)+1,r.id from public.entries where event_class_id=c.id;n:=n+1;
   end if;
  end loop;
 end loop;return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.initialize_series_event(p_event_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.events; n integer;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or (current_setting('role',true) in ('anon','authenticated') and (auth.uid() is null or not public.can_manage_race(e.id))) then raise exception 'Not authorized' using errcode='42501'; end if;
 if e.defaults_initialized or e.series_id is null then return 0; end if;
 if e.status not in ('draft','scheduled') or exists(select 1 from public.event_classes where event_id=e.id) then raise exception 'Initialize only an empty unstarted event'; end if;
 insert into public.event_classes(event_id,track_id,series_class_id,name,rules_text,entry_fee_text,scoring_type,scoring_config,order_num)
 select e.id,e.track_id,id,name,rules_text,entry_fee_text,scoring_type,scoring_config,row_number() over(order by order_num,id) from public.series_classes where series_id=e.series_id;
 get diagnostics n=row_count;
 update public.events set defaults_initialized=true where id=e.id;
 return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.prepare_offline_event(p_event_id uuid, p_device_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.events;t public.tracks;session_id uuid;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or auth.uid() is null or not public.can_edit_race(e.id)
 then raise exception 'Not authorized' using errcode='42501';end if;
 if e.status='completed' then raise exception 'Completed event is locked';end if;
 select * into t from public.tracks where id=e.track_id;
 insert into public.offline_scoring_sessions(user_id,event_id,device_id)
 values(auth.uid(),e.id,p_device_id)
 on conflict(user_id,event_id,device_id) do update set closed_at=null,prepared_at=now()
 returning id into session_id;
 return jsonb_build_object(
  'sessionId',session_id,'accountId',auth.uid(),'trackId',coalesce(e.track_id,e.series_id),'ownerType',case when e.series_id is null then 'track' else 'series' end,'seriesId',e.series_id,'trackSlug',t.slug,'eventSlug',e.slug,
  'event',to_jsonb(e),
  'classes',coalesce((select jsonb_agg(to_jsonb(c) order by c.order_num) from public.event_classes c where event_id=e.id),'[]'::jsonb),
  'initialEntries',coalesce((select jsonb_agg(to_jsonb(en) order by en.order_num) from public.entries en join public.event_classes c on c.id=en.event_class_id where c.event_id=e.id),'[]'::jsonb),
  'initialAttempts',coalesce((select jsonb_agg(to_jsonb(a)) from public.attempts a join public.event_classes c on c.id=a.event_class_id where c.event_id=e.id),'[]'::jsonb),
  'judgeScores',coalesce((select jsonb_agg(jsonb_build_object('assignmentId',s.assignment_id,'entryId',s.entry_id,'ordinal',s.ordinal,'values',s."values")) from public.judge_scores s join public.judge_assignments j on j.id=s.assignment_id and j.active join public.event_classes c on c.id=s.event_class_id where c.event_id=e.id),'[]'::jsonb)
 );
end $function$
;

CREATE OR REPLACE FUNCTION public.release_offline_session(p_session_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.offline_scoring_sessions;e public.events;begin select * into s from public.offline_scoring_sessions where id=p_session_id;select * into e from public.events where id=s.event_id for update;if not found or auth.uid() is null or not public.can_publish_race(e.id) then raise exception 'Only an owner can release an abandoned device session' using errcode='42501';end if;if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Explain why this device session can be released';end if;
 update public.offline_scoring_sessions set closed_at=now() where id=s.id;
 insert into public.audit_events(organization_id,track_id,actor_id,action,target_type,target_id,before_data,after_data) select t.organization_id,e.track_id,auth.uid(),'offline_session_released','offline_session',s.id,to_jsonb(s),jsonb_build_object('reason',p_reason,'closed',true) from (select organization_id from public.tracks where id=e.track_id union all select organization_id from public.series where id=e.series_id) t;
end $function$
;

CREATE OR REPLACE FUNCTION public.remove_event_class(p_event_id uuid, p_class_id uuid, p_confirm boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.events;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or auth.uid() is null or not public.can_manage_race(e.id) then raise exception 'Not authorized' using errcode='42501'; end if;
 if not p_confirm and exists(select 1 from public.entries where event_class_id=p_class_id) then raise exception 'Confirm removal of this class and its racers/results'; end if;
 delete from public.event_classes where id=p_class_id and event_id=e.id;
 if not found then raise exception 'Class not found'; end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.reorder_event_classes(p_event_id uuid, p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.events;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or auth.uid() is null or not public.can_manage_race(e.id) then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_ids is null or cardinality(p_ids)<>(select count(*) from public.event_classes where event_id=e.id) or (select count(distinct x) from unnest(p_ids) x)<>cardinality(p_ids) or exists(select 1 from unnest(p_ids) x where not exists(select 1 from public.event_classes where id=x and event_id=e.id)) then raise exception 'Class list changed; reload before reordering'; end if;
 set constraints public.event_classes_event_order_key deferred;
 update public.event_classes c set order_num=u.n from unnest(p_ids) with ordinality u(id,n) where c.id=u.id;
 set constraints public.event_classes_event_order_key immediate;
end $function$
;

CREATE OR REPLACE FUNCTION public.save_judge_score(p_assignment_id uuid, p_entry_id uuid, p_ordinal integer, p_values jsonb, p_expected_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j public.judge_assignments;c public.event_classes;e public.events;s public.judge_scores;old_s public.judge_scores;r jsonb;category jsonb;value numeric;
begin select * into j from public.judge_assignments where id=p_assignment_id;select * into c from public.event_classes where id=j.event_class_id;select * into e from public.events where id=c.event_id for update;
 if not found or auth.uid() is null or j.user_id is distinct from auth.uid() or not j.active or not public.can_edit_race(e.id) then raise exception 'Only the assigned judge may enter these scores' using errcode='42501';end if;
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
 if p_expected_version is null or coalesce(old_s.save_version,0)<>p_expected_version then raise exception 'Judge score changed; reload before saving' using errcode='PT409';end if;
 insert into public.judge_scores(event_class_id,assignment_id,entry_id,ordinal,"values") values(c.id,j.id,p_entry_id,p_ordinal,p_values) on conflict(assignment_id,entry_id,ordinal) do update set "values"=excluded."values",save_version=judge_scores.save_version+1,updated_at=now() returning * into s;
 insert into public.judge_score_history(event_class_id,score_id,actor_id,before_data,after_data) values(c.id,s.id,auth.uid(),case when old_s.id is null then null else to_jsonb(old_s) end,to_jsonb(s));
 update public.events set working_revision=working_revision+1,published_revision=case when status='live' then working_revision+1 else published_revision end where id=e.id;
 return to_jsonb(s);
end $function$
;

CREATE OR REPLACE FUNCTION public.save_race_attempt(p_track_id uuid, p_event_id uuid, p_class_id uuid, p_entry_id uuid, p_ordinal integer, p_status text, p_elapsed_ms integer, p_distance_mm integer, p_penalty_ms integer, p_raw_input text, p_expected_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_event public.events; v_attempt public.attempts; v_version integer;
begin
  if auth.uid() is null or not public.can_edit_race(p_event_id) then raise exception 'Not authorized to score this track' using errcode='42501'; end if;
  select * into v_event from public.events where id=p_event_id and coalesce(track_id,series_id)=p_track_id for update;
  if not found then raise exception 'Event not found' using errcode='42501'; end if;
  if v_event.status='completed' then raise exception 'Completed results are locked' using errcode='55000'; end if;
  if not exists(select 1 from public.entries en join public.event_classes c on c.id=en.event_class_id
    where en.id=p_entry_id and c.id=p_class_id and c.event_id=p_event_id and (c.track_id is null or c.track_id=p_track_id)) then
    raise exception 'Entry, class and event do not match' using errcode='23514';
  end if;
  if exists(select 1 from public.event_classes where id=p_class_id and scoring_type='judged_points') then raise exception 'Use the dedicated judge scoring form';end if;
  if p_ordinal is null or p_ordinal<1 or p_ordinal>100 or p_expected_version is null or p_expected_version<0 then
    raise exception 'Invalid pass number or save version' using errcode='22023';
  end if;
  select save_version into v_version from public.attempts where entry_id=p_entry_id and ordinal=p_ordinal;
  if coalesce(v_version,0)<>p_expected_version then
    raise exception 'This pass changed in another scoring session. Refresh before editing it again.' using errcode='PT409';
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
$function$
;

CREATE OR REPLACE FUNCTION public.save_race_attempt_operation(p_operation_id uuid, p_track_id uuid, p_event_id uuid, p_class_id uuid, p_entry_id uuid, p_ordinal integer, p_status text, p_elapsed_ms integer, p_distance_mm integer, p_penalty_ms integer, p_raw_input text, p_expected_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare receipt public.race_operation_receipts;req jsonb;result jsonb;
begin
 if auth.uid() is null or not public.can_edit_race(p_event_id) then raise exception 'Not authorized to score this track' using errcode='42501';end if;
 if p_operation_id is null then raise exception 'Operation ID required';end if;
 perform 1 from public.events where id=p_event_id and coalesce(track_id,series_id)=p_track_id for update;if not found then raise exception 'Event not found';end if;
 req:=jsonb_build_object('track',p_track_id,'event',p_event_id,'class',p_class_id,'entry',p_entry_id,'ordinal',p_ordinal,'status',p_status,'elapsed',p_elapsed_ms,'distance',p_distance_mm,'penalty',p_penalty_ms,'raw',p_raw_input,'version',p_expected_version);
 select * into receipt from public.race_operation_receipts where user_id=auth.uid() and operation_id=p_operation_id;
 if found then if receipt.request<>req then raise exception 'Operation ID reused with different values';end if;return receipt.result;end if;
 result:=public.save_race_attempt(p_track_id,p_event_id,p_class_id,p_entry_id,p_ordinal,p_status,p_elapsed_ms,p_distance_mm,p_penalty_ms,p_raw_input,p_expected_version);
 insert into public.race_operation_receipts(user_id,event_id,operation_id,request,result) values(auth.uid(),p_event_id,p_operation_id,req,result);return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_class_judge(p_class_id uuid, p_user_id uuid, p_label text, p_active boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.event_classes;e public.events;
begin select * into c from public.event_classes where id=p_class_id;select * into e from public.events where id=c.event_id for update;
 if not found or auth.uid() is null or not public.can_manage_race(e.id) then raise exception 'Not authorized' using errcode='42501';end if;
 if e.status='completed' then raise exception 'Completed results are locked';end if;
 if not exists(select 1 from public.race_judge_candidates(e.id) where user_id=p_user_id) then raise exception 'Assign an existing owner, administrator or official of this track';end if;
 insert into public.judge_assignments(event_class_id,user_id,label,active) values(c.id,p_user_id,p_label,p_active) on conflict(event_class_id,user_id) do update set label=excluded.label,active=excluded.active;
 update public.events set working_revision=working_revision+1,published_revision=case when status='live' then working_revision+1 else published_revision end where id=e.id;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_race_event_status(p_event_id uuid, p_status text, p_expected_revision bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_event public.events;
begin
  select * into v_event from public.events where id=p_event_id for update;
  if not found or auth.uid() is null or not public.can_publish_race(v_event.id) then raise exception 'Not authorized to manage this event' using errcode='42501'; end if;
  if p_expected_revision is null or p_expected_revision<>v_event.working_revision then raise exception 'Event changed; refresh and try again' using errcode='PT409'; end if;
  if p_status not in ('draft','scheduled','live','cancelled') or p_status is null then raise exception 'Invalid event status'; end if;
  update public.events set status=p_status where id=p_event_id returning * into v_event;
  if v_event.status<>'completed' then
    update public.entries set final_rank=null where event_class_id in(select id from public.event_classes where event_id=p_event_id) and final_rank is not null;
  end if;
  return to_jsonb(v_event);
end;
$function$
;


-- Race ownership is immutable through arbitrary updates.
create or replace function public.guard_race_owner() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='events' then
 if tg_op='UPDATE' and (new.track_id,new.series_id) is distinct from (old.track_id,old.series_id) then raise exception 'Race ownership cannot be transferred' using errcode='23514';end if;
 end if;
 if tg_table_name='event_classes' then
  if new.track_id is distinct from (select track_id from public.events where id=new.event_id) then raise exception 'Class ownership must match race';end if;
 end if;
 return new;
end $$;
create trigger guard_race_owner before update on public.events for each row execute function public.guard_race_owner();
create trigger guard_class_owner before insert or update on public.event_classes for each row execute function public.guard_race_owner();
revoke all on function public.guard_race_owner() from public,anon,authenticated;

create or replace function public.race_judge_candidates(p_event_id uuid) returns table(user_id uuid,label text) language sql stable security definer set search_path='' as $$
 select distinct p.id,coalesce(nullif(p.display_name,''),p.email) from public.profiles p join public.events e on e.id=p_event_id
 where public.can_manage_race(e.id) and (
 (e.track_id is not null and p.id in(select j.user_id from public.judge_candidates(e.track_id) j)) or
 (e.series_id is not null and exists(select 1 from public.series s join public.organization_memberships m on m.organization_id=s.organization_id where s.id=e.series_id and m.user_id=p.id and m.active)));
$$;
revoke all on function public.race_judge_candidates(uuid) from public,anon;grant execute on function public.race_judge_candidates(uuid) to authenticated;

-- Rewrite the lifecycle guard's authorization without changing atomic finalization.
do $$ declare s text;begin select pg_get_functiondef('public.guard_event_lifecycle()'::regprocedure) into s;execute replace(s,'public.can_publish_track(old.track_id)','public.can_publish_race(old.id)');end $$;
create or replace function public.audit_event_lifecycle() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.status is distinct from old.status then
 insert into public.audit_events(organization_id,track_id,actor_id,action,target_type,target_id,before_data,after_data)
 select o.organization_id,new.track_id,auth.uid(),case when old.status='completed' then 'event_reopened' when new.status='completed' then 'event_completed' else 'event_status_changed' end,'event',new.id,to_jsonb(old),to_jsonb(new)
 from (select organization_id from public.tracks where id=new.track_id union all select organization_id from public.series where id=new.series_id) o;
 end if;return null;end $$;
alter policy offline_sessions_read on public.offline_scoring_sessions using(user_id=auth.uid() or public.can_publish_race(event_id));
alter policy judge_history_read on public.judge_score_history using(exists(select 1 from public.event_classes c where c.id=event_class_id and public.can_manage_race(c.event_id)));

create or replace function public.edit_race_event(p_event_id uuid,p_name text,p_date date,p_track_id uuid,p_expected_revision bigint) returns void language plpgsql security definer set search_path='' as $$
declare e public.events;begin select * into e from public.events where id=p_event_id for update;
 if not found or auth.uid() is null or not public.can_manage_race(e.id) or coalesce(e.track_id,e.series_id) is distinct from p_track_id then raise exception 'Not authorized' using errcode='42501';end if;
 if e.status='completed' then raise exception 'Reopen before editing a completed event';end if;
 if e.working_revision<>p_expected_revision then raise exception 'Event changed; reload' using errcode='PT409';end if;
 if nullif(trim(p_name),'') is null or p_date is null then raise exception 'Name and date required';end if;
 update public.events set name=trim(p_name),local_date=p_date,working_revision=working_revision+1,published_revision=case when status='live' then working_revision+1 else published_revision end where id=e.id;
end $$;
-- Venue descriptions are metadata, not account relationships.
create or replace function public.edit_series_venue(p_event_id uuid,p_description text) returns void language plpgsql security definer set search_path='' as $$
begin if not public.can_manage_race(p_event_id) or not exists(select 1 from public.events where id=p_event_id and series_id is not null) then raise exception 'Not authorized' using errcode='42501';end if;
 if exists(select 1 from public.events where id=p_event_id and status='completed') then raise exception 'Reopen before editing';end if;
 update public.events set venue_description=trim(p_description),working_revision=working_revision+1 where id=p_event_id;end $$;
revoke all on function public.edit_series_venue(uuid,text) from public,anon;grant execute on function public.edit_series_venue(uuid,text) to authenticated;
revoke execute on function public.create_ghost_track(uuid,text,text,text) from authenticated;
notify pgrst,'reload schema';
