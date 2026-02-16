-- 40_food_delivery_payment.sql
-- 1. Add location columns to orders for geofencing (Idempotent)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS pickup_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS pickup_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS dropoff_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS dropoff_longitude DOUBLE PRECISION;

-- 2. Update place_order to store coordinates AND Fix Security Vulnerabilities
-- (Replaces vulnerable version from previous migration 40 attempt)
CREATE OR REPLACE FUNCTION place_order(
    p_restaurant_id UUID,
    p_total_amount DECIMAL, -- DEPRECATED: Ignored for calculation, kept for signature compatibility
    p_items JSONB,
    p_pickup_lat DOUBLE PRECISION DEFAULT NULL,
    p_pickup_lng DOUBLE PRECISION DEFAULT NULL,
    p_dropoff_lat DOUBLE PRECISION DEFAULT NULL,
    p_dropoff_lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_wallet_id UUID;
    restaurant_owner_id UUID;
    restaurant_wallet_id UUID;
    admin_wallet_id UUID;
    
    v_calculated_total DECIMAL := 0;
    v_item_price DECIMAL;
    v_menu_item_id UUID;
    v_quantity INTEGER;
    
    platform_fee DECIMAL;
    restaurant_share DECIMAL;
    new_order_id UUID;
    item JSONB;
BEGIN
    -- 1. SERVER-SIDE PRICE CALCULATION (Security Fix)
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_menu_item_id := (item->>'menu_item_id')::UUID;
        v_quantity := (item->>'quantity')::INTEGER;

        -- Fetch price from DB
        SELECT price INTO v_item_price FROM public.menu_items WHERE id = v_menu_item_id;
        
        IF v_item_price IS NULL THEN
            RAISE EXCEPTION 'Menu item % not found', v_menu_item_id;
        END IF;

        v_calculated_total := v_calculated_total + (v_item_price * v_quantity);
    END LOOP;

    -- 2. Validate User Funds & Get Wallet
    SELECT id INTO user_wallet_id
    FROM public.wallets
    WHERE user_id = auth.uid() AND type = 'personal';

    IF user_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Personal wallet not found';
    END IF;

    -- 3. Validate Restaurant (and ensure business wallet)
    SELECT owner_id INTO restaurant_owner_id
    FROM public.restaurants
    WHERE id = p_restaurant_id;

    IF restaurant_owner_id IS NULL THEN
        RAISE EXCEPTION 'Restaurant not found';
    END IF;

    SELECT id INTO restaurant_wallet_id
    FROM public.wallets
    WHERE restaurant_id = p_restaurant_id AND type = 'business';

    -- Auto-create if missing (safety net)
    IF restaurant_wallet_id IS NULL THEN
        INSERT INTO public.wallets (restaurant_id, type, balance) 
        VALUES (p_restaurant_id, 'business', 0)
        RETURNING id INTO restaurant_wallet_id;
    END IF;

    -- 4. ATOMIC DEDUCTION (Race Condition Fix)
    UPDATE public.wallets 
    SET balance = balance - v_calculated_total, updated_at = now() 
    WHERE id = user_wallet_id AND balance >= v_calculated_total;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- 5. Credit Others (Restaurant share & Admin fee)
    platform_fee := v_calculated_total * 0.10;
    restaurant_share := v_calculated_total - platform_fee;
    
    UPDATE public.wallets SET balance = balance + restaurant_share, updated_at = now() WHERE id = restaurant_wallet_id;
    
    SELECT id INTO admin_wallet_id FROM public.wallets WHERE type = 'admin' LIMIT 1;
    IF admin_wallet_id IS NOT NULL THEN
        UPDATE public.wallets SET balance = balance + platform_fee, updated_at = now() WHERE id = admin_wallet_id;
    END IF;

    -- Record Transactions
    INSERT INTO public.transactions (wallet_id, amount, type, description)
    VALUES (user_wallet_id, v_calculated_total, 'debit', 'Order Payment to Restaurant');
    INSERT INTO public.transactions (wallet_id, amount, type, description)
    VALUES (restaurant_wallet_id, restaurant_share, 'credit', 'Payment for Order');

    -- 6. Create Order
    INSERT INTO public.orders (
        user_id, 
        restaurant_id, 
        status, 
        total_amount, 
        pickup_latitude, 
        pickup_longitude, 
        dropoff_latitude, 
        dropoff_longitude
    )
    VALUES (
        auth.uid(), 
        p_restaurant_id, 
        'received', 
        v_calculated_total, -- USE CALCULATED TOTAL
        p_pickup_lat, 
        p_pickup_lng, 
        p_dropoff_lat, 
        p_dropoff_lng
    )
    RETURNING id INTO new_order_id;

    -- 7. Create Order Items
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (order_id, menu_item_id, quantity, price_at_time, options)
        VALUES (
            new_order_id, 
            (item->>'menu_item_id')::UUID, 
            (item->>'quantity')::INTEGER, 
            (SELECT price FROM public.menu_items WHERE id = (item->>'menu_item_id')::UUID), -- store actual price
            (item->>'options')::TEXT
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'message', 'Order placed successfully', 'order_id', new_order_id);
END;
$$;

-- 3. Create complete_food_delivery RPC (Fixed Security)
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
    v_threshold_km FLOAT := 0.5; -- 500 meters
BEGIN
    -- 1. Fetch Order and lock it
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_order IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    -- 2. Authorization & Status Check
    IF v_order.rider_id IS NULL OR v_order.rider_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized or rider not assigned');
    END IF;

    IF v_order.status != 'with_rider' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order is not in a deliverable state');
    END IF;

    -- 3. Verify Delivery Code (Mandatory)
    IF v_order.delivery_code IS NULL OR p_delivery_code IS NULL OR v_order.delivery_code != p_delivery_code THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid delivery code');
    END IF;

    -- 4. Geofence Check (Mandatory)
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

    -- 5. Credit Rider Wallet
    SELECT id INTO v_rider_wallet_id
    FROM public.wallets
    WHERE rider_id = (SELECT id FROM public.riders WHERE user_id = auth.uid()) 
    AND type = 'rider';

    IF v_rider_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Rider wallet not found');
    END IF;

    -- Credit if fee exists
    IF v_order.delivery_fee > 0 THEN
        UPDATE public.wallets 
        SET balance = balance + v_order.delivery_fee, updated_at = now()
        WHERE id = v_rider_wallet_id;

        INSERT INTO public.transactions (wallet_id, amount, type, description, reference_id, status)
        VALUES (
            v_rider_wallet_id, 
            v_order.delivery_fee, 
            'credit', 
            'Earnings for Food Order #' || substring(p_order_id::text, 1, 8),
            p_order_id::text,
            'completed'
        );
    END IF;

    -- 6. Update Order Status
    UPDATE public.orders 
    SET status = 'delivered', updated_at = now() 
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Delivery completed and payment released');
END;
$$;
