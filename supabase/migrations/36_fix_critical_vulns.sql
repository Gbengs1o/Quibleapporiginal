-- FIX CRITICAL VULNERABILITIES: Price Spoofing & Race Conditions

-- 1. Fix `place_order`
-- Changes:
--   a) RECALCULATE total amount from DB prices (Fixes Price Spoofing)
--   b) Use ATOMIC UPDATE for wallet deduction (Fixes Double Spend Race Condition)

CREATE OR REPLACE FUNCTION place_order(
    p_restaurant_id UUID,
    p_total_amount DECIMAL, -- Kept for frontend compatibility, but IGNORED for deduction
    p_items JSONB -- Array of { menu_item_id, quantity, options } (price ignored)
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
    
    -- Calculated values
    v_calculated_total DECIMAL := 0;
    v_item_price DECIMAL;
    v_item_total DECIMAL;
    v_item_quantity INTEGER;
    v_menu_item_id UUID;
    
    platform_fee DECIMAL;
    restaurant_share DECIMAL;
    new_order_id UUID;
    item JSONB;
BEGIN
    -- 1. Calculate Real Total (Server-Side Validation)
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_menu_item_id := (item->>'menu_item_id')::UUID;
        v_item_quantity := (item->>'quantity')::INTEGER;
        
        -- Fetch true price
        SELECT price INTO v_item_price FROM public.menu_items WHERE id = v_menu_item_id;
        
        IF v_item_price IS NULL THEN
            RAISE EXCEPTION 'Menu item not found: %', v_menu_item_id;
        END IF;
        
        v_item_total := v_item_price * v_item_quantity;
        v_calculated_total := v_calculated_total + v_item_total;
    END LOOP;
    
    -- Optional: Check if p_total_amount matches (within small margin for float errors)
    -- IF ABS(v_calculated_total - p_total_amount) > 0.5 THEN
    --    RETURN jsonb_build_object('success', false, 'message', 'Price mismatch. Please refresh menu.');
    -- END IF;

    -- 2. Validate User Funds & Get Wallet
    SELECT id INTO user_wallet_id
    FROM public.wallets
    WHERE user_id = auth.uid() AND type = 'personal';

    IF user_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Personal wallet not found';
    END IF;

    -- 3. Atomic Deduction (Race Condition Fix)
    UPDATE public.wallets 
    SET balance = balance - v_calculated_total, updated_at = now() 
    WHERE id = user_wallet_id AND balance >= v_calculated_total;
    
    IF NOT FOUND THEN
         RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- 4. Validate Restaurant
    SELECT owner_id INTO restaurant_owner_id
    FROM public.restaurants
    WHERE id = p_restaurant_id;

    IF restaurant_owner_id IS NULL THEN
        -- Rollback wallet deduction!
        UPDATE public.wallets SET balance = balance + v_calculated_total WHERE id = user_wallet_id;
        RAISE EXCEPTION 'Restaurant not found';
    END IF;

    -- Get Restaurant Wallet
    SELECT id INTO restaurant_wallet_id
    FROM public.wallets
    WHERE restaurant_id = p_restaurant_id AND type = 'business';

    IF restaurant_wallet_id IS NULL THEN
        INSERT INTO public.wallets (restaurant_id, type, balance) 
        VALUES (p_restaurant_id, 'business', 0)
        RETURNING id INTO restaurant_wallet_id;
    END IF;

    -- 5. Calculate Fees & Process Crediting
    platform_fee := v_calculated_total * 0.10;
    restaurant_share := v_calculated_total - platform_fee;

    SELECT id INTO admin_wallet_id FROM public.wallets WHERE type = 'admin' LIMIT 1;
    
    -- Credit Restaurant
    UPDATE public.wallets 
    SET balance = balance + restaurant_share, updated_at = now() 
    WHERE id = restaurant_wallet_id;

    -- Credit Admin
    IF admin_wallet_id IS NOT NULL THEN
        UPDATE public.wallets 
        SET balance = balance + platform_fee, updated_at = now() 
        WHERE id = admin_wallet_id;
    END IF;

    -- Record Transactions
    INSERT INTO public.transactions (wallet_id, amount, type, description, location)
    VALUES (user_wallet_id, v_calculated_total, 'debit', 'Order Payment to Restaurant', '{}'::jsonb);

    INSERT INTO public.transactions (wallet_id, amount, type, description, location)
    VALUES (restaurant_wallet_id, restaurant_share, 'credit', 'Payment for Order', '{}'::jsonb);
    
    IF admin_wallet_id IS NOT NULL THEN
        INSERT INTO public.transactions (wallet_id, amount, type, description, location)
        VALUES (admin_wallet_id, platform_fee, 'credit', 'Platform Fee from Order', '{}'::jsonb);
    END IF;

    -- 6. Create Order
    INSERT INTO public.orders (user_id, restaurant_id, status, total_amount)
    VALUES (auth.uid(), p_restaurant_id, 'received', v_calculated_total)
    RETURNING id INTO new_order_id;

    -- 7. Create Order Items (Using validated prices)
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_menu_item_id := (item->>'menu_item_id')::UUID;
        
        -- We fetch price again or could have cached it. For safety, simplified logic here assumes consistent price.
        SELECT price INTO v_item_price FROM public.menu_items WHERE id = v_menu_item_id;

        INSERT INTO public.order_items (order_id, menu_item_id, quantity, price_at_time, options)
        VALUES (
            new_order_id, 
            v_menu_item_id,
            (item->>'quantity')::INTEGER, 
            v_item_price, -- Use server price!
            (item->>'options')::TEXT
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'message', 'Order placed successfully', 'order_id', new_order_id);

EXCEPTION WHEN OTHERS THEN
    -- Best effort rollback if we crashed after deducting money but before finishing
    -- Note: Postgres handles atomic transaction rollback for unhandled exceptions automatically.
    -- However, because we caught exception to return JSON, we MUST re-raise or handle rollback manually if we committed anything (which we haven't, all one tx).
    RAISE; 
END;
$$;


-- 2. Fix `complete_delivery_job_v2`
-- Changes:
--   a) Add `FOR UPDATE` locking to prevent Double Payment Race Condition

CREATE OR REPLACE FUNCTION public.complete_delivery_job_v2(
    p_request_id UUID,
    p_lat FLOAT DEFAULT NULL,
    p_lng FLOAT DEFAULT NULL
) 
RETURNS JSONB AS $$
DECLARE
    v_req RECORD;
    v_rider_wallet_id UUID;
    v_dist_km FLOAT;
    v_is_user BOOLEAN;
    v_is_rider BOOLEAN;
BEGIN
    -- 1. Fetch Request WITH LOCK (Fixes Race Condition)
    SELECT * INTO v_req FROM public.delivery_requests WHERE id = p_request_id FOR UPDATE;
    
    IF v_req IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Request not found');
    END IF;

    IF v_req.status = 'delivered' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Already delivered');
    END IF;

    -- 2. Identify Caller
    v_is_user := (v_req.user_id = auth.uid());
    
    -- Check if caller is the assigned rider
    SELECT EXISTS (
        SELECT 1 FROM public.riders WHERE user_id = auth.uid() AND user_id = v_req.rider_id
    ) INTO v_is_rider;

    IF NOT v_is_user AND NOT v_is_rider THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;

    -- 3. Geofence Check (ONLY For Rider)
    IF v_is_rider THEN
        IF p_lat IS NULL OR p_lng IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'Location required for rider completion');
        END IF;

        -- Check distance to dropoff
        v_dist_km := public.haversine_distance_km(p_lat, p_lng, v_req.dropoff_latitude, v_req.dropoff_longitude);
        
        -- Threshold: 0.2km (200 meters)
        IF v_dist_km > 0.2 THEN
            RETURN jsonb_build_object(
                'success', false, 
                'message', 'You are too far from the destination (' || round(v_dist_km::numeric, 2) || 'km away). Please get closer or ask the user to confirm.'
            );
        END IF;
    END IF;

    -- 4. Process Payment
    SELECT id INTO v_rider_wallet_id FROM public.wallets WHERE rider_id = (SELECT id FROM public.riders WHERE user_id = v_req.rider_id);

    IF v_rider_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Rider wallet not found');
    END IF;

    -- Credit Rider (Atomic update just to be safe, though lock prevents conflict)
    UPDATE public.wallets
    SET balance = balance + COALESCE(v_req.final_price, v_req.offered_price), updated_at = now()
    WHERE id = v_rider_wallet_id;

    -- Record Transaction
    INSERT INTO public.transactions (wallet_id, type, amount, description, reference_id, status)
    VALUES (
        v_rider_wallet_id,
        'credit',
        COALESCE(v_req.final_price, v_req.offered_price),
        'Earnings for Delivery',
        p_request_id::text,
        'completed'
    );

    -- 5. Update Status
    UPDATE public.delivery_requests
    SET status = 'delivered', updated_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'message', 'Delivery completed and funds released.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
