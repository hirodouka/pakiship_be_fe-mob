-- Create the drop_off_points table inside the custom parcel schema
create table if not exists parcel.drop_off_points (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  latitude double precision not null,
  longitude double precision not null,
  landmark text,
  max_capacity integer not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Grant full usage and access to the service role
grant usage on schema parcel to service_role;
grant all on parcel.drop_off_points to service_role;

-- Revoke public access (aligning with security guidelines)
revoke all on parcel.drop_off_points from anon, authenticated;

-- Seed the table with default Manila PakiHubs
insert into parcel.drop_off_points (id, name, address, latitude, longitude, landmark, max_capacity)
values
  ('9c9b9999-9999-9999-9999-999999999901', 'PakiShip Cubao Hub', 'Aurora Blvd, Cubao, Quezon City, Metro Manila', 14.6219, 121.0511, 'Near Gateway Mall', 100),
  ('9c9b9999-9999-9999-9999-999999999902', 'PakiShip BGC Hub', '26th St, Bonifacio Global City, Taguig, Metro Manila', 14.5496, 121.0437, 'Near High Street', 150),
  ('9c9b9999-9999-9999-9999-999999999903', 'PakiShip Makati Hub', 'Ayala Ave, Makati, Metro Manila', 14.5547, 121.0244, 'Near Greenbelt', 120),
  ('9c9b9999-9999-9999-9999-999999999904', 'PakiShip SM North Hub', 'SM North EDSA, North Ave, Quezon City, Metro Manila', 14.6565, 121.0298, 'Near The Block', 120)
on conflict (id) do update
set
  name = excluded.name,
  address = excluded.address,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  landmark = excluded.landmark,
  max_capacity = excluded.max_capacity;
