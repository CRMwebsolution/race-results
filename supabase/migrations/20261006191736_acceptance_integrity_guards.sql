-- Preserve linked identities and official history when event metadata is changed.
create or replace function public.guard_series_identity() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.event_classes; e public.events; r public.series_rosters;
begin
 if tg_table_name='event_classes' then
  if new.series_class_id is not null and not exists(
   select 1 from public.series_classes sc join public.events ev on ev.series_id=sc.series_id
   where sc.id=new.series_class_id and ev.id=new.event_id
  ) then raise exception 'Default class belongs to another series'; end if;
  if tg_op='UPDATE' and new.series_class_id is distinct from old.series_class_id and exists(
   select 1 from public.entries en join public.series_rosters sr on sr.id=en.series_roster_id
   where en.event_class_id=new.id and sr.series_class_id is distinct from new.series_class_id
  ) then raise exception 'Unlink the existing roster entries before changing the championship class'; end if;
 else
  if new.series_roster_id is not null then
   select * into c from public.event_classes where id=new.event_class_id;
   select * into e from public.events where id=c.event_id;
   select * into r from public.series_rosters where id=new.series_roster_id;
   if r.series_id is distinct from e.series_id or r.series_class_id is distinct from c.series_class_id
   then raise exception 'Roster identity does not match event class'; end if;
   new.series_racer_id:=r.series_racer_id;
  elsif tg_op='INSERT' and new.series_racer_id is not null then raise exception 'Select a series roster identity';
  elsif tg_op='UPDATE' and new.series_racer_id is distinct from old.series_racer_id then raise exception 'Change identity using its series roster'; end if;
 end if;
 return new;
end $$;

create or replace function public.delete_or_withdraw_event(p_event_id uuid,p_confirm boolean) returns text
language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or auth.uid() is null or not public.can_publish_track(e.track_id)
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
end $$;

-- Prepared judge totals are a read-only snapshot. Independent judge entry still needs connectivity.
create or replace function public.prepare_offline_event(p_event_id uuid,p_device_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.events;t public.tracks;session_id uuid;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or auth.uid() is null or not public.can_edit_track(e.track_id)
 then raise exception 'Not authorized' using errcode='42501';end if;
 if e.status='completed' then raise exception 'Completed event is locked';end if;
 select * into t from public.tracks where id=e.track_id;
 insert into public.offline_scoring_sessions(user_id,event_id,device_id)
 values(auth.uid(),e.id,p_device_id)
 on conflict(user_id,event_id,device_id) do update set closed_at=null,prepared_at=now()
 returning id into session_id;
 return jsonb_build_object(
  'sessionId',session_id,'accountId',auth.uid(),'trackId',e.track_id,'trackSlug',t.slug,'eventSlug',e.slug,
  'event',to_jsonb(e),
  'classes',coalesce((select jsonb_agg(to_jsonb(c) order by c.order_num) from public.event_classes c where event_id=e.id),'[]'::jsonb),
  'initialEntries',coalesce((select jsonb_agg(to_jsonb(en) order by en.order_num) from public.entries en join public.event_classes c on c.id=en.event_class_id where c.event_id=e.id),'[]'::jsonb),
  'initialAttempts',coalesce((select jsonb_agg(to_jsonb(a)) from public.attempts a join public.event_classes c on c.id=a.event_class_id where c.event_id=e.id),'[]'::jsonb),
  'judgeScores',coalesce((select jsonb_agg(jsonb_build_object('assignmentId',s.assignment_id,'entryId',s.entry_id,'ordinal',s.ordinal,'values',s."values")) from public.judge_scores s join public.judge_assignments j on j.id=s.assignment_id and j.active join public.event_classes c on c.id=s.event_class_id where c.event_id=e.id),'[]'::jsonb)
 );
end $$;
notify pgrst,'reload schema';
