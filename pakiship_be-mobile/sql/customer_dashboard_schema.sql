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
