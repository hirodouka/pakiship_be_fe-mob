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
