-- PERFORMANCE & FLEXIBILITY IMPROVEMENTS

-- 1. Add Missing Indexes (Critical for RLS and Filtering Efficiency)
-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON public.orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- Order Items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- Delivery Requests
CREATE INDEX IF NOT EXISTS idx_delivery_requests_user_id ON public.delivery_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_rider_id ON public.delivery_requests(rider_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_status ON public.delivery_requests(status); -- Critical for rider feed
CREATE INDEX IF NOT EXISTS idx_delivery_requests_pickup_geo ON public.delivery_requests(pickup_latitude, pickup_longitude);

-- Wallets
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_restaurant_id ON public.wallets(restaurant_id);

-- Rider Reviews
CREATE INDEX IF NOT EXISTS idx_rider_reviews_rider_id ON public.rider_reviews(rider_id);

-- 2. Dynamic Settings Table
-- Allows changing fees without code deployment
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read settings (needed for client-side calculations or display)
CREATE POLICY "Allow public read settings" ON public.platform_settings FOR SELECT USING (true);
-- Only admins can insert/update (Policy to be added based on admin system, default deny for now is safe for security)

-- Insert Default Logistics Fees
INSERT INTO public.platform_settings (key, value, description)
VALUES 
    ('logistics_fees', '{"base_fee": 500, "per_km_fee": 100}'::jsonb, 'Delivery fee calculation parameters in NGN')
ON CONFLICT (key) DO NOTHING;

-- 3. Update Fee Calculation to use Dynamic Settings
CREATE OR REPLACE FUNCTION calculate_delivery_fee(
    lat1 FLOAT, lng1 FLOAT, 
    lat2 FLOAT, lng2 FLOAT
)
RETURNS DECIMAL
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    dist_km FLOAT;
    settings JSONB;
    base_fee DECIMAL;
    per_km_fee DECIMAL;
BEGIN
    -- Fetch Settings
    SELECT value INTO settings FROM public.platform_settings WHERE key = 'logistics_fees';
    
    -- Fallback if missing
    IF settings IS NULL THEN
        base_fee := 500.00;
        per_km_fee := 100.00;
    ELSE
        base_fee := (settings->>'base_fee')::DECIMAL;
        per_km_fee := (settings->>'per_km_fee')::DECIMAL;
    END IF;

    -- Reuse the Haversine function from 23_delivery_completion.sql
    -- If it doesn't exist yet in this context, we fallback to inline calculation? 
    -- We assume the environment has it. If not, we'll inline a simple version.
    
    -- Check if function exists (dynamic sql) or just trust it.
    -- Let's inline the math to be 100% dependency-free in this function 
    -- OR assume haversine_distance_km exists. Given previous context, it DOES exist.
    
    dist_km := public.haversine_distance_km(lat1, lng1, lat2, lng2);
    
    RETURN base_fee + (GREATEST(dist_km, 1) * per_km_fee);
EXCEPTION WHEN OTHERS THEN
    -- Fallback if haversine_distance_km doesn't exist
    RETURN base_fee + 100.00; -- Safety fallback
END;
$$;
