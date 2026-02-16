-- Add media_type column to delivery_requests
ALTER TABLE public.delivery_requests 
ADD COLUMN IF NOT EXISTS media_type text DEFAULT 'image'; 
-- 'image', 'video'
