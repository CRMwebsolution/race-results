alter table public.profiles
add column if not exists full_name text,
add column if not exists phone text,
add column if not exists show_tips boolean not null default true;

grant update (full_name, phone, show_tips) on public.profiles to authenticated;
