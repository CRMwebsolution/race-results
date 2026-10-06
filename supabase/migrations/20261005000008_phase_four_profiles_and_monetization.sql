-- Phase 4: Profiles and Monetization

-- 1. Create profiles table to satisfy the existing handle_new_user trigger
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_premium boolean not null default false,
  tier text not null default 'free',
  display_name text,
  home_track_id uuid references public.tracks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS for profiles
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Optional: Allow public to view basic profile info if needed later
create policy "Public can view basic profiles"
  on public.profiles for select
  to anon, authenticated
  using (true);

-- 2. Add state and default_classes to tracks
alter table public.tracks
add column if not exists state text,
add column if not exists default_classes jsonb not null default '[]'::jsonb;
