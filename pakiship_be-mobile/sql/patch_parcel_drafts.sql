-- Add missing columns to parcel.parcel_drafts
ALTER TABLE parcel.parcel_drafts 
ADD COLUMN IF NOT EXISTS pickup_details TEXT,
ADD COLUMN IF NOT EXISTS delivery_details TEXT,
ADD COLUMN IF NOT EXISTS distance_text TEXT,
ADD COLUMN IF NOT EXISTS duration_text TEXT,
ADD COLUMN IF NOT EXISTS step_completed INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Ensure tracking_progress_label and other tracking columns exist
ALTER TABLE parcel.parcel_drafts
ADD COLUMN IF NOT EXISTS tracking_progress_label TEXT,
ADD COLUMN IF NOT EXISTS tracking_current_location TEXT,
ADD COLUMN IF NOT EXISTS tracking_progress_percentage INTEGER DEFAULT 0;
