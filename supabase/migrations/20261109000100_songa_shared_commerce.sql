-- Songa 2.0 shared Commerce Engine.
-- Adds isolated tables for five product journeys without altering Flight Watch tables.
-- Apply only after reviewing the live project and taking a schema backup.

create table if not exists public.songa_commerce_orders (
  id uuid primary key default gen_random_uuid(),
  paypal_order_id text not null unique,
  paypal_capture_id text unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  amount numeric(10,2) not null check (amount > 0),
  currency_code text not null default 'USD',
  payment_status text not null default 'CREATED'
    check (payment_status in ('CREATED','APPROVED','COMPLETED','PENDING','DENIED','REFUNDED','REVERSED','CANCELLED')),
  fulfilment_status text not null default 'PENDING'
    check (fulfilment_status in ('PENDING','READY','ISSUED','AWAITING_MERCHANT','CANCELLED','REVOKED')),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  captured_at timestamptz,
  fulfilled_at timestamptz
);
create index if not exists songa_commerce_orders_user_idx on public.songa_commerce_orders(user_id, created_at desc);
create index if not exists songa_commerce_orders_product_idx on public.songa_commerce_orders(product_id, payment_status, created_at desc);

create table if not exists public.songa_commerce_entitlements (
  id uuid primary key default gen_random_uuid(),
  source_order_id uuid not null unique references public.songa_commerce_orders(id) on delete cascade,
  purchaser_user_id uuid not null references auth.users(id) on delete cascade,
  beneficiary_user_id uuid references auth.users(id) on delete set null,
  product_id text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','EXPIRED','REVOKED','CLAIMED','PENDING_CLAIM')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  max_journeys integer not null default 1 check (max_journeys between 1 and 100),
  used_journeys integer not null default 0 check (used_journeys >= 0),
  beneficiary_email text,
  gift_code text unique,
  gift_claimed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists songa_commerce_entitlements_purchaser_idx on public.songa_commerce_entitlements(purchaser_user_id, status, ends_at);
create index if not exists songa_commerce_entitlements_beneficiary_idx on public.songa_commerce_entitlements(beneficiary_user_id, status, ends_at);

create table if not exists public.songa_group_journeys (
  id uuid primary key default gen_random_uuid(),
  source_entitlement_id uuid not null unique references public.songa_commerce_entitlements(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  group_name text not null,
  share_code text not null unique,
  journey_limit integer not null default 5 check (journey_limit between 1 and 20),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists songa_group_journeys_owner_idx on public.songa_group_journeys(owner_user_id, created_at desc);

create table if not exists public.songa_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.songa_group_journeys(id) on delete cascade,
  invited_email text not null,
  member_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'INVITED' check (status in ('INVITED','ACCEPTED','REMOVED')),
  created_at timestamptz not null default now(),
  unique(group_id, invited_email)
);
create index if not exists songa_group_members_group_idx on public.songa_group_members(group_id, status);

create table if not exists public.songa_airside_orders (
  id uuid primary key default gen_random_uuid(),
  commerce_order_id uuid not null unique references public.songa_commerce_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  airport_code text not null,
  merchant_name text not null,
  pickup_reference text not null unique,
  fulfilment_status text not null default 'PAID_SANDBOX_AWAITING_MERCHANT'
    check (fulfilment_status in ('PAID_SANDBOX_AWAITING_MERCHANT','ACCEPTED','PREPARING','READY_FOR_PICKUP','COLLECTED','CANCELLED')),
  items jsonb not null default '[]'::jsonb,
  total numeric(10,2) not null check (total > 0),
  currency_code text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists songa_airside_orders_user_idx on public.songa_airside_orders(user_id, created_at desc);
create index if not exists songa_airside_orders_status_idx on public.songa_airside_orders(fulfilment_status, created_at);

create table if not exists public.songa_commerce_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed boolean not null default false,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.songa_commerce_orders enable row level security;
alter table public.songa_commerce_entitlements enable row level security;
alter table public.songa_group_journeys enable row level security;
alter table public.songa_group_members enable row level security;
alter table public.songa_airside_orders enable row level security;
alter table public.songa_commerce_webhook_events enable row level security;

drop policy if exists songa_commerce_orders_select_own on public.songa_commerce_orders;
create policy songa_commerce_orders_select_own on public.songa_commerce_orders for select to authenticated using (auth.uid() = user_id);
drop policy if exists songa_commerce_entitlements_select_own on public.songa_commerce_entitlements;
create policy songa_commerce_entitlements_select_own on public.songa_commerce_entitlements for select to authenticated
  using (auth.uid() = purchaser_user_id or auth.uid() = beneficiary_user_id);
drop policy if exists songa_group_journeys_select_own on public.songa_group_journeys;
create policy songa_group_journeys_select_own on public.songa_group_journeys for select to authenticated using (auth.uid() = owner_user_id);
drop policy if exists songa_group_members_select_group_owner on public.songa_group_members;
create policy songa_group_members_select_group_owner on public.songa_group_members for select to authenticated
  using (exists (select 1 from public.songa_group_journeys g where g.id = group_id and g.owner_user_id = auth.uid()));
drop policy if exists songa_airside_orders_select_own on public.songa_airside_orders;
create policy songa_airside_orders_select_own on public.songa_airside_orders for select to authenticated using (auth.uid() = user_id);

-- All writes are service-role-only. Clients can inspect only rows allowed by RLS.
revoke insert, update, delete on public.songa_commerce_orders from anon, authenticated;
revoke insert, update, delete on public.songa_commerce_entitlements from anon, authenticated;
revoke insert, update, delete on public.songa_group_journeys from anon, authenticated;
revoke insert, update, delete on public.songa_group_members from anon, authenticated;
revoke insert, update, delete on public.songa_airside_orders from anon, authenticated;
revoke all on public.songa_commerce_webhook_events from anon, authenticated;
grant select on public.songa_commerce_orders to authenticated;
grant select on public.songa_commerce_entitlements to authenticated;
grant select on public.songa_group_journeys to authenticated;
grant select on public.songa_group_members to authenticated;
grant select on public.songa_airside_orders to authenticated;

create table if not exists public.songa_group_flights (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.songa_group_journeys(id) on delete cascade,
  added_by_user_id uuid not null references auth.users(id) on delete cascade,
  flight_number text not null check (length(trim(flight_number)) between 2 and 16),
  travel_date date not null,
  origin_code text,
  destination_code text,
  provider_status text,
  provider_checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(group_id, flight_number, travel_date)
);
create index if not exists songa_group_flights_group_idx on public.songa_group_flights(group_id, travel_date);
alter table public.songa_group_flights enable row level security;
drop policy if exists songa_group_flights_select_member on public.songa_group_flights;
create policy songa_group_flights_select_member on public.songa_group_flights for select to authenticated using (
  exists (select 1 from public.songa_group_journeys g where g.id = group_id and g.owner_user_id = auth.uid())
  or exists (select 1 from public.songa_group_members m where m.group_id = songa_group_flights.group_id and m.member_user_id = auth.uid() and m.status = 'ACCEPTED')
);
revoke insert, update, delete on public.songa_group_flights from anon, authenticated;
grant select on public.songa_group_flights to authenticated;

drop policy if exists songa_group_members_select_group_owner on public.songa_group_members;
create policy songa_group_members_select_group_owner on public.songa_group_members for select to authenticated using (
  exists (select 1 from public.songa_group_journeys g where g.id = group_id and g.owner_user_id = auth.uid())
  or member_user_id = auth.uid()
);

drop policy if exists songa_group_journeys_select_own on public.songa_group_journeys;
create policy songa_group_journeys_select_own on public.songa_group_journeys for select to authenticated using (
  auth.uid() = owner_user_id
  or exists (select 1 from public.songa_group_members m where m.group_id = songa_group_journeys.id and m.member_user_id = auth.uid() and m.status = 'ACCEPTED')
);

-- Security-definer lookup avoids recursive RLS between group, member and group-flight policies.
create or replace function public.songa_is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.songa_group_members m
    where m.group_id = p_group_id and m.member_user_id = p_user_id and m.status = 'ACCEPTED'
  );
$$;
create or replace function public.songa_is_group_owner(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.songa_group_journeys g
    where g.id = p_group_id and g.owner_user_id = p_user_id
  );
$$;
revoke all on function public.songa_is_group_member(uuid, uuid) from public;
revoke all on function public.songa_is_group_owner(uuid, uuid) from public;
grant execute on function public.songa_is_group_member(uuid, uuid) to authenticated;
grant execute on function public.songa_is_group_owner(uuid, uuid) to authenticated;

drop policy if exists songa_group_journeys_select_own on public.songa_group_journeys;
create policy songa_group_journeys_select_own on public.songa_group_journeys for select to authenticated
  using (owner_user_id = auth.uid() or public.songa_is_group_member(id, auth.uid()));
drop policy if exists songa_group_members_select_group_owner on public.songa_group_members;
create policy songa_group_members_select_group_owner on public.songa_group_members for select to authenticated
  using (member_user_id = auth.uid() or public.songa_is_group_owner(group_id, auth.uid()));
drop policy if exists songa_group_flights_select_member on public.songa_group_flights;
create policy songa_group_flights_select_member on public.songa_group_flights for select to authenticated
  using (public.songa_is_group_owner(group_id, auth.uid()) or public.songa_is_group_member(group_id, auth.uid()));
