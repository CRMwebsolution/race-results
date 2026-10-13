begin;

-- 1. Setup test users
insert into auth.users(id, email, raw_user_meta_data) values
  ('ac000000-0000-4000-8000-000000000001', 'admin@test.invalid', '{"full_name":"Platform Admin"}'::jsonb),
  ('ac000000-0000-4000-8000-000000000002', 'promoter@test.invalid', '{"full_name":"Promoter Cody"}'::jsonb);

insert into public.platform_admins(user_id) values ('ac000000-0000-4000-8000-000000000001');

-- 2. Verify handle_new_user created account profile with 0 credits
do $$
begin
  if not exists (select 1 from public.profiles where id = 'ac000000-0000-4000-8000-000000000002' and active_tier = 'free' and event_quota = 0) then
    raise exception 'Promoter profile not created with expected defaults';
  end if;
end $$;

-- 3. Promoter calls account_billing_overview with 0 tracks/series
set local role authenticated;
set local request.jwt.claim.sub = 'ac000000-0000-4000-8000-000000000002';

do $$
declare
  v_overview jsonb;
begin
  v_overview := public.account_billing_overview();
  if v_overview->>'active_tier' <> 'free' or (v_overview->>'remaining_credits')::int <> 0 then
    raise exception 'account_billing_overview returned unexpected values: %', v_overview;
  end if;
  -- Promoter cannot grant themselves access
  begin
    perform public.admin_grant_account_entitlement('ac000000-0000-4000-8000-000000000002', 'standard', 5, now() + interval '1 year', 'Self grant', false);
    raise exception 'Promoter self-grant allowed!';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- 4. Admin donates 5 credits to Promoter's account
set local request.jwt.claim.sub = 'ac000000-0000-4000-8000-000000000001';

select public.admin_grant_account_entitlement(
  'ac000000-0000-4000-8000-000000000002',
  'premium',
  5,
  now() + interval '1 year',
  'Welcome trial grant from Cody',
  false
);

do $$
begin
  if not exists (
    select 1 from public.profiles
    where id = 'ac000000-0000-4000-8000-000000000002'
      and active_tier = 'premium'
      and event_quota = 5
  ) then
    raise exception 'Account grant failed to update profile';
  end if;
end $$;

-- 5. Promoter creates Track A and Track B under their account
set local request.jwt.claim.sub = 'ac000000-0000-4000-8000-000000000002';

do $$
declare
  t1 jsonb;
  t2 jsonb;
  e1 uuid;
begin
  t1 := public.register_track_with_state('Millbridge Speedway', null, 'America/New_York', 'millbridge', 'NC');
  t2 := public.register_track_with_state('Mountain Creek', null, 'America/New_York', 'mountain-creek', 'NC');

  -- Create event at Track A and set live -> uses standard pass or event pass
  insert into public.events(track_id, name, slug, local_date, status)
  values ((t1->>'track_id')::uuid, 'Friday Feature', 'friday-feat', current_date, 'scheduled')
  returning id into e1;

  -- Since active_tier is standard with valid expiration, it has unlimited access
  update public.events set status = 'live' where id = e1;
end $$;

-- Verify quota was not consumed because standard plan has active season pass
do $$
begin
  if (select event_quota from public.profiles where id = 'ac000000-0000-4000-8000-000000000002') <> 5 then
    raise exception 'Standard season pass incorrectly consumed credit';
  end if;
end $$;

-- 6. Now test Event Pass quota deduction: set tier to free with 3 credits
set local request.jwt.claim.sub = 'ac000000-0000-4000-8000-000000000001';
select public.admin_grant_account_entitlement(
  'ac000000-0000-4000-8000-000000000002',
  'event_pass',
  3,
  null,
  'Event pass bundle',
  false
);

set local request.jwt.claim.sub = 'ac000000-0000-4000-8000-000000000002';
do $$
declare
  t1_id uuid;
  e2 uuid;
begin
  select id into t1_id from public.tracks where slug = 'millbridge';
  insert into public.events(track_id, name, slug, local_date, status)
  values (t1_id, 'Saturday Shootout', 'saturday-shootout', current_date, 'scheduled')
  returning id into e2;

  update public.events set status = 'live' where id = e2;
end $$;

-- Verify account quota was decremented from 3 to 2
do $$
begin
  if (select event_quota from public.profiles where id = 'ac000000-0000-4000-8000-000000000002') <> 2 then
    raise exception 'Event pass credit was not decremented on account';
  end if;
end $$;

reset role;
select 'account billing & credits: PASS (profile defaults, admin donations to account, shared asset quota)' as result;
rollback;
