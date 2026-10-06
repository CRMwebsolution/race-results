alter table public.events add column completed_at timestamptz;
create table public.event_result_versions(
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id),
 track_id uuid not null references public.tracks(id), version integer not null check(version>0),
 source_revision bigint not null, actor_id uuid, finalized_at timestamptz, recorded_at timestamptz not null default now(),
 reconstructed boolean not null default false, payload jsonb not null,
 unique(event_id,version)
);
alter table public.event_result_versions enable row level security;
grant select on public.event_result_versions to anon,authenticated;
revoke insert,update,delete on public.event_result_versions from public,anon,authenticated;
create policy result_versions_read on public.event_result_versions for select to anon,authenticated using(
 public.can_view_track(track_id) or exists(select 1 from public.events e where e.id=event_id and e.status in ('live','completed') and e.published_revision>0)
);
create or replace function public.capture_official_result(p_event_id uuid,p_rows jsonb,p_source bigint,p_reconstructed boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.events; v_id uuid; v_payload jsonb;
begin
 select * into e from public.events where id=p_event_id for update;
 v_payload:=jsonb_build_object('event',to_jsonb(e),'classes',coalesce((select jsonb_agg(to_jsonb(c) order by c.order_num,c.id) from public.event_classes c where event_id=e.id),'[]'::jsonb),
 'entries',coalesce((select jsonb_agg(to_jsonb(en) order by en.order_num,en.id) from public.entries en join public.event_classes c on c.id=en.event_class_id where c.event_id=e.id),'[]'::jsonb),
 'attempts',coalesce((select jsonb_agg(to_jsonb(a) order by a.entry_id,a.ordinal) from public.attempts a join public.event_classes c on c.id=a.event_class_id where c.event_id=e.id),'[]'::jsonb),
 'results',coalesce(p_rows,'[]'::jsonb),'engine_version',1);
 insert into public.event_result_versions(event_id,track_id,version,source_revision,actor_id,finalized_at,reconstructed,payload)
 select e.id,e.track_id,coalesce(max(version),0)+1,p_source,case when p_reconstructed then null else auth.uid() end,case when p_reconstructed then null else now() end,p_reconstructed,v_payload from public.event_result_versions where event_id=e.id returning id into v_id;
 return v_id;
end $$;
create or replace function public.snapshot_completed_event() returns trigger language plpgsql security definer set search_path='' as $$
declare rows jsonb;
begin
 if new.status='completed' and old.status is distinct from new.status then
  rows:=nullif(current_setting('raceholler.result_rows',true),'')::jsonb;
  perform public.capture_official_result(new.id,rows,coalesce(nullif(current_setting('raceholler.result_source',true),'')::bigint,old.working_revision),rows is null or exists(select 1 from jsonb_array_elements(rows) x where x->'score' is null));
  update public.events set completed_at=now() where id=new.id;
 end if;return null;
end $$;
create trigger snapshot_completed_event after update on public.events for each row execute function public.snapshot_completed_event();
revoke all on function public.capture_official_result(uuid,jsonb,bigint,boolean),public.snapshot_completed_event() from public,anon,authenticated;
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
  perform set_config('raceholler.result_rows',p_ranks::text,true);
  perform set_config('raceholler.result_source',p_expected_revision::text,true);
  update public.entries en set final_rank=r.final_rank from jsonb_to_recordset(p_ranks) as r(id uuid,final_rank integer) where en.id=r.id;
  perform set_config('raceholler.completing',p_event_id::text,true);
  update public.events set status='completed',published_revision=working_revision where id=p_event_id returning * into v_event;
  perform set_config('raceholler.completing','',true);
  return to_jsonb(v_event);
end;
$$;

-- Preserve historical input/ranks honestly; the original finalization instant/labels are unknown.
do $$ declare e record;begin for e in select id,working_revision from public.events where status='completed' loop
 perform public.capture_official_result(e.id,(select coalesce(jsonb_agg(jsonb_build_object('id',en.id,'final_rank',en.final_rank)),'[]'::jsonb) from public.entries en join public.event_classes c on c.id=en.event_class_id where c.event_id=e.id),e.working_revision,true);
end loop;end $$;
notify pgrst,'reload schema';
