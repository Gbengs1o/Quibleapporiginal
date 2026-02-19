-- Migration: Admin-Configurable Delivery Fee Parameters
-- Follows the same single-row config pattern as support_config (migration 49)

-- 1. Create the delivery config table
CREATE TABLE IF NOT EXISTS public.delivery_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Food Delivery Fees
    food_base_fee INTEGER DEFAULT 500,          -- N500 base fee
    food_per_km_rate INTEGER DEFAULT 100,       -- N100 per kilometer

    -- Item Delivery Fees (Intra-City / Within City)
    item_intra_base_fee INTEGER DEFAULT 500,    -- N500 base fee
    item_intra_per_km_rate INTEGER DEFAULT 100, -- N100 per kilometer

    -- Item Delivery Fees (Inter-City / City to City)
    item_inter_base_fee INTEGER DEFAULT 1500,   -- N1,500 base fee
    item_inter_per_km_rate INTEGER DEFAULT 200, -- N200 per kilometer

    -- Minimum price floor for item delivery
    item_min_price INTEGER DEFAULT 500,         -- N500 minimum

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insert the single configuration row
INSERT INTO public.delivery_config (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 3. Enable RLS
ALTER TABLE public.delivery_config ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- Everyone can READ the config (app needs to fetch fees)
CREATE POLICY "Allow public read access" ON public.delivery_config
FOR SELECT USING (true);

-- Only Admins can UPDATE the config
CREATE POLICY "Allow admin update access" ON public.delivery_config
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Protect INSERT/DELETE (Fixed config row)
CREATE POLICY "Deny insert" ON public.delivery_config FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny delete" ON public.delivery_config FOR DELETE USING (false);

-- 5. Auto-update timestamp on changes
CREATE OR REPLACE FUNCTION update_delivery_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_delivery_config_updated_at ON public.delivery_config;
CREATE TRIGGER set_delivery_config_updated_at
BEFORE UPDATE ON public.delivery_config
FOR EACH ROW EXECUTE FUNCTION update_delivery_config_timestamp();
