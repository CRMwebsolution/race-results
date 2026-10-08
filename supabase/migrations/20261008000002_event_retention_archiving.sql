-- Phase 4: Tier-Aware Retention and Archiving

-- 1. Add archived_at to events
alter table public.events
add column if not exists archived_at timestamptz;

-- 2. Function to perform retention sweep
create or replace function public.sweep_expired_events()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
begin
  for v_event in (
    select e.id, o.active_tier, e.local_date, e.status
    from public.events e
    left join public.tracks t on t.id = e.track_id
    left join public.series s on s.id = e.series_id
    join public.organizations o on o.id = coalesce(t.organization_id, s.organization_id)
    where e.archived_at is null
      and e.status = 'completed'
  ) loop
    if v_event.active_tier = 'event_pass' or v_event.active_tier = 'free' then
      -- 30 days after race completion
      if (v_event.local_date + interval '30 days') < now() then
        update public.events set archived_at = now() where id = v_event.id;
      end if;
    elsif v_event.active_tier = 'standard' or v_event.active_tier = 'premium' then
      -- Calendar year end with a 30-day minimum
      if (date_trunc('year', v_event.local_date) + interval '1 year') < now() 
         and (v_event.local_date + interval '30 days') < now() then
        update public.events set archived_at = now() where id = v_event.id;
      end if;
    end if;
  end loop;
end;
$$;
