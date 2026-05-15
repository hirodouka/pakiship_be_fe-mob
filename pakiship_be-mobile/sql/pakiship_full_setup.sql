-- ==========================================
-- BASE SCHEMA DEFINITIONS
-- ==========================================
-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  dob DATE,
  address TEXT,
  city TEXT,
  province TEXT,
  role TEXT DEFAULT 'customer',
  profile_picture TEXT,
  documents TEXT[] DEFAULT '{}',
  notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 2. Drop Off Points (Hubs)
CREATE TABLE IF NOT EXISTS public.drop_off_points (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  max_capacity INTEGER DEFAULT 100,
  landmark TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 3. Parcel Drafts Table
CREATE TABLE IF NOT EXISTS public.parcel_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pickup_address TEXT,
  pickup_details TEXT,
  delivery_address TEXT,
  delivery_details TEXT,
  distance_text TEXT,
  duration_text TEXT,
  step_completed INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft',
  tracking_number TEXT UNIQUE,
  sender_name TEXT,
  sender_phone TEXT,
  receiver_name TEXT,
  receiver_phone TEXT,
  assigned_driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  constraint parcel_drafts_status_check check (status in ('draft', 'submitted', 'cancelled', 'delivered', 'lost', 'accepted', 'picked-up', 'out-for-delivery'))
);

-- 4. Parcel Draft Items Table
CREATE TABLE IF NOT EXISTS public.parcel_draft_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_draft_id UUID REFERENCES public.parcel_drafts(id) ON DELETE CASCADE,
  size TEXT,
  weight_text TEXT,
  item_type TEXT,
  delivery_guarantee TEXT,
  quantity INTEGER DEFAULT 1,
  photo_name TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 5. Parcel Hub Records
CREATE TABLE IF NOT EXISTS public.parcel_hub_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id TEXT REFERENCES public.drop_off_points(id) ON DELETE CASCADE,
  parcel_draft_id UUID REFERENCES public.parcel_drafts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'stored' CHECK (status IN ('stored', 'dispatched', 'returned')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- ==========================================
-- PATCHES & UPDATES
-- ==========================================

alter table public.profiles
  add column if not exists notification_preferences jsonb not null default '{}'::jsonb;

-- ==========================================
-- 202604090001_pakiship_backend_support.sql
-- ==========================================
alter table if exists public.parcel_drafts
  add column if not exists service_id text,
  add column if not exists service_price numeric,
  add column if not exists delivery_mode text,
  add column if not exists is_bulk boolean not null default false,
  add column if not exists drop_off_point_id text,
  add column if not exists drop_off_point_name text,
  add column if not exists drop_off_point_address text,
  add column if not exists drop_off_point_distance_text text,
  add column if not exists drop_off_point_status text,
  add column if not exists drop_off_point_capacity text,
  add column if not exists tracking_current_location text,
  add column if not exists tracking_progress_label text,
  add column if not exists tracking_progress_percentage integer not null default 0;

update public.parcel_drafts
set
  delivery_mode = coalesce(delivery_mode, case when service_id = 'pakishare' then 'relay' else 'direct' end),
  tracking_progress_label = coalesce(tracking_progress_label, case when status = 'submitted' then 'Booking Confirmed' else 'Draft Saved' end),
  tracking_progress_percentage = coalesce(tracking_progress_percentage, case when status = 'submitted' then 20 else 0 end)
where true;

-- ==========================================
-- 202604170001_allow_lost_parcel_status.sql
-- ==========================================
alter table public.parcel_drafts
drop constraint if exists parcel_drafts_status_check;

alter table public.parcel_drafts
add constraint parcel_drafts_status_check
check (
  status = any (
    array[
      'draft'::text,
      'submitted'::text,
      'cancelled'::text,
      'lost'::text
    ]
  )
);

-- ==========================================
-- create-parcel-reviews.sql
-- ==========================================
create table if not exists public.parcel_reviews (
  id uuid primary key default gen_random_uuid(),
  parcel_draft_id uuid not null references public.parcel_drafts(id) on delete cascade,
  customer_user_id uuid not null references public.profiles(id) on delete cascade,
  hub_id uuid not null,
  tracking_number text not null,
  rating integer not null check (rating between 1 and 5),
  review_text text,
  tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (parcel_draft_id, customer_user_id)
);

create index if not exists parcel_reviews_hub_id_created_at_idx
  on public.parcel_reviews (hub_id, created_at desc);

create index if not exists parcel_reviews_customer_user_id_idx
  on public.parcel_reviews (customer_user_id);

-- ==========================================
-- create-parcel-service-selections.sql
-- ==========================================
create table if not exists public.parcel_service_selections (
  parcel_draft_id uuid primary key references public.parcel_drafts(id) on delete cascade,
  service_id text not null,
  service_price numeric not null,
  hub_id text,
  hub_name text,
  hub_address text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists parcel_service_selections_hub_id_idx
  on public.parcel_service_selections (hub_id);

-- Enable RLS
alter table public.parcel_service_selections enable row level security;

-- Policies
create policy "Users can manage their own service selections"
  on public.parcel_service_selections
  for all
  using (
    exists (
      select 1 from public.parcel_drafts
      where id = parcel_service_selections.parcel_draft_id
      and user_id = auth.uid()
    )
  );

-- ==========================================
-- customer_dashboard_schema.sql
-- ==========================================
-- Customer dashboard supporting tables
-- Run this in Supabase SQL editor for your project.

create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tracking_number text not null,
  rating int not null check (rating between 1 and 5),
  review_text text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists customer_reviews_user_created_idx
  on public.customer_reviews (user_id, created_at desc);

create unique index if not exists customer_reviews_user_tracking_unique
  on public.customer_reviews (user_id, tracking_number);

create table if not exists public.customer_announcements (
  id text primary key,
  type text not null check (type in ('system', 'update', 'promo')),
  title text not null,
  message text not null,
  is_pinned boolean not null default false,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists customer_announcements_active_created_idx
  on public.customer_announcements (is_active, created_at desc);

insert into public.customer_announcements (id, type, title, message, is_pinned)
values
  (
    'maint-001',
    'system',
    'Scheduled Maintenance',
    'System will be offline on March 15, 2:00 AM - 4:00 AM PHT.',
    true
  ),
  (
    'lipa-hub-2024',
    'update',
    'New Partner Hubs in Lipa!',
    'You can now drop off parcels at new partner locations in Lipa City.',
    false
  )
on conflict (id) do nothing;

-- ==========================================
-- customer_saved_recipients.sql
-- ==========================================
create table if not exists public.customer_saved_recipients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  frequency integer not null default 1 check (frequency >= 1),
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_saved_recipients_user_phone_unique
  on public.customer_saved_recipients (user_id, phone);

create index if not exists customer_saved_recipients_user_frequency_idx
  on public.customer_saved_recipients (user_id, frequency desc, last_used_at desc);

-- ==========================================
-- driver-dashboard.schema.sql
-- ==========================================
create extension if not exists "pgcrypto";

create table if not exists public.driver_jobs (
  id uuid primary key default gen_random_uuid(),
  job_number text not null unique,
  parcel_draft_id uuid null references public.parcel_drafts(id) on delete set null,
  customer_user_id uuid null references public.profiles(id) on delete set null,
  driver_user_id uuid null references public.profiles(id) on delete set null,
  pickup_address text not null,
  dropoff_address text not null,
  distance_text text null,
  earnings_amount numeric(10,2) not null default 0,
  status text not null default 'available' check (status in ('available', 'in-progress', 'completed')),
  parcel_status text null check (parcel_status in ('picked-up', 'out-for-delivery', 'delivered')),
  customer_name text not null,
  customer_phone text null,
  package_size text not null default 'Small' check (package_size in ('Small', 'Medium', 'Large')),
  time_limit_text text null,
  package_description text null,
  special_instructions text null,
  rating numeric(3,2) null check (rating >= 0 and rating <= 5),
  accepted_at timestamptz null,
  picked_up_at timestamptz null,
  delivered_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists driver_jobs_status_idx on public.driver_jobs(status, created_at desc);
create index if not exists driver_jobs_driver_idx on public.driver_jobs(driver_user_id, status, updated_at desc);
create index if not exists driver_jobs_completed_idx on public.driver_jobs(driver_user_id, completed_at desc);

create table if not exists public.driver_sessions (
  driver_user_id uuid primary key references public.profiles(id) on delete cascade,
  is_online boolean not null default false,
  current_session_started_at timestamptz null,
  accumulated_online_seconds integer not null default 0,
  last_seen_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.driver_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.driver_jobs(id) on delete cascade,
  driver_user_id uuid null references public.profiles(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists driver_job_events_job_idx on public.driver_job_events(job_id, created_at desc);

create or replace function public.set_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists driver_jobs_set_updated_at on public.driver_jobs;
create trigger driver_jobs_set_updated_at
before update on public.driver_jobs
for each row
execute function public.set_timestamp_updated_at();

drop trigger if exists driver_sessions_set_updated_at on public.driver_sessions;
create trigger driver_sessions_set_updated_at
before update on public.driver_sessions
for each row
execute function public.set_timestamp_updated_at();

alter table public.driver_jobs enable row level security;
alter table public.driver_sessions enable row level security;
alter table public.driver_job_events enable row level security;

create policy "drivers can read available jobs"
on public.driver_jobs
for select
using (
  status = 'available'
  or driver_user_id = auth.uid()
);

create policy "drivers can update their own jobs"
on public.driver_jobs
for update
using (driver_user_id = auth.uid())
with check (driver_user_id = auth.uid());

create policy "drivers can read their own session"
on public.driver_sessions
for select
using (driver_user_id = auth.uid());

create policy "drivers can manage their own session"
on public.driver_sessions
for all
using (driver_user_id = auth.uid())
with check (driver_user_id = auth.uid());

create policy "drivers can read their own job events"
on public.driver_job_events
for select
using (driver_user_id = auth.uid());
