create table public.race_operation_receipts(user_id uuid not null,event_id uuid not null references public.events(id) on delete cascade,operation_id uuid not null,request jsonb not null,result jsonb not null,created_at timestamptz not null default now(),primary key(user_id,operation_id));
alter table public.race_operation_receipts enable row level security;create policy operation_receipts_read on public.race_operation_receipts for select to authenticated using(user_id=auth.uid());grant select on public.race_operation_receipts to authenticated;revoke insert,update,delete on public.race_operation_receipts from public,anon,authenticated;
create or replace function public.save_race_attempt_operation(p_operation_id uuid,p_track_id uuid,p_event_id uuid,p_class_id uuid,p_entry_id uuid,p_ordinal integer,p_status text,p_elapsed_ms integer,p_distance_mm integer,p_penalty_ms integer,p_raw_input text,p_expected_version integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt public.race_operation_receipts;req jsonb;result jsonb;
begin
 if auth.uid() is null or not public.can_edit_track(p_track_id) then raise exception 'Not authorized to score this track' using errcode='42501';end if;
 if p_operation_id is null then raise exception 'Operation ID required';end if;
 perform 1 from public.events where id=p_event_id and track_id=p_track_id for update;if not found then raise exception 'Event not found';end if;
 req:=jsonb_build_object('track',p_track_id,'event',p_event_id,'class',p_class_id,'entry',p_entry_id,'ordinal',p_ordinal,'status',p_status,'elapsed',p_elapsed_ms,'distance',p_distance_mm,'penalty',p_penalty_ms,'raw',p_raw_input,'version',p_expected_version);
 select * into receipt from public.race_operation_receipts where user_id=auth.uid() and operation_id=p_operation_id;
 if found then if receipt.request<>req then raise exception 'Operation ID reused with different values';end if;return receipt.result;end if;
 result:=public.save_race_attempt(p_track_id,p_event_id,p_class_id,p_entry_id,p_ordinal,p_status,p_elapsed_ms,p_distance_mm,p_penalty_ms,p_raw_input,p_expected_version);
 insert into public.race_operation_receipts(user_id,event_id,operation_id,request,result) values(auth.uid(),p_event_id,p_operation_id,req,result);return result;
end $$;
revoke all on function public.save_race_attempt_operation(uuid,uuid,uuid,uuid,uuid,integer,text,integer,integer,integer,text,integer) from public,anon;grant execute on function public.save_race_attempt_operation(uuid,uuid,uuid,uuid,uuid,integer,text,integer,integer,integer,text,integer) to authenticated;
create table public.offline_scoring_sessions(id uuid primary key default gen_random_uuid(),user_id uuid not null,event_id uuid not null references public.events(id) on delete cascade,device_id uuid not null,prepared_at timestamptz not null default now(),closed_at timestamptz,unique(user_id,event_id,device_id));
alter table public.offline_scoring_sessions enable row level security;create policy offline_sessions_read on public.offline_scoring_sessions for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.events e where e.id=event_id and public.can_publish_track(e.track_id)));grant select on public.offline_scoring_sessions to authenticated;revoke insert,update,delete on public.offline_scoring_sessions from public,anon,authenticated;
create or replace function public.prepare_offline_event(p_event_id uuid,p_device_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.events;t public.tracks;session_id uuid;begin select * into e from public.events where id=p_event_id for update;if not found or auth.uid() is null or not public.can_edit_track(e.track_id) then raise exception 'Not authorized' using errcode='42501';end if;if e.status='completed' then raise exception 'Completed event is locked';end if;select * into t from public.tracks where id=e.track_id;
 insert into public.offline_scoring_sessions(user_id,event_id,device_id) values(auth.uid(),e.id,p_device_id) on conflict(user_id,event_id,device_id) do update set closed_at=null,prepared_at=now() returning id into session_id;
 return jsonb_build_object('sessionId',session_id,'accountId',auth.uid(),'trackId',e.track_id,'trackSlug',t.slug,'eventSlug',e.slug,'event',to_jsonb(e),'classes',coalesce((select jsonb_agg(to_jsonb(c) order by c.order_num) from public.event_classes c where event_id=e.id),'[]'::jsonb),'initialEntries',coalesce((select jsonb_agg(to_jsonb(en) order by en.order_num) from public.entries en join public.event_classes c on c.id=en.event_class_id where c.event_id=e.id),'[]'::jsonb),'initialAttempts',coalesce((select jsonb_agg(to_jsonb(a)) from public.attempts a join public.event_classes c on c.id=a.event_class_id where c.event_id=e.id),'[]'::jsonb));
end $$;
create or replace function public.close_offline_session(p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null then raise exception 'Sign in before closing a scoring session';end if;update public.offline_scoring_sessions set closed_at=now() where id=p_session_id and user_id=auth.uid();if not found then raise exception 'Session not found' using errcode='42501';end if;end $$;
revoke all on function public.prepare_offline_event(uuid,uuid),public.close_offline_session(uuid) from public,anon;grant execute on function public.prepare_offline_event(uuid,uuid),public.close_offline_session(uuid) to authenticated;

create or replace function public.complete_race_event(p_event_id uuid,p_expected_revision bigint,p_ranks jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_event public.events; v_count integer;
begin
  select * into v_event from public.events where id=p_event_id for update;
  if not found or auth.uid() is null or not public.can_publish_track(v_event.track_id) then raise exception 'Not authorized to complete this event' using errcode='42501'; end if;
  if exists(select 1 from public.offline_scoring_sessions where event_id=p_event_id and closed_at is null) then raise exception 'Upload and close every prepared offline scoring session before finalizing';end if;
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



notify pgrst,'reload schema';
create or replace function public.release_offline_session(p_session_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare s public.offline_scoring_sessions;e public.events;begin select * into s from public.offline_scoring_sessions where id=p_session_id;select * into e from public.events where id=s.event_id for update;if not found or auth.uid() is null or not public.can_publish_track(e.track_id) then raise exception 'Only an owner can release an abandoned device session' using errcode='42501';end if;if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Explain why this device session can be released';end if;
 update public.offline_scoring_sessions set closed_at=now() where id=s.id;
 insert into public.audit_events(organization_id,track_id,actor_id,action,target_type,target_id,before_data,after_data) select t.organization_id,e.track_id,auth.uid(),'offline_session_released','offline_session',s.id,to_jsonb(s),jsonb_build_object('reason',p_reason,'closed',true) from public.tracks t where id=e.track_id;
end $$;
revoke all on function public.release_offline_session(uuid,text) from public,anon;grant execute on function public.release_offline_session(uuid,text) to authenticated;
notify pgrst,'reload schema';
