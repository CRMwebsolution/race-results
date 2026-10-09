create extension if not exists pg_net;

create or replace function public.notify_activity_webhook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $func$
declare
  webhook_url text := 'https://n8n.southernautomate.com/webhook/a8aecd54-4eb6-4243-9c19-daf7c939c69c';
  payload jsonb;
begin
  payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'action', TG_OP,
    'timestamp', now(),
    'record', row_to_json(NEW)
  );
  
  perform net.http_post(
    url := webhook_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := payload
  );
  return new;
exception
  when others then
    -- fail silently so that webhook errors don't prevent transactions from committing
    return new;
end;
$func$;

-- Track new accounts (profiles are created automatically on user signup)
drop trigger if exists notify_profiles_webhook on public.profiles;
create trigger notify_profiles_webhook after insert on public.profiles for each row execute function public.notify_activity_webhook();

-- Track new organizations
drop trigger if exists notify_orgs_webhook on public.organizations;
create trigger notify_orgs_webhook after insert on public.organizations for each row execute function public.notify_activity_webhook();

-- Track new tracks
drop trigger if exists notify_tracks_webhook on public.tracks;
create trigger notify_tracks_webhook after insert on public.tracks for each row execute function public.notify_activity_webhook();

-- Track new series
drop trigger if exists notify_series_webhook on public.series;
create trigger notify_series_webhook after insert on public.series for each row execute function public.notify_activity_webhook();

-- Track new events
drop trigger if exists notify_events_webhook on public.events;
create trigger notify_events_webhook after insert on public.events for each row execute function public.notify_activity_webhook();


