-- Fix Chats Foreign Keys to reference public.profiles instead of auth.users
-- This allows PostgREST to properly join chats with user profiles

ALTER TABLE public.chats
    DROP CONSTRAINT IF EXISTS chats_user_id_fkey,
    DROP CONSTRAINT IF EXISTS chats_rider_id_fkey;

ALTER TABLE public.chats
    ADD CONSTRAINT chats_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;

ALTER TABLE public.chats
    ADD CONSTRAINT chats_rider_id_fkey
    FOREIGN KEY (rider_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;
