create extension if not exists pgcrypto;

create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now()
);

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null default 'manager',
  created_at timestamptz not null default now()
);

create table if not exists servers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_servers_restaurant_active on servers(restaurant_id, is_active);

create table if not exists closeouts (
  id text primary key,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  business_date date not null,
  shift text not null check (shift in ('Lunch', 'Dinner')),
  manager_name text not null,
  backroom_party boolean not null default false,
  status text not null check (status in ('Draft', 'Submitted')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_closeouts_restaurant_date on closeouts(restaurant_id, business_date desc);

create table if not exists server_payouts (
  id text primary key,
  closeout_id text not null references closeouts(id) on delete cascade,
  row_order integer not null,
  row_type text not null check (row_type in ('standard', 'custom')),
  server_id uuid references servers(id),
  custom_name text,
  cash_paid_in numeric(12,2) not null default 0,
  cash_paid_out numeric(12,2) not null default 0,
  tip_share numeric(12,2) not null default 0,
  runner numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_server_payouts_closeout on server_payouts(closeout_id, row_order);

create table if not exists petty_cash_records (
  closeout_id text primary key references closeouts(id) on delete cascade,
  cash_on_hand numeric(12,2) not null default 0,
  receipts numeric(12,2) not null default 0,
  bank_withdrawal numeric(12,2) not null default 0,
  actual_physical_cash numeric(12,2) not null default 0,
  comments text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists closeout_edit_history (
  id uuid primary key default gen_random_uuid(),
  closeout_id text not null references closeouts(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_closeout_edit_history_closeout on closeout_edit_history(closeout_id, created_at desc);

create table if not exists email_recipients (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  email text not null,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_recipients_restaurant on email_recipients(restaurant_id, is_active);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

alter table restaurants enable row level security;
alter table app_users enable row level security;
alter table servers enable row level security;
alter table closeouts enable row level security;
alter table server_payouts enable row level security;
alter table petty_cash_records enable row level security;
alter table closeout_edit_history enable row level security;
alter table email_recipients enable row level security;

drop policy if exists restaurants_dev_access on restaurants;
create policy restaurants_dev_access
on restaurants
for all
to anon, authenticated
using (id = '00000000-0000-0000-0000-000000000001'::uuid)
with check (id = '00000000-0000-0000-0000-000000000001'::uuid);

drop policy if exists app_users_dev_access on app_users;
create policy app_users_dev_access
on app_users
for all
to anon, authenticated
using (restaurant_id = '00000000-0000-0000-0000-000000000001'::uuid)
with check (restaurant_id = '00000000-0000-0000-0000-000000000001'::uuid);

drop policy if exists servers_dev_access on servers;
create policy servers_dev_access
on servers
for all
to anon, authenticated
using (restaurant_id = '00000000-0000-0000-0000-000000000001'::uuid)
with check (restaurant_id = '00000000-0000-0000-0000-000000000001'::uuid);

drop policy if exists closeouts_dev_access on closeouts;
create policy closeouts_dev_access
on closeouts
for all
to anon, authenticated
using (restaurant_id = '00000000-0000-0000-0000-000000000001'::uuid)
with check (restaurant_id = '00000000-0000-0000-0000-000000000001'::uuid);

drop policy if exists server_payouts_dev_access on server_payouts;
create policy server_payouts_dev_access
on server_payouts
for all
to anon, authenticated
using (
  exists (
    select 1
    from closeouts c
    where c.id = server_payouts.closeout_id
      and c.restaurant_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
)
with check (
  exists (
    select 1
    from closeouts c
    where c.id = server_payouts.closeout_id
      and c.restaurant_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
);

drop policy if exists petty_cash_records_dev_access on petty_cash_records;
create policy petty_cash_records_dev_access
on petty_cash_records
for all
to anon, authenticated
using (
  exists (
    select 1
    from closeouts c
    where c.id = petty_cash_records.closeout_id
      and c.restaurant_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
)
with check (
  exists (
    select 1
    from closeouts c
    where c.id = petty_cash_records.closeout_id
      and c.restaurant_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
);

drop policy if exists closeout_edit_history_dev_access on closeout_edit_history;
create policy closeout_edit_history_dev_access
on closeout_edit_history
for all
to anon, authenticated
using (
  exists (
    select 1
    from closeouts c
    where c.id = closeout_edit_history.closeout_id
      and c.restaurant_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
)
with check (
  exists (
    select 1
    from closeouts c
    where c.id = closeout_edit_history.closeout_id
      and c.restaurant_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
);

drop policy if exists email_recipients_dev_access on email_recipients;
create policy email_recipients_dev_access
on email_recipients
for all
to anon, authenticated
using (restaurant_id = '00000000-0000-0000-0000-000000000001'::uuid)
with check (restaurant_id = '00000000-0000-0000-0000-000000000001'::uuid);
