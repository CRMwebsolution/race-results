begin;
-- Test: Platform Admin Cascading Deletions with Name Fail-Safes

-- Setup admin user
insert into auth.users(id, email) values('ad000000-0000-4000-8000-000000000001', 'admin@raceholler.test');
insert into public.platform_admins(user_id) values('ad000000-0000-4000-8000-000000000001');

-- Setup promoter user
insert into auth.users(id, email) values('fa000000-0000-4000-8000-000000000099', 'promoter@raceholler.test');
insert into public.profiles(id, email, full_name, active_tier, event_quota)
values('fa000000-0000-4000-8000-000000000099', 'promoter@raceholler.test', 'Pete Promoter', 'premium', 5)
on conflict (id) do update set full_name = 'Pete Promoter', active_tier = 'premium', event_quota = 5;

-- Setup fixtures
insert into public.organizations(id, name, billing_email, billing_owner_id, active_tier, event_quota)
values('ee100000-0000-4000-8000-000000000001', 'Speedway Org', 'promoter@raceholler.test', 'fa000000-0000-4000-8000-000000000099', 'premium', 5);

insert into public.organization_memberships(organization_id, user_id, role)
values('ee100000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-000000000099', 'owner');

insert into public.tracks(id, organization_id, name, slug)
values('ee200000-0000-4000-8000-000000000001', 'ee100000-0000-4000-8000-000000000001', 'Thunder Valley', 'thunder-valley');

insert into public.series(id, organization_id, name)
values('ee300000-0000-4000-8000-000000000001', 'ee100000-0000-4000-8000-000000000001', 'Thunder Series');

insert into public.events(id, track_id, name, slug, local_date, status)
values('ee400000-0000-4000-8000-000000000001', 'ee200000-0000-4000-8000-000000000001', 'Spring Nationals', 'spring-nats', current_date, 'draft');

insert into public.event_classes(event_id, track_id, name, scoring_type, order_num)
values('ee400000-0000-4000-8000-000000000001', 'ee200000-0000-4000-8000-000000000001', 'Pro Stock', 'fastest_pass', 1);

insert into billing_private.event_usage(event_id, organization_id, billing_scope, tier, charged)
values('ee400000-0000-4000-8000-000000000001', 'ee100000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-000000000099', 'premium', false);

-- Act as admin
set local role authenticated;
set local request.jwt.claim.sub = 'ad000000-0000-4000-8000-000000000001';

do $$
declare
  v_org_id uuid := 'ee100000-0000-4000-8000-000000000001';
  v_track_id uuid := 'ee200000-0000-4000-8000-000000000001';
  v_series_id uuid := 'ee300000-0000-4000-8000-000000000001';
  v_event_id uuid := 'ee400000-0000-4000-8000-000000000001';
  v_event2_id uuid;
  v_res jsonb;
begin
  -- 5. Test Event Deletion fail-safe: Wrong name should fail
  begin
    perform public.admin_delete_event(v_event_id, 'Wrong Name');
    raise exception 'admin_delete_event allowed mismatched name';
  exception when raise_exception then
    if sqlerrm like '%allowed mismatched name%' then raise; end if;
  end;

  -- Correct name succeeds
  v_res := public.admin_delete_event(v_event_id, 'Spring Nationals');
  if not exists (select 1 from public.events where id = v_event_id) then
    -- verified event deleted
    null;
  else
    raise exception 'Event was not deleted';
  end if;

  -- 6. Test Series Deletion fail-safe: Wrong name fails, correct name cascades
  -- Create event under series
  insert into public.events(id, series_id, name, slug, local_date, status)
  values('ee400000-0000-4000-8000-000000000002', v_series_id, 'Series Race 1', 'series-race-1', current_date, 'draft')
  returning id into v_event2_id;

  begin
    perform public.admin_delete_series(v_series_id, 'Wrong Series');
    raise exception 'admin_delete_series allowed mismatched name';
  exception when raise_exception then
    if sqlerrm like '%allowed mismatched name%' then raise; end if;
  end;

  v_res := public.admin_delete_series(v_series_id, 'Thunder Series');
  if exists (select 1 from public.series where id = v_series_id) then
    raise exception 'Series was not deleted';
  end if;
  if exists (select 1 from public.events where id = v_event2_id) then
    raise exception 'Series events were not cascaded';
  end if;

  -- 7. Test Track Deletion fail-safe: Wrong name fails, correct name cascades
  begin
    perform public.admin_delete_track(v_track_id, 'Wrong Track');
    raise exception 'admin_delete_track allowed mismatched name';
  exception when raise_exception then
    if sqlerrm like '%allowed mismatched name%' then raise; end if;
  end;

  v_res := public.admin_delete_track(v_track_id, 'Thunder Valley');
  if exists (select 1 from public.tracks where id = v_track_id) then
    raise exception 'Track was not deleted';
  end if;

  -- 8. Test Organization Deletion fail-safe: Wrong name fails, correct name cascades
  begin
    perform public.admin_delete_organization(v_org_id, 'Wrong Org');
    raise exception 'admin_delete_organization allowed mismatched name';
  exception when raise_exception then
    if sqlerrm like '%allowed mismatched name%' then raise; end if;
  end;

  v_res := public.admin_delete_organization(v_org_id, 'Speedway Org');
  if exists (select 1 from public.organizations where id = v_org_id) then
    raise exception 'Organization was not deleted';
  end if;

  -- 9. Test Account Deletion fail-safe:
  -- Admin cannot delete themselves
  begin
    perform public.admin_delete_account('ad000000-0000-4000-8000-000000000001', 'admin@raceholler.test');
    raise exception 'admin_delete_account allowed deleting self';
  exception when raise_exception then
    if sqlerrm like '%allowed deleting self%' then raise; end if;
  end;

  -- Wrong email fails
  begin
    perform public.admin_delete_account('fa000000-0000-4000-8000-000000000099', 'wrong@email.com');
    raise exception 'admin_delete_account allowed mismatched email';
  exception when raise_exception then
    if sqlerrm like '%allowed mismatched email%' then raise; end if;
  end;

  -- Correct email succeeds
  v_res := public.admin_delete_account('fa000000-0000-4000-8000-000000000099', 'promoter@raceholler.test', true);
  if exists (select 1 from public.profiles where id = 'fa000000-0000-4000-8000-000000000099') then
    raise exception 'Profile was not deleted';
  end if;

end $$;

-- 10. Non-admin cannot call delete functions
set local role authenticated;
set local request.jwt.claim.sub = 'fa000000-0000-4000-8000-000000000099';

do $$
begin
  begin
    perform public.admin_delete_event('ee400000-0000-4000-8000-000000000001', 'anything');
    raise exception 'Non-admin was allowed to call admin_delete_event';
  exception when sqlstate '42501' then
    null;
  end;
end $$;

reset role;
select 'admin cascading deletions: PASS' as result;
rollback;
