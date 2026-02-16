-- Migration 48: Add Restaurant Status for Approval Workflow

-- 1. Create a custom enum for restaurant status if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'restaurant_status') THEN
        CREATE TYPE public.restaurant_status AS ENUM ('pending', 'active', 'rejected', 'suspended');
    END IF;
END $$;

-- 2. Add status column to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS status public.restaurant_status DEFAULT 'pending';

-- 3. Backfill existing restaurants (Optional: set them to active so current users aren't broken)
UPDATE public.restaurants 
SET status = 'active' 
WHERE status IS NULL OR status = 'pending';
