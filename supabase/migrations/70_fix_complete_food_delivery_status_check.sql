-- DEFINITIVE FIX for complete_food_delivery
-- Verified against actual table schemas:
--   transactions: id, wallet_id, amount, type, description, reference, created_at, location
--   wallets: id, user_id, restaurant_id, balance, type (personal/business/admin), created_at, updated_at
--   orders: id, user_id, restaurant_id, status, total_amount, delivery_fee, rider_id, 
--           delivery_code, pickup_code, dropoff_latitude, dropoff_longitude, etc.

CREATE OR REPLACE FUNCTION complete_food_delivery(
    p_order_id UUID,
    p_delivery_code TEXT,
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_rider_wallet_id UUID;
    v_distance_km FLOAT;
    v_threshold_km FLOAT := 0.5;
BEGIN
    -- 1. Fetch and lock order
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_order IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    -- 2. Auth check
    IF v_order.rider_id IS NULL OR v_order.rider_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized or rider not assigned');
    END IF;

    -- 3. Status check (both with_rider and out_for_delivery are valid)
    IF v_order.status NOT IN ('with_rider', 'out_for_delivery') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order is not in a deliverable state (current: ' || v_order.status || ')');
    END IF;

    -- 4. Delivery code verification
    IF v_order.delivery_code IS NULL OR p_delivery_code IS NULL OR v_order.delivery_code != p_delivery_code THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid delivery code');
    END IF;

    -- 5. Geofence check
    IF p_lat IS NULL OR p_lng IS NULL OR v_order.dropoff_latitude IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Location data required for verification');
    END IF;

    v_distance_km := 6371 * acos(
        least(1.0, greatest(-1.0, cos(radians(p_lat)) * cos(radians(v_order.dropoff_latitude)) * cos(radians(v_order.dropoff_longitude) - radians(p_lng)) + 
        sin(radians(p_lat)) * sin(radians(v_order.dropoff_latitude))))
    );
        
    IF v_distance_km > v_threshold_km THEN
        RETURN jsonb_build_object('success', false, 'message', 'You are too far from the delivery location (' || round(v_distance_km::numeric, 2) || 'km)');
    END IF;

    -- 6. Find rider wallet (wallets.user_id + type='personal')
    SELECT id INTO v_rider_wallet_id
    FROM public.wallets
    WHERE user_id = auth.uid()
    AND type = 'personal';

    IF v_rider_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Rider wallet not found');
    END IF;

    -- 7. Credit rider if delivery fee exists
    IF v_order.delivery_fee > 0 THEN
        UPDATE public.wallets 
        SET balance = balance + v_order.delivery_fee, updated_at = now()
        WHERE id = v_rider_wallet_id;

        -- transactions columns: wallet_id, amount, type, description, reference
        INSERT INTO public.transactions (wallet_id, amount, type, description, reference)
        VALUES (
            v_rider_wallet_id, 
            v_order.delivery_fee, 
            'credit', 
            'Earnings for Food Order #' || substring(p_order_id::text, 1, 8),
            p_order_id::text
        );
    END IF;

    -- 8. Mark order as delivered
    UPDATE public.orders 
    SET status = 'delivered', updated_at = now() 
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Delivery completed and payment released');
END;
$$;
