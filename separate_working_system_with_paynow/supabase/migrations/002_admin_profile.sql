-- Add avatar_url to admins table
ALTER TABLE admins ADD COLUMN IF NOT EXISTS avatar_url TEXT;
