-- Songa traveller personalisation preferences.
create table if not exists public.songa_traveller_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or length(display_name) <= 80),
  home_airport text check (home_airport is null or home_airport ~ '^[A-Z]{3}$'),
  preferred_currency text not null default 'USD' check (preferred_currency ~ '^[A-Z]{3}$'),
  travel_interests text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.songa_traveller_profiles enable row level security;
drop policy if exists songa_traveller_profiles_select_own on public.songa_traveller_profiles;
create policy songa_traveller_profiles_select_own on public.songa_traveller_profiles
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists songa_traveller_profiles_insert_own on public.songa_traveller_profiles;
create policy songa_traveller_profiles_insert_own on public.songa_traveller_profiles
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists songa_traveller_profiles_update_own on public.songa_traveller_profiles;
create policy songa_traveller_profiles_update_own on public.songa_traveller_profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.songa_traveller_profiles from anon;
grant select, insert, update on public.songa_traveller_profiles to authenticated;
