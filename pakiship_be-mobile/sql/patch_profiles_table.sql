-- Add missing columns to account.profiles
ALTER TABLE account.profiles 
ADD COLUMN IF NOT EXISTS discount_id_uploaded BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS discount_id_type TEXT,
ADD COLUMN IF NOT EXISTS discount_id_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS discount_id_file_url TEXT,
ADD COLUMN IF NOT EXISTS discount_id_submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS discount_id_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ;
