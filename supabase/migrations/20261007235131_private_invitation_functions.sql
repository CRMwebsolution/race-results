-- Keep privileged membership changes outside the exposed API schema.
-- Public wrappers use invoker permissions; the private implementations validate
-- the signed-in actor and keep explicit EXECUTE grants for each caller role.
create schema if not exists race_access_private;
revoke all on schema race_access_private from public;
grant usage on schema race_access_private to anon,authenticated;
alter function public.can_view_staff_race(uuid) set schema race_access_private;
alter function public.can_access_track_workspace(uuid) set schema race_access_private;
alter function public.can_access_series_workspace(uuid) set schema race_access_private;
alter function public.create_race_staff_invitation(uuid,text,text,uuid,text) set schema race_access_private;
alter function public.cancel_race_staff_invitation(uuid) set schema race_access_private;
alter function public.accept_race_staff_invitation(uuid) set schema race_access_private;
alter function public.remove_race_staff(uuid,uuid) set schema race_access_private;
create function public.can_view_staff_race(p_event_id uuid) returns boolean language sql stable security invoker set search_path='' as $$select race_access_private.can_view_staff_race(p_event_id)$$;
create function public.can_access_track_workspace(p_track_id uuid) returns boolean language sql stable security invoker set search_path='' as $$select race_access_private.can_access_track_workspace(p_track_id)$$;
create function public.can_access_series_workspace(p_series_id uuid) returns boolean language sql stable security invoker set search_path='' as $$select race_access_private.can_access_series_workspace(p_series_id)$$;
create function public.create_race_staff_invitation(p_event_id uuid,p_email text,p_role text,p_class_id uuid default null,p_judge_label text default null) returns uuid language sql security invoker set search_path='' as $$select race_access_private.create_race_staff_invitation(p_event_id,p_email,p_role,p_class_id,p_judge_label)$$;
create function public.cancel_race_staff_invitation(p_invitation_id uuid) returns void language sql security invoker set search_path='' as $$select race_access_private.cancel_race_staff_invitation(p_invitation_id)$$;
create function public.accept_race_staff_invitation(p_token uuid) returns jsonb language sql security invoker set search_path='' as $$select race_access_private.accept_race_staff_invitation(p_token)$$;
create function public.remove_race_staff(p_event_id uuid,p_user_id uuid) returns void language sql security invoker set search_path='' as $$select race_access_private.remove_race_staff(p_event_id,p_user_id)$$;
revoke all on function public.can_view_staff_race(uuid),public.can_access_track_workspace(uuid),public.can_access_series_workspace(uuid),public.create_race_staff_invitation(uuid,text,text,uuid,text),public.cancel_race_staff_invitation(uuid),public.accept_race_staff_invitation(uuid),public.remove_race_staff(uuid,uuid) from public,anon;
grant execute on function public.can_view_staff_race(uuid) to anon,authenticated;
grant execute on function public.can_access_track_workspace(uuid),public.can_access_series_workspace(uuid),public.create_race_staff_invitation(uuid,text,text,uuid,text),public.cancel_race_staff_invitation(uuid),public.accept_race_staff_invitation(uuid),public.remove_race_staff(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
