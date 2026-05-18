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
