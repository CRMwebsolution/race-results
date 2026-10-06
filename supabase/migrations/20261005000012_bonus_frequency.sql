alter table public.series_bonuses
add column series_class_id uuid references public.series_classes(id) on delete cascade,
add column frequency text not null default 'per_class' check (frequency in ('per_class', 'per_event'));
