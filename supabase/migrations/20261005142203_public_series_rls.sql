-- Update Series RLS policies to allow public (anon) read access

-- Series
drop policy if exists series_view on public.series;
create policy series_view on public.series for select using (true);

-- Series Classes
drop policy if exists series_classes_view on public.series_classes;
create policy series_classes_view on public.series_classes for select using (true);

-- Series Points Rules
drop policy if exists series_points_rules_view on public.series_points_rules;
create policy series_points_rules_view on public.series_points_rules for select using (true);

-- Series Bonuses
drop policy if exists series_bonuses_view on public.series_bonuses;
create policy series_bonuses_view on public.series_bonuses for select using (true);

-- Series Rosters
drop policy if exists series_rosters_view on public.series_rosters;
create policy series_rosters_view on public.series_rosters for select using (true);
