-- Add store_id to wallets table
ALTER TABLE public.wallets
ADD COLUMN store_id uuid references public.stores(id),
ADD CONSTRAINT check_wallet_source CHECK (
    (restaurant_id IS NOT NULL AND store_id IS NULL AND rider_id IS NULL) OR
    (restaurant_id IS NULL AND store_id IS NOT NULL AND rider_id IS NULL) OR
    (restaurant_id IS NULL AND store_id IS NULL AND rider_id IS NOT NULL) OR
    (restaurant_id IS NULL AND store_id IS NULL AND rider_id IS NULL) -- Personal
);

-- Update RLS for wallets (if needed, assuming existing RLS covers owner_id via joins or direct user_id for personal)
-- If RLS checks restaurant ownership, add store check too.
-- Example policy:
-- CREATE POLICY "Users can view their store wallet" ON public.wallets
-- FOR SELECT USING (
--   auth.uid() IN (SELECT owner_id FROM public.stores WHERE id = store_id)
-- );
