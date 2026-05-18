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
