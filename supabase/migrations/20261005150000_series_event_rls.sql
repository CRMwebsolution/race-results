-- Allow Series Admins to insert, update, and delete events tied to their series

drop policy if exists events_insert on public.events;
create policy events_insert on public.events
  for insert to authenticated
  with check (
    public.can_edit_track(track_id)
    or (
      series_id is not null 
      and exists (
        select 1 from public.series s 
        where s.id = series_id 
          and (public.is_org_admin(s.organization_id) or public.is_platform_admin())
      )
    )
  );

drop policy if exists events_update on public.events;
create policy events_update on public.events
  for update to authenticated
  using (
    public.can_edit_track(track_id)
    or (
      series_id is not null 
      and exists (
        select 1 from public.series s 
        where s.id = events.series_id 
          and (public.is_org_admin(s.organization_id) or public.is_platform_admin())
      )
    )
  )
  with check (
    public.can_edit_track(track_id)
    or (
      series_id is not null 
      and exists (
        select 1 from public.series s 
        where s.id = events.series_id 
          and (public.is_org_admin(s.organization_id) or public.is_platform_admin())
      )
    )
  );

drop policy if exists events_delete on public.events;
create policy events_delete on public.events
  for delete to authenticated
  using (
    public.can_edit_track(track_id)
    or (
      series_id is not null 
      and exists (
        select 1 from public.series s 
        where s.id = events.series_id 
          and (public.is_org_admin(s.organization_id) or public.is_platform_admin())
      )
    )
  );
