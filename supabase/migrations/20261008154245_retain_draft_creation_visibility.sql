-- Use row fields in the event policy so INSERT ... RETURNING can see the new draft.
alter policy events_read on public.events using(
 public.is_platform_admin() or (track_id is not null and public.can_view_track(track_id))
 or (series_id is not null and public.can_view_series_account(series_id))
 or (archived_at is null and (public_until is null or public_until>now()) and
  (status='scheduled' or(status in('live','completed') and published_revision>0)))
);