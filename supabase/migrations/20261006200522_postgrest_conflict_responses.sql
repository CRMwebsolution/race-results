-- Application version conflicts are permanent until the caller refreshes its data.
-- PostgREST 14 retries SQLSTATE 40001 indefinitely, so return HTTP 409 instead.
-- Only rewrite explicit application exceptions in these existing checked RPCs;
-- genuine PostgreSQL serialization failures retain their normal semantics.
-- CREATE OR REPLACE preserves signatures, owners, grants and SECURITY DEFINER settings.
do $$
declare rpc record;
begin
  for rpc in select p.oid from pg_proc p
    where p.pronamespace='public'::regnamespace and p.prokind='f'
    and p.proname=any(array['save_race_attempt','save_judge_score','complete_race_event',
      'set_race_event_status','edit_race_event','publish_series_standings'])
    and p.prosrc like '%40001%'
  loop
    execute replace(pg_get_functiondef(rpc.oid), '''40001''', '''PT409''');
  end loop;
end $$;
notify pgrst, 'reload schema';
