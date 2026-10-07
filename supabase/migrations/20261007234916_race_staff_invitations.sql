-- Race-scoped invitations never grant organization administration or series membership.
create table public.race_staff (
 event_id uuid not null references public.events(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('official','judge')),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 primary key(event_id,user_id)
);
create index race_staff_user_idx on public.race_staff(user_id,event_id);
create table public.race_staff_invitations (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 email text not null,
 role text not null check(role in ('official','judge')),
 class_id uuid references public.event_classes(id) on delete cascade,
 judge_label text,
 token uuid not null unique default gen_random_uuid(),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 revoked_at timestamptz,
 accepted_at timestamptz,
 accepted_by uuid references auth.users(id),
 check(role<>'judge' or (class_id is not null and length(trim(judge_label))>0))
);
create index race_staff_invitations_event_idx on public.race_staff_invitations(event_id);
create index race_staff_invitations_creator_idx on public.race_staff_invitations(created_by);
create index race_staff_invitations_acceptor_idx on public.race_staff_invitations(accepted_by);
create index race_staff_invitations_class_idx on public.race_staff_invitations(class_id);
alter table public.race_staff enable row level security;
alter table public.race_staff_invitations enable row level security;
revoke all on public.race_staff,public.race_staff_invitations from public,anon,authenticated;
grant select on public.race_staff,public.race_staff_invitations to authenticated;
create policy race_staff_read on public.race_staff for select to authenticated using(user_id=auth.uid() or public.can_manage_race(event_id));
create policy race_invitations_read on public.race_staff_invitations for select to authenticated using(public.can_manage_race(event_id));

create function public.can_view_staff_race(p_event_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.race_staff where event_id=p_event_id and user_id=auth.uid() and active);
$$;
revoke all on function public.can_view_staff_race(uuid) from public;
grant execute on function public.can_view_staff_race(uuid) to anon,authenticated;
create policy events_staff_read on public.events for select to authenticated using(public.can_view_staff_race(id));
create or replace function public.can_view_race(p_event_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.can_view_staff_race(p_event_id) or exists(select 1 from public.events e where e.id=p_event_id and (
 (e.track_id is not null and public.can_view_track(e.track_id)) or
 (e.series_id is not null and exists(select 1 from public.series s where s.id=e.series_id and (public.is_org_member(s.organization_id) or public.is_platform_admin()))) or
 e.status='scheduled' or (e.status in ('live','completed') and e.published_revision>0)));
$$;
create or replace function public.can_edit_race(p_event_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (exists(select 1 from public.race_staff where event_id=p_event_id and user_id=auth.uid() and active and role='official') or exists(select 1 from public.events e where e.id=p_event_id and (
 (e.track_id is not null and public.can_edit_track(e.track_id)) or
 (e.series_id is not null and exists(select 1 from public.series s where s.id=e.series_id and (public.is_org_admin(s.organization_id) or public.is_platform_admin()))))));
$$;
create or replace function public.can_judge_race(p_event_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.can_view_staff_race(p_event_id) or exists(select 1 from public.events e where e.id=p_event_id and (
 (e.track_id is not null and public.can_edit_track(e.track_id)) or
 (e.series_id is not null and exists(select 1 from public.series s where s.id=e.series_id and public.is_org_member(s.organization_id))))));
$$;
create function public.can_access_track_workspace(p_track_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.can_view_track(p_track_id) or exists(select 1 from public.race_staff r join public.events e on e.id=r.event_id where e.track_id=p_track_id and r.user_id=auth.uid() and r.active));
$$;
create function public.can_access_series_workspace(p_series_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.can_view_series_account(p_series_id) or exists(select 1 from public.race_staff r join public.events e on e.id=r.event_id where e.series_id=p_series_id and r.user_id=auth.uid() and r.active));
$$;
revoke all on function public.can_access_track_workspace(uuid),public.can_access_series_workspace(uuid) from public,anon;
grant execute on function public.can_access_track_workspace(uuid),public.can_access_series_workspace(uuid) to authenticated;
create or replace function public.race_judge_candidates(p_event_id uuid) returns table(user_id uuid,label text) language sql stable security definer set search_path='' as $$
 select distinct p.id,coalesce(nullif(p.display_name,''),p.email) from public.profiles p join public.events e on e.id=p_event_id
 where public.can_manage_race(e.id) and (
 exists(select 1 from public.race_staff r where r.event_id=e.id and r.user_id=p.id and r.active) or
 (e.track_id is not null and p.id in(select j.user_id from public.judge_candidates(e.track_id) j)) or
 (e.series_id is not null and exists(select 1 from public.series s join public.organization_memberships m on m.organization_id=s.organization_id where s.id=e.series_id and m.user_id=p.id and m.active)));
$$;

create function public.create_race_staff_invitation(p_event_id uuid,p_email text,p_role text,p_class_id uuid default null,p_judge_label text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare e public.events;v uuid;begin
 select * into e from public.events where id=p_event_id for update;
 if not found or auth.uid() is null or not public.can_manage_race(e.id) then raise exception 'Only the race organizer can invite staff' using errcode='42501';end if;
 if e.status in ('completed','cancelled') then raise exception 'Reopen this race before inviting staff';end if;
 if p_role not in ('official','judge') or p_role is null then raise exception 'Choose scorer or judge';end if;
 if p_email is null or length(p_email)>254 or trim(p_email)!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address';end if;
 if p_role='judge' and (p_class_id is null or not exists(select 1 from public.event_classes where id=p_class_id and event_id=e.id and scoring_type='judged_points') or coalesce(length(trim(p_judge_label)),0)=0) then raise exception 'Choose a judged class and enter a judge label';end if;
 insert into public.race_staff_invitations(event_id,email,role,class_id,judge_label,created_by) values(e.id,lower(trim(p_email)),p_role,case when p_role='judge' then p_class_id end,case when p_role='judge' then trim(p_judge_label) end,auth.uid()) returning id into v;
 insert into public.audit_events(actor_id,action,target_type,target_id,after_data) values(auth.uid(),'staff.invited','event',e.id,jsonb_build_object('invitation_id',v,'role',p_role));
 return v;
end $$;
create function public.cancel_race_staff_invitation(p_invitation_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare i public.race_staff_invitations;begin
 select * into i from public.race_staff_invitations where id=p_invitation_id for update;
 if not found or auth.uid() is null or not public.can_manage_race(i.event_id) then raise exception 'Only the race organizer can cancel invitations' using errcode='42501';end if;
 if i.accepted_at is not null then raise exception 'This invitation was accepted. Remove race access instead.';end if;
 update public.race_staff_invitations set revoked_at=now() where id=i.id;
 insert into public.audit_events(actor_id,action,target_type,target_id) values(auth.uid(),'staff.invitation_cancelled','event',i.event_id);
end $$;
create function public.accept_race_staff_invitation(p_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.race_staff_invitations;e public.events;u auth.users;path text;begin
 if auth.uid() is null then raise exception 'Sign in before accepting this invitation' using errcode='42501';end if;
 select * into i from public.race_staff_invitations where token=p_token for update;
 if not found then raise exception 'This invitation is not valid. Ask the organizer for a new link.';end if;
 select * into u from auth.users where id=auth.uid();
 if lower(u.email) is distinct from i.email or u.email_confirmed_at is null then raise exception 'Sign in with the confirmed email address this invitation was sent to' using errcode='42501';end if;
 select * into e from public.events where id=i.event_id for update;
 path:='/dashboard/'||case when e.series_id is null then 'tracks/'||e.track_id else 'series/'||e.series_id end||'/events/'||e.id||case when i.role='judge' then '/judging' else '/scoring' end;
 if i.accepted_at is not null then
  if i.accepted_by=auth.uid() and public.can_view_staff_race(e.id) then return jsonb_build_object('path',path);end if;
  raise exception 'This invitation has already been used. Ask the organizer for a new link.';
 end if;
 if i.revoked_at is not null or i.expires_at<=now() then raise exception 'This invitation expired or was cancelled. Ask the organizer for a new link.';end if;
 if e.status in ('completed','cancelled') then raise exception 'This race is closed. Ask the organizer to reopen it.';end if;
 -- The inviter must still have authority; stale invites cannot outlive removal of that authority.
 if not exists(select 1 from public.events x where x.id=e.id and (
 (x.track_id is not null and (exists(select 1 from public.track_memberships where track_id=x.track_id and user_id=i.created_by and active and role in ('owner','administrator')) or exists(select 1 from public.tracks t join public.organization_memberships m on m.organization_id=t.organization_id where t.id=x.track_id and m.user_id=i.created_by and m.active and m.role in ('owner','admin')))) or
 (x.series_id is not null and exists(select 1 from public.series s join public.organization_memberships m on m.organization_id=s.organization_id where s.id=x.series_id and m.user_id=i.created_by and m.active and m.role in ('owner','admin'))) or exists(select 1 from public.platform_admins where user_id=i.created_by) or exists(select 1 from auth.users where id=i.created_by and email='cody@southernautomate.com' and email_confirmed_at is not null))) then raise exception 'The organizer must create a new invitation.';end if;
 insert into public.race_staff(event_id,user_id,role) values(e.id,auth.uid(),i.role) on conflict(event_id,user_id) do update set active=true,role=case when public.race_staff.active and public.race_staff.role='official' then 'official' else excluded.role end;
 if i.role='judge' then
  if not exists(select 1 from public.event_classes where id=i.class_id and event_id=e.id and scoring_type='judged_points') then raise exception 'The invited class is no longer available.';end if;
  insert into public.judge_assignments(event_class_id,user_id,label,active) values(i.class_id,auth.uid(),i.judge_label,true) on conflict(event_class_id,user_id) do update set label=excluded.label,active=true;
  update public.events set working_revision=working_revision+1,published_revision=case when status='live' then working_revision+1 else published_revision end where id=e.id;
 end if;
 update public.race_staff_invitations set accepted_at=now(),accepted_by=auth.uid() where id=i.id;
 insert into public.audit_events(actor_id,action,target_type,target_id,after_data) values(auth.uid(),'staff.invitation_accepted','event',e.id,jsonb_build_object('invitation_id',i.id,'role',i.role));
 return jsonb_build_object('path',path);
end $$;
create function public.remove_race_staff(p_event_id uuid,p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare e public.events;begin
 select * into e from public.events where id=p_event_id for update;
 if not found or auth.uid() is null or not public.can_manage_race(e.id) then raise exception 'Only the race organizer can remove staff' using errcode='42501';end if;
 update public.race_staff set active=false where event_id=e.id and user_id=p_user_id;
 -- Keep historical official scores intact; authorization is revoked by race_staff.active.
 if e.status<>'completed' then
  update public.judge_assignments set active=false where user_id=p_user_id and event_class_id in(select id from public.event_classes where event_id=e.id);
  update public.events set working_revision=working_revision+1,published_revision=case when status='live' then working_revision+1 else published_revision end where id=e.id;
 end if;
 update public.race_staff_invitations set revoked_at=now() where event_id=e.id and accepted_at is null and email in(select lower(email) from auth.users where id=p_user_id);
 insert into public.audit_events(actor_id,action,target_type,target_id,after_data) values(auth.uid(),'staff.removed','event',e.id,jsonb_build_object('user_id',p_user_id));
end $$;
revoke all on function public.create_race_staff_invitation(uuid,text,text,uuid,text),public.cancel_race_staff_invitation(uuid),public.accept_race_staff_invitation(uuid),public.remove_race_staff(uuid,uuid) from public,anon;
grant execute on function public.create_race_staff_invitation(uuid,text,text,uuid,text),public.cancel_race_staff_invitation(uuid),public.accept_race_staff_invitation(uuid),public.remove_race_staff(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
