alter table public.attempts add column updated_at timestamptz;
-- Unknown historical edit order remains null, rather than inventing a class as the latest.
create or replace function billing_private.stamp_scoring_row() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=clock_timestamp();return new;end $$;
revoke all on function billing_private.stamp_scoring_row() from public,anon,authenticated;
create trigger stamp_attempt_update before insert or update on public.attempts for each row execute function billing_private.stamp_scoring_row();
create trigger stamp_judge_update before insert or update on public.judge_scores for each row execute function billing_private.stamp_scoring_row();
