-- Ensure all legacy overloaded checkout RPCs route through the fixed implementations
-- that generate unique transaction references.

CREATE OR REPLACE FUNCTION public.place_order(
    p_restaurant_id UUID,
    p_total_amount DECIMAL,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.place_order(
        p_restaurant_id => p_restaurant_id,
        p_total_amount => p_total_amount,
        p_items => p_items,
        p_pickup_lat => NULL,
        p_pickup_lng => NULL,
        p_dropoff_lat => NULL,
        p_dropoff_lng => NULL,
        p_delivery_fee => 0
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.place_order(
    p_restaurant_id UUID,
    p_total_amount DECIMAL,
    p_items JSONB,
    p_pickup_lat DOUBLE PRECISION DEFAULT NULL,
    p_pickup_lng DOUBLE PRECISION DEFAULT NULL,
    p_dropoff_lat DOUBLE PRECISION DEFAULT NULL,
    p_dropoff_lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.place_order(
        p_restaurant_id => p_restaurant_id,
        p_total_amount => p_total_amount,
        p_items => p_items,
        p_pickup_lat => p_pickup_lat,
        p_pickup_lng => p_pickup_lng,
        p_dropoff_lat => p_dropoff_lat,
        p_dropoff_lng => p_dropoff_lng,
        p_delivery_fee => 0
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.place_store_order(
    p_store_id UUID,
    p_total_amount DECIMAL,
    p_items JSONB,
    p_pickup_lat DOUBLE PRECISION DEFAULT NULL,
    p_pickup_lng DOUBLE PRECISION DEFAULT NULL,
    p_dropoff_lat DOUBLE PRECISION DEFAULT NULL,
    p_dropoff_lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.place_store_order(
        p_store_id => p_store_id,
        p_total_amount => p_total_amount,
        p_items => p_items,
        p_pickup_lat => p_pickup_lat,
        p_pickup_lng => p_pickup_lng,
        p_dropoff_lat => p_dropoff_lat,
        p_dropoff_lng => p_dropoff_lng,
        p_delivery_fee => 0
    );
END;
$$;
