-- Add columns for Vehicle Selection and Media Upload
ALTER TABLE public.delivery_requests 
ADD COLUMN IF NOT EXISTS vehicle_types TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT; -- 'image' or 'video'
