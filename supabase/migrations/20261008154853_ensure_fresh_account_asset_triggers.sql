-- The unrecorded Antigravity quota file is retired. Create its asset triggers only when absent on a fresh database.
do $migration$
begin
 if not exists(select 1 from pg_trigger where tgrelid='public.tracks'::regclass and tgname='enforce_asset_limits_tracks') then
  create trigger enforce_asset_limits_tracks before insert on public.tracks for each row execute function public.check_organization_asset_limits();
 end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.series'::regclass and tgname='enforce_asset_limits_series') then
  create trigger enforce_asset_limits_series before insert on public.series for each row execute function public.check_organization_asset_limits();
 end if;
end $migration$;