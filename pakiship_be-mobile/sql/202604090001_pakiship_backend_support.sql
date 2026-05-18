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
