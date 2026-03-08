-- Fix checkout failures caused by unique index on transactions.reference.
-- Each order creates multiple transaction rows (user debit, vendor credit, admin credit),
-- so references must be unique per row even for the same order.

CREATE OR REPLACE FUNCTION public.place_order(
    p_restaurant_id UUID,
    p_total_amount DECIMAL, -- DEPRECATED: kept for signature compat
    p_items JSONB,
    p_pickup_lat DOUBLE PRECISION DEFAULT NULL,
    p_pickup_lng DOUBLE PRECISION DEFAULT NULL,
    p_dropoff_lat DOUBLE PRECISION DEFAULT NULL,
    p_dropoff_lng DOUBLE PRECISION DEFAULT NULL,
    p_delivery_fee DECIMAL DEFAULT 0
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

    v_platform_fee DECIMAL;
    v_restaurant_share DECIMAL;
    v_grand_total DECIMAL;
    v_ref_base TEXT;
    new_order_id UUID;
    item JSONB;
BEGIN
    -- 1. SERVER-SIDE PRICE CALCULATION (items only)
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_menu_item_id := (item->>'menu_item_id')::UUID;
        v_quantity := (item->>'quantity')::INTEGER;
        SELECT price INTO v_item_price FROM public.menu_items WHERE id = v_menu_item_id;
        IF v_item_price IS NULL THEN
            RAISE EXCEPTION 'Menu item % not found', v_menu_item_id;
        END IF;
        v_calculated_total := v_calculated_total + (v_item_price * v_quantity);
    END LOOP;

    -- 2. Calculate fees
    -- Platform takes 10% of ITEMS ONLY (not delivery fee)
    v_platform_fee := v_calculated_total * 0.10;
    -- Restaurant gets: items - platform fee + delivery fee (for their rider)
    v_restaurant_share := v_calculated_total - v_platform_fee + GREATEST(p_delivery_fee, 0);
    -- Customer pays: items + platform fee + delivery fee
    v_grand_total := v_calculated_total + v_platform_fee + GREATEST(p_delivery_fee, 0);

    -- 3. Get & validate user wallet
    SELECT id INTO user_wallet_id
    FROM public.wallets
    WHERE user_id = auth.uid() AND type = 'personal'
    FOR UPDATE;

    IF user_wallet_id IS NULL THEN
        INSERT INTO public.wallets (user_id, type, balance)
        VALUES (auth.uid(), 'personal', 0)
        RETURNING id INTO user_wallet_id;
    END IF;

    IF (SELECT balance FROM public.wallets WHERE id = user_wallet_id) < v_grand_total THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- 4. Validate restaurant & get wallet
    SELECT owner_id INTO restaurant_owner_id
    FROM public.restaurants WHERE id = p_restaurant_id;

    IF restaurant_owner_id IS NULL THEN
        RAISE EXCEPTION 'Restaurant not found';
    END IF;

    SELECT id INTO restaurant_wallet_id
    FROM public.wallets
    WHERE restaurant_id = p_restaurant_id AND type = 'business';

    IF restaurant_wallet_id IS NULL THEN
        INSERT INTO public.wallets (restaurant_id, type, balance)
        VALUES (p_restaurant_id, 'business', 0)
        RETURNING id INTO restaurant_wallet_id;
    END IF;

    -- 5. Atomic payment
    -- Debit user
    UPDATE public.wallets
    SET balance = balance - v_grand_total, updated_at = now()
    WHERE id = user_wallet_id;

    -- Credit restaurant (items share + delivery fee)
    UPDATE public.wallets
    SET balance = balance + v_restaurant_share, updated_at = now()
    WHERE id = restaurant_wallet_id;

    -- Credit admin (platform fee only)
    SELECT id INTO admin_wallet_id FROM public.wallets WHERE type = 'admin' LIMIT 1;
    IF admin_wallet_id IS NOT NULL THEN
        UPDATE public.wallets
        SET balance = balance + v_platform_fee, updated_at = now()
        WHERE id = admin_wallet_id;
    END IF;

    -- 6. Create order
    INSERT INTO public.orders (
        user_id, restaurant_id, status, total_amount, delivery_fee,
        pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude
    )
    VALUES (
        auth.uid(), p_restaurant_id, 'received', v_grand_total, GREATEST(p_delivery_fee, 0),
        p_pickup_lat, p_pickup_lng, p_dropoff_lat, p_dropoff_lng
    )
    RETURNING id INTO new_order_id;

    -- 7. Create order items
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (order_id, menu_item_id, quantity, price_at_time, options)
        VALUES (
            new_order_id,
            (item->>'menu_item_id')::UUID,
            (item->>'quantity')::INTEGER,
            (SELECT price FROM public.menu_items WHERE id = (item->>'menu_item_id')::UUID),
            (item->>'options')::TEXT
        );
    END LOOP;

    -- 8. Record transactions (unique references per ledger row)
    v_ref_base := new_order_id::text;

    INSERT INTO public.transactions (wallet_id, amount, type, description, reference)
    VALUES (user_wallet_id, v_grand_total, 'debit', 'Order Payment', v_ref_base || ':user-debit');

    INSERT INTO public.transactions (wallet_id, amount, type, description, reference)
    VALUES (restaurant_wallet_id, v_restaurant_share, 'credit', 'Order Earnings + Delivery Fee', v_ref_base || ':vendor-credit');

    IF admin_wallet_id IS NOT NULL THEN
        INSERT INTO public.transactions (wallet_id, amount, type, description, reference)
        VALUES (admin_wallet_id, v_platform_fee, 'credit', 'Platform Fee', v_ref_base || ':admin-credit');
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Order placed successfully', 'order_id', new_order_id);
END;
$$;


CREATE OR REPLACE FUNCTION public.place_store_order(
    p_store_id UUID,
    p_total_amount DECIMAL, -- DEPRECATED: kept for signature compat
    p_items JSONB,
    p_pickup_lat DOUBLE PRECISION DEFAULT NULL,
    p_pickup_lng DOUBLE PRECISION DEFAULT NULL,
    p_dropoff_lat DOUBLE PRECISION DEFAULT NULL,
    p_dropoff_lng DOUBLE PRECISION DEFAULT NULL,
    p_delivery_fee DECIMAL DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_order_id UUID;
    item_record JSONB;
    v_items_total DECIMAL := 0;
    v_item_price DECIMAL;
    v_user_wallet_id UUID;
    v_store_wallet_id UUID;
    v_service_fee DECIMAL;
    v_store_share DECIMAL;
    v_grand_total DECIMAL;
    v_ref_base TEXT;
    admin_wallet_id UUID;
BEGIN
    -- 1. Get user wallet
    SELECT id INTO v_user_wallet_id
    FROM public.wallets
    WHERE user_id = auth.uid() AND type = 'personal'
    FOR UPDATE;

    IF v_user_wallet_id IS NULL THEN
        INSERT INTO public.wallets (user_id, type, balance)
        VALUES (auth.uid(), 'personal', 0)
        RETURNING id INTO v_user_wallet_id;
    END IF;

    -- 2. Calculate items total (server-side)
    FOR item_record IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT price INTO v_item_price
        FROM public.store_items
        WHERE id = (item_record->>'store_item_id')::UUID;

        IF v_item_price IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'Item not found');
        END IF;

        v_items_total := v_items_total + (v_item_price * (item_record->>'quantity')::INT);
    END LOOP;

    -- 3. Calculate fees
    -- Platform takes 10% of ITEMS ONLY
    v_service_fee := v_items_total * 0.10;
    -- Store gets: items + delivery fee (for their rider)
    v_store_share := v_items_total + GREATEST(p_delivery_fee, 0);
    -- Customer pays: items + service fee + delivery fee
    v_grand_total := v_items_total + v_service_fee + GREATEST(p_delivery_fee, 0);

    -- 4. Check balance
    IF (SELECT balance FROM public.wallets WHERE id = v_user_wallet_id) < v_grand_total THEN
        RETURN jsonb_build_object('success', false, 'message',
            'Insufficient balance. Your current balance is ₦' ||
            (SELECT balance FROM public.wallets WHERE id = v_user_wallet_id));
    END IF;

    -- 5. Create order
    INSERT INTO public.orders (
        user_id, store_id, status, total_amount, delivery_fee,
        pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude
    )
    VALUES (
        auth.uid(), p_store_id, 'received', v_grand_total, GREATEST(p_delivery_fee, 0),
        p_pickup_lat, p_pickup_lng, p_dropoff_lat, p_dropoff_lng
    )
    RETURNING id INTO new_order_id;

    -- 6. Create order items
    FOR item_record IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (order_id, store_item_id, quantity, price_at_time)
        SELECT new_order_id, (item_record->>'store_item_id')::UUID, (item_record->>'quantity')::INT, price
        FROM public.store_items WHERE id = (item_record->>'store_item_id')::UUID;
    END LOOP;

    -- 7. Process payment
    -- Debit user
    UPDATE public.wallets
    SET balance = balance - v_grand_total, updated_at = NOW()
    WHERE id = v_user_wallet_id;

    -- Credit store (items + delivery fee)
    SELECT id INTO v_store_wallet_id
    FROM public.wallets WHERE store_id = p_store_id AND type = 'business';

    IF v_store_wallet_id IS NULL THEN
        INSERT INTO public.wallets (store_id, type, balance)
        VALUES (p_store_id, 'business', 0)
        RETURNING id INTO v_store_wallet_id;
    END IF;

    UPDATE public.wallets
    SET balance = balance + v_store_share, updated_at = NOW()
    WHERE id = v_store_wallet_id;

    -- Credit admin (service fee only)
    SELECT id INTO admin_wallet_id FROM public.wallets WHERE type = 'admin' LIMIT 1;
    IF admin_wallet_id IS NOT NULL THEN
        UPDATE public.wallets
        SET balance = balance + v_service_fee, updated_at = now()
        WHERE id = admin_wallet_id;
    END IF;

    -- 8. Record transactions (unique references per ledger row)
    v_ref_base := new_order_id::text;

    INSERT INTO public.transactions (wallet_id, amount, type, description, location, reference)
    VALUES (v_user_wallet_id, v_grand_total, 'debit',
        'Store Order #' || substring(new_order_id::text, 1, 8), '{}'::jsonb, v_ref_base || ':user-debit');

    INSERT INTO public.transactions (wallet_id, amount, type, description, location, reference)
    VALUES (v_store_wallet_id, v_store_share, 'credit',
        'Order Payout + Delivery Fee #' || substring(new_order_id::text, 1, 8), '{}'::jsonb, v_ref_base || ':vendor-credit');

    IF admin_wallet_id IS NOT NULL THEN
        INSERT INTO public.transactions (wallet_id, amount, type, description, location, reference)
        VALUES (admin_wallet_id, v_service_fee, 'credit',
            'Service Fee from Store Order', '{}'::jsonb, v_ref_base || ':admin-credit');
    END IF;

    RETURN jsonb_build_object('success', true, 'order_id', new_order_id, 'message', 'Order placed successfully');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
