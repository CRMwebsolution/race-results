alter table public.events add column if not exists archived_at timestamptz;
alter table public.events add column if not exists public_until timestamptz;
-- Freeze the deadline at first completion, independent of later plan edits or race-date edits.
create or replace function billing_private.event_retention_deadline() returns trigger language plpgsql security definer set search_path='' as $$
declare v_tier text;v_completed timestamptz;
begin
 if TG_OP='UPDATE' then
  new.archived_at:=old.archived_at;
  new.public_until:=old.public_until;
 end if;
 if new.status='completed' and new.public_until is null then
  v_completed:=coalesce(new.completed_at,now());
  select tier into v_tier from billing_private.event_usage where event_id=new.id;
  new.public_until:=v_completed+interval '30 days';
  if v_tier in('standard','premium') then new.public_until:=greatest(new.public_until,date_trunc('year',v_completed at time zone 'UTC') at time zone 'UTC'+interval '1 year'); end if;
 end if;
 return new;
end $$;
revoke all on function billing_private.event_retention_deadline() from public,anon,authenticated;
create trigger freeze_public_deadline before insert or update on public.events for each row execute function billing_private.event_retention_deadline();
update public.events set public_until=null where status='completed' and public_until is null;

create or replace function public.can_view_race(p_event_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.can_view_staff_race(p_event_id) or exists(
  select 1 from public.events e where e.id=p_event_id and
  (public.is_platform_admin() or (e.track_id is not null and public.can_view_track(e.track_id))
   or (e.series_id is not null and public.can_view_series_account(e.series_id))
   or (e.archived_at is null and (e.public_until is null or e.public_until>now()) and
    (e.status='scheduled' or(e.status in('live','completed') and e.published_revision>0))))
 );
$$;
alter policy events_read on public.events using(public.can_view_race(id));

create or replace function public.sweep_expired_events() returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' and current_setting('role',true)<>'service_role' and session_user not in('postgres','supabase_admin') then raise exception 'Maintenance service required' using errcode='42501'; end if;
 -- Retention dates already hide public results even if this bookkeeping sweep is delayed.
 update public.events set archived_at=now() where archived_at is null and public_until<=now();
end $$;
revoke all on function public.sweep_expired_events() from public,anon,authenticated;
grant execute on function public.sweep_expired_events() to service_role;
