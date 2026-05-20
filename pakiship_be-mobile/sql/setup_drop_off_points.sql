-- Create the drop_off_points table inside the custom location schema
create table if not exists location.drop_off_points (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  operating_hours text,
  lat double precision not null,
  lng double precision not null,
  storage_capacity integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Grant full usage and access to the service role
grant usage on schema location to service_role;
grant all on location.drop_off_points to service_role;

-- Revoke public access (aligning with security guidelines)
revoke all on location.drop_off_points from anon, authenticated;

-- Seed the table with default Manila PakiHubs inside location schema
insert into location.drop_off_points (id, name, address, lat, lng, storage_capacity, operating_hours, is_active)
values
  ('9c9b9999-9999-9999-9999-999999999901', 'PakiShip Cubao Hub', 'Aurora Blvd, Cubao, Quezon City, Metro Manila', 14.6219, 121.0511, 100, '08:00 AM - 08:00 PM', true),
  ('9c9b9999-9999-9999-9999-999999999902', 'PakiShip BGC Hub', '26th St, Bonifacio Global City, Taguig, Metro Manila', 14.5496, 121.0437, 150, '08:00 AM - 08:00 PM', true),
  ('9c9b9999-9999-9999-9999-999999999903', 'PakiShip Makati Hub', 'Ayala Ave, Makati, Metro Manila', 14.5547, 121.0244, 120, '08:00 AM - 08:00 PM', true),
  ('9c9b9999-9999-9999-9999-999999999904', 'PakiShip SM North Hub', 'SM North EDSA, North Ave, Quezon City, Metro Manila', 14.6565, 121.0298, 120, '08:00 AM - 08:00 PM', true)
on conflict (id) do update
set
  name = excluded.name,
  address = excluded.address,
  lat = excluded.lat,
  lng = excluded.lng,
  storage_capacity = excluded.storage_capacity,
  operating_hours = excluded.operating_hours,
  is_active = excluded.is_active;
