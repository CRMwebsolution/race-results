-- Recovered from live migration history (version 20261008155924). Applied by Codex on Oct 8, 2026;
-- the session ended before the file was committed. Contents reproduced from supabase_migrations.schema_migrations.
create or replace function billing_private.event_retention_deadline() returns trigger language plpgsql security definer set search_path='' as $$
declare v_tier text;v_base timestamptz;
begin
 if TG_OP='UPDATE' then
  new.public_until:=old.public_until;new.retention_finalized:=old.retention_finalized;
  if coalesce(auth.jwt()->>'role','')<>'service_role' and current_setting('role',true)<>'service_role' and session_user not in('postgres','supabase_admin') then new.archived_at:=old.archived_at; end if;
 else
  new.public_until:=null;new.archived_at:=null;new.retention_finalized:=false;
  if new.status='completed' and auth.uid() is not null then raise exception 'Use Complete the race to publish official results'; end if;
 end if;
 if (new.status='completed' and not new.retention_finalized) or (new.status='live' and new.public_until is null) then
  select tier,activated_at into v_tier,v_base from billing_private.event_usage where event_id=new.id;
  if new.status='completed' then
   v_base:=coalesce(new.completed_at,now());new.retention_finalized:=true;
   -- First completion opens its promised results window even after an abandoned live view expired.
   new.archived_at:=null;
  end if;
  v_base:=coalesce(v_base,now());new.public_until:=v_base+interval '30 days';
  if v_tier in('standard','premium') then new.public_until:=greatest(new.public_until,(date_trunc('year',v_base at time zone 'UTC')+interval '1 year') at time zone 'UTC'); end if;
 end if;
 return new;
end $$;

create or replace function public.check_organization_asset_limits()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_scope uuid;v_tier text;v_exempt boolean;v_tracks integer;v_series integer;
begin
 v_scope:=billing_private.scope(new.organization_id);
 if v_scope is null then raise exception 'Organization not found'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_scope::text,0));
 select active_tier,limits_exempt into v_tier,v_exempt from public.organizations where id in(select billing_private.org_ids(new.organization_id))
 order by limits_exempt desc,
 case when active_tier in('standard','premium') and subscription_end_date>now() then case active_tier when 'premium' then 3 else 2 end else 1 end desc limit 1;
 if v_exempt then return new; end if;
 if v_tier in('standard','premium') and not exists(select 1 from public.organizations where id in(select billing_private.org_ids(new.organization_id)) and active_tier=v_tier and subscription_end_date>now()) then v_tier:='free'; end if;
 select count(*) into v_tracks from public.tracks where (TG_TABLE_NAME<>'tracks' or id<>new.id) and organization_id in(select billing_private.org_ids(new.organization_id));
 select count(*) into v_series from public.series where (TG_TABLE_NAME<>'series' or id<>new.id) and organization_id in(select billing_private.org_ids(new.organization_id));
 if TG_TABLE_NAME='tracks' then v_tracks:=v_tracks+1; else v_series:=v_series+1; end if;
 if v_tier='standard' and (v_tracks>3 or v_series>3 or (v_tracks>0 and v_series>0)) then raise exception 'Standard allows up to 3 Tracks OR 3 Series across your account. Premium allows both.'; end if;
 if v_tier='premium' and (v_tracks>3 or v_series>3) then raise exception 'Premium allows up to 3 Tracks and 3 Series across your account.'; end if;
 if v_tier in('free','event_pass') and (v_tracks>1 or v_series>1) then raise exception 'This plan allows 1 Track and 1 Series across your account. Upgrade to add more.'; end if;
 return new;
end $$;
revoke all on function public.check_organization_asset_limits() from public,anon,authenticated;

create trigger enforce_track_transfer_limit before update of organization_id on public.tracks for each row execute function public.check_organization_asset_limits();
create trigger enforce_series_transfer_limit before update of organization_id on public.series for each row execute function public.check_organization_asset_limits();
