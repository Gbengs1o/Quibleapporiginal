-- 51. Ensure Business Wallets for Restaurants
-- Purpose: Restaurants need a 'business' wallet to pay for delivery fees.
-- This migration ensures a wallet is created when a restaurant is created, and backfills missing ones.

-- 1. Trigger Function: Create Wallet on Restaurant Creation
CREATE OR REPLACE FUNCTION public.create_restaurant_wallet()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.wallets (restaurant_id, type, balance)
    VALUES (NEW.id, 'business', 0.00)
    ON CONFLICT DO NOTHING; -- Handle potential duplicates gracefully
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create Trigger
DROP TRIGGER IF EXISTS on_restaurant_created ON public.restaurants;
CREATE TRIGGER on_restaurant_created
AFTER INSERT ON public.restaurants
FOR EACH ROW
EXECUTE FUNCTION public.create_restaurant_wallet();

-- 3. Backfill: Create wallets for existing restaurants that don't have one
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.restaurants LOOP
        IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE restaurant_id = r.id AND type = 'business') THEN
            INSERT INTO public.wallets (restaurant_id, type, balance)
            VALUES (r.id, 'business', 0.00);
        END IF;
    END LOOP;
END;
$$;
