-- Create the operator_hubs table inside the custom routing schema
create table if not exists routing.operator_hubs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid,
  code text,
  name text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  storage_capacity integer not null default 100,
  is_active boolean not null default true,
  geofence_on boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Grant full usage and access to the service role
grant usage on schema routing to service_role;
grant all on routing.operator_hubs to service_role;

-- Revoke public access (aligning with security guidelines)
revoke all on routing.operator_hubs from anon, authenticated;

-- Seed the table with the appointed default Manila PakiHubs inside routing.operator_hubs
insert into routing.operator_hubs (id, name, address, lat, lng, storage_capacity, is_active, geofence_on, code)
values
  ('9c9b9999-9999-9999-9999-999999999901', 'PakiShip Cubao Hub', 'Aurora Blvd, Cubao, Quezon City, Metro Manila', 14.6219, 121.0511, 100, true, true, 'HUB-MNL-004'),
  ('9c9b9999-9999-9999-9999-999999999902', 'PakiShip BGC Hub', '26th St, Bonifacio Global City, Taguig, Metro Manila', 14.5496, 121.0437, 150, true, true, 'HUB-MNL-005'),
  ('9c9b9999-9999-9999-9999-999999999903', 'PakiShip Makati Hub', 'Ayala Ave, Makati, Metro Manila', 14.5547, 121.0244, 120, true, true, 'HUB-MNL-006'),
  ('9c9b9999-9999-9999-9999-999999999904', 'PakiShip SM North Hub', 'SM North EDSA, North Ave, Quezon City, Metro Manila', 14.6565, 121.0298, 120, true, true, 'HUB-MNL-007')
on conflict (id) do update
set
  name = excluded.name,
  address = excluded.address,
  lat = excluded.lat,
  lng = excluded.lng,
  storage_capacity = excluded.storage_capacity,
  is_active = excluded.is_active,
  geofence_on = excluded.geofence_on,
  code = excluded.code;
