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
 select count(*) into v_tracks from public.tracks where organization_id in(select billing_private.org_ids(new.organization_id));
 select count(*) into v_series from public.series where organization_id in(select billing_private.org_ids(new.organization_id));
 if TG_TABLE_NAME='tracks' then v_tracks:=v_tracks+1; else v_series:=v_series+1; end if;
 if v_tier='standard' and (v_tracks>3 or v_series>3 or (v_tracks>0 and v_series>0)) then raise exception 'Standard allows up to 3 Tracks OR 3 Series across your account. Premium allows both.'; end if;
 if v_tier='premium' and (v_tracks>3 or v_series>3) then raise exception 'Premium allows up to 3 Tracks and 3 Series across your account.'; end if;
 if v_tier in('free','event_pass') and (v_tracks>1 or v_series>1) then raise exception 'This plan allows 1 Track and 1 Series across your account. Upgrade to add more.'; end if;
 return new;
end $$;
revoke all on function public.check_organization_asset_limits() from public,anon,authenticated;

