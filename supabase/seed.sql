insert into restaurants (id, name, timezone)
values ('24aca723-2050-436c-b42b-c83e23428b1e', 'Fourk Grill - Midtown', 'America/New_York')
on conflict (id) do update set name = excluded.name, timezone = excluded.timezone;

insert into app_users (restaurant_id, email, full_name, role)
values
  ('24aca723-2050-436c-b42b-c83e23428b1e', 'manager@fourk.local', 'Avery Lopez', 'manager')
on conflict (email) do update set
  full_name = excluded.full_name,
  role = excluded.role;

insert into servers (id, restaurant_id, name, is_active)
values
  ('10000000-0000-0000-0000-000000000001', '24aca723-2050-436c-b42b-c83e23428b1e', 'Maya R.', true),
  ('10000000-0000-0000-0000-000000000002', '24aca723-2050-436c-b42b-c83e23428b1e', 'Dylan K.', true),
  ('10000000-0000-0000-0000-000000000003', '24aca723-2050-436c-b42b-c83e23428b1e', 'Jordan V.', true),
  ('10000000-0000-0000-0000-000000000004', '24aca723-2050-436c-b42b-c83e23428b1e', 'Renee O.', true),
  ('10000000-0000-0000-0000-000000000005', '24aca723-2050-436c-b42b-c83e23428b1e', 'Noah T.', true)
on conflict (id) do update set
  name = excluded.name,
  is_active = excluded.is_active,
  updated_at = now();

insert into email_recipients (restaurant_id, email, display_name, is_active)
values
  ('24aca723-2050-436c-b42b-c83e23428b1e', 'ops@fourk.local', 'Closeout Ops', true)
on conflict do nothing;
