alter table parcel.parcel_drafts
drop constraint if exists parcel_drafts_status_check;

alter table parcel.parcel_drafts
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
