-- Songa 2.0: PayPal commerce and minimal anonymous AI usage metering.
-- Apply only after reviewing against the remote schema. Does not alter Flight Watch tables.

create table if not exists public.paypal_orders (
  id uuid primary key default gen_random_uuid(),
  paypal_order_id text not null unique,
  paypal_capture_id text unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  flight_number text not null,
  travel_date date not null,
  currency text not null default 'USD',
  amount numeric(10,2) not null check (amount > 0),
  environment text not null default 'sandbox' check (environment in ('sandbox','live')),
  status text not null default 'CREATED',
  created_at timestamptz not null default now(),
  captured_at timestamptz
);
create index if not exists paypal_orders_user_created_idx on public.paypal_orders(user_id, created_at desc);

create table if not exists public.premium_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  flight_number text not null,
  travel_date date not null,
  paypal_order_id text not null unique references public.paypal_orders(paypal_order_id) on delete cascade,
  status text not null default 'active' check (status in ('active','revoked','expired')),
  created_at timestamptz not null default now()
);
create index if not exists premium_entitlements_user_idx on public.premium_entitlements(user_id, created_at desc);

create table if not exists public.paypal_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed boolean not null default false,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.songa_ai_usage (
  id bigint generated always as identity primary key,
  client_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists songa_ai_usage_client_created_idx on public.songa_ai_usage(client_hash, created_at desc);
-- Keep only a short window of anonymous rate-limit hashes.
create index if not exists songa_ai_usage_created_idx on public.songa_ai_usage(created_at);

alter table public.paypal_orders enable row level security;
alter table public.premium_entitlements enable row level security;
alter table public.paypal_webhook_events enable row level security;
alter table public.songa_ai_usage enable row level security;

drop policy if exists "Users can read their own PayPal orders" on public.paypal_orders;
create policy "Users can read their own PayPal orders" on public.paypal_orders for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can read their own premium entitlements" on public.premium_entitlements;
create policy "Users can read their own premium entitlements" on public.premium_entitlements for select to authenticated using (auth.uid() = user_id);
-- Writes to all four tables are server-only via the Supabase service role.
revoke insert, update, delete on public.paypal_orders from anon, authenticated;
revoke insert, update, delete on public.premium_entitlements from anon, authenticated;
revoke all on public.paypal_webhook_events from anon, authenticated;
revoke all on public.songa_ai_usage from anon, authenticated;

grant select on public.paypal_orders to authenticated;
grant select on public.premium_entitlements to authenticated;

-- One shared AeroAPI positions cache row prevents each page visitor from causing a global positions query.
create table if not exists public.songa_global_positions_cache (
  id smallint primary key check (id = 1),
  payload jsonb not null,
  fetched_at timestamptz not null
);
alter table public.songa_global_positions_cache enable row level security;
revoke all on public.songa_global_positions_cache from anon, authenticated;
