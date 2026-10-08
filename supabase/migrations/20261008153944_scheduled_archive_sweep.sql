-- Supabase runs this hourly without application secrets. Minimal test Postgres has no pg_cron.
do $migration$
begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  execute 'create extension if not exists pg_cron';
  execute $schedule$select cron.schedule('raceholler-archive-results','15 * * * *','select public.sweep_expired_events()')$schedule$;
 end if;
end
$migration$;
create index if not exists events_public_until_idx on public.events(public_until) where archived_at is null;
