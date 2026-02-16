-- Fix Rider Name resolution by linking riders to profiles
-- This allows: .select('*, rider:riders(*, profile:profiles(*))')

-- Add FK from riders.user_id to public.profiles.id
-- We use DO block to avoid error if it already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_riders_profiles' 
        AND table_name = 'riders'
    ) THEN
        ALTER TABLE public.riders 
        ADD CONSTRAINT fk_riders_profiles 
        FOREIGN KEY (user_id) 
        REFERENCES public.profiles(id);
    END IF;
END $$;
