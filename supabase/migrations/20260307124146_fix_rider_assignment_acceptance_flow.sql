-- Fix rider assignment/acceptance reliability across restaurant/store orders.
-- 1) Harden invite and acceptance RPCs
-- 2) Prevent stale/invalid invite resurrection
-- 3) Use valid transactions schema and idempotent delivery-fee debit reference

CREATE OR REPLACE FUNCTION public.invite_rider(p_order_id uuid, p_rider_id uuid, p_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bid_id UUID;
    v_existing RECORD;
    v_order RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Authentication required');
    END IF;

    SELECT
        o.id,
        o.status::text AS order_status,
        o.rider_id,
        COALESCE(r.owner_id, s.owner_id) AS owner_id
    INTO v_order
    FROM public.orders o
    LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
    LEFT JOIN public.stores s ON s.id = o.store_id
    WHERE o.id = p_order_id;

    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    IF v_order.owner_id IS DISTINCT FROM auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;

    IF v_order.order_status IN ('cancelled', 'delivered') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order is closed');
    END IF;

    IF v_order.rider_id IS NOT NULL THEN
        IF v_order.rider_id = p_rider_id THEN
            RETURN jsonb_build_object('success', true, 'message', 'Rider already assigned');
        END IF;
        RETURN jsonb_build_object('success', false, 'message', 'Order already assigned to another rider');
    END IF;

    IF p_amount IS NULL OR p_amount < 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid delivery fee');
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.riders
        WHERE user_id = p_rider_id
          AND status = 'active'
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Rider not found or inactive');
    END IF;

    SELECT id, status, expired_at
    INTO v_existing
    FROM public.order_rider_bids
    WHERE order_id = p_order_id
      AND rider_id = p_rider_id
    LIMIT 1
    FOR UPDATE;

    IF v_existing.id IS NOT NULL THEN
        IF v_existing.status = 'accepted' THEN
            RETURN jsonb_build_object('success', false, 'message', 'Rider already accepted this order');
        END IF;

        IF v_existing.status = 'invited' AND (v_existing.expired_at IS NULL OR v_existing.expired_at > now()) THEN
            RETURN jsonb_build_object('success', false, 'message', 'Rider already has an active invite');
        END IF;

        -- For pending/rejected/expired/timed-out invited: re-invite by updating existing row.
        UPDATE public.order_rider_bids
        SET status = 'invited',
            amount = p_amount,
            expired_at = now() + interval '90 seconds',
            updated_at = now()
        WHERE id = v_existing.id
        RETURNING id INTO v_bid_id;

        RETURN jsonb_build_object('success', true, 'bid_id', v_bid_id);
    END IF;

    -- No existing row - insert fresh invite.
    INSERT INTO public.order_rider_bids (order_id, rider_id, amount, status, expired_at)
    VALUES (p_order_id, p_rider_id, p_amount, 'invited', now() + interval '90 seconds')
    RETURNING id INTO v_bid_id;

    RETURN jsonb_build_object('success', true, 'bid_id', v_bid_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;


CREATE OR REPLACE FUNCTION public.rider_respond_to_invite(p_order_id uuid, p_rider_id uuid, p_response text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_record RECORD;
    v_bid_record RECORD;
    v_wallet_id UUID;
    v_current_balance NUMERIC;
    v_fee NUMERIC;
    v_is_store BOOLEAN;
    v_reference TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Authentication required');
    END IF;

    IF auth.uid() <> p_rider_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;

    IF p_response NOT IN ('accepted', 'rejected') THEN
         RETURN jsonb_build_object('success', false, 'message', 'Invalid response type');
    END IF;

    SELECT *
    INTO v_bid_record
    FROM public.order_rider_bids
    WHERE order_id = p_order_id
      AND rider_id = p_rider_id
      AND status = 'invited'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_bid_record IS NULL THEN
        IF EXISTS (
            SELECT 1
            FROM public.order_rider_bids
            WHERE order_id = p_order_id
              AND rider_id = p_rider_id
              AND status = 'accepted'
        ) THEN
            RETURN jsonb_build_object('success', true, 'message', 'Order already assigned to you');
        END IF;

        IF EXISTS (
            SELECT 1
            FROM public.order_rider_bids
            WHERE order_id = p_order_id
              AND rider_id = p_rider_id
              AND status = 'expired'
        ) THEN
            RETURN jsonb_build_object('success', false, 'message', 'This request has expired because you did not respond in time.');
        END IF;

        RETURN jsonb_build_object('success', false, 'message', 'Invite not found or already processed');
    END IF;

    IF v_bid_record.expired_at IS NOT NULL AND v_bid_record.expired_at <= now() THEN
        UPDATE public.order_rider_bids
        SET status = 'expired', updated_at = now()
        WHERE id = v_bid_record.id;

        RETURN jsonb_build_object('success', false, 'message', 'This request has expired because you did not respond in time.');
    END IF;

    IF p_response = 'rejected' THEN
        UPDATE public.order_rider_bids
        SET status = 'rejected', updated_at = now()
        WHERE id = v_bid_record.id;

        RETURN jsonb_build_object('success', true, 'message', 'Invite rejected');
    END IF;

    SELECT o.*, (o.store_id IS NOT NULL) AS is_store
    INTO v_order_record
    FROM public.orders o
    WHERE o.id = p_order_id
    FOR UPDATE;

    IF v_order_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    IF v_order_record.status::text IN ('cancelled', 'delivered') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order is closed');
    END IF;

    IF v_order_record.rider_id IS NOT NULL THEN
        IF v_order_record.rider_id = p_rider_id THEN
            UPDATE public.order_rider_bids
            SET status = 'accepted', updated_at = now()
            WHERE id = v_bid_record.id;

            RETURN jsonb_build_object('success', true, 'message', 'Order already assigned to you');
        END IF;

        RETURN jsonb_build_object('success', false, 'message', 'Order already assigned to another rider');
    END IF;

    v_is_store := v_order_record.is_store;
    v_fee := COALESCE(v_bid_record.amount, 0);
    v_reference := p_order_id::text || ':delivery-fee-debit';

    IF v_fee > 0 AND NOT EXISTS (
        SELECT 1 FROM public.transactions WHERE reference = v_reference
    ) THEN
        IF v_is_store THEN
            SELECT id, balance
            INTO v_wallet_id, v_current_balance
            FROM public.wallets
            WHERE store_id = v_order_record.store_id
              AND type = 'business'
            FOR UPDATE;
        ELSE
            SELECT id, balance
            INTO v_wallet_id, v_current_balance
            FROM public.wallets
            WHERE restaurant_id = v_order_record.restaurant_id
              AND type = 'business'
            FOR UPDATE;
        END IF;

        IF v_wallet_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message',
                CASE WHEN v_is_store THEN 'Store wallet not found' ELSE 'Restaurant wallet not found' END);
        END IF;

        IF v_current_balance < v_fee THEN
            RETURN jsonb_build_object('success', false, 'message',
                CASE WHEN v_is_store THEN 'Insufficient store balance' ELSE 'Insufficient restaurant balance' END);
        END IF;

        UPDATE public.wallets
        SET balance = balance - v_fee, updated_at = now()
        WHERE id = v_wallet_id;

        INSERT INTO public.transactions (wallet_id, amount, type, description, reference)
        VALUES (
            v_wallet_id,
            -v_fee,
            'debit',
            'Delivery fee for order ' || p_order_id::text,
            v_reference
        );
    END IF;

    UPDATE public.orders
    SET rider_id = p_rider_id,
        delivery_fee = v_fee,
        updated_at = now()
    WHERE id = p_order_id;

    UPDATE public.order_rider_bids
    SET status = 'accepted', updated_at = now()
    WHERE id = v_bid_record.id;

    UPDATE public.order_rider_bids
    SET status = 'rejected', updated_at = now()
    WHERE order_id = p_order_id
      AND id != v_bid_record.id
      AND status IN ('invited', 'pending');

    RETURN jsonb_build_object('success', true, 'message', 'Invite accepted and rider assigned');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;


CREATE OR REPLACE FUNCTION public.accept_rider_bid(p_order_id uuid, p_rider_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_record RECORD;
    v_bid_record RECORD;
    v_wallet_id UUID;
    v_delivery_fee DECIMAL := 0;
    v_reference TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Authentication required');
    END IF;

    SELECT o.id,
           o.rider_id,
           o.restaurant_id,
           o.store_id,
           o.status::text AS order_status,
           COALESCE(r.owner_id, s.owner_id) AS owner_id,
           (o.store_id IS NOT NULL) AS is_store
    INTO v_order_record
    FROM public.orders o
    LEFT JOIN public.restaurants r ON o.restaurant_id = r.id
    LEFT JOIN public.stores s ON o.store_id = s.id
    WHERE o.id = p_order_id
    FOR UPDATE;

    IF v_order_record.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    IF v_order_record.owner_id IS DISTINCT FROM auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;

    IF v_order_record.order_status IN ('cancelled', 'delivered') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order is closed');
    END IF;

    IF v_order_record.rider_id IS NOT NULL THEN
        IF v_order_record.rider_id = p_rider_id THEN
            RETURN jsonb_build_object('success', true, 'message', 'Rider already assigned');
        END IF;
        RETURN jsonb_build_object('success', false, 'message', 'Rider already assigned to another rider');
    END IF;

    SELECT *
    INTO v_bid_record
    FROM public.order_rider_bids
    WHERE order_id = p_order_id
      AND rider_id = p_rider_id
      AND status IN ('pending', 'invited')
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_bid_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bid/invite not found or no longer actionable');
    END IF;

    IF v_bid_record.status = 'invited'
       AND v_bid_record.expired_at IS NOT NULL
       AND v_bid_record.expired_at <= now() THEN
        UPDATE public.order_rider_bids
        SET status = 'expired', updated_at = now()
        WHERE id = v_bid_record.id;

        RETURN jsonb_build_object('success', false, 'message', 'Invite has expired');
    END IF;

    v_delivery_fee := COALESCE(v_bid_record.amount, 0);
    v_reference := p_order_id::text || ':delivery-fee-debit';

    IF v_delivery_fee > 0 AND NOT EXISTS (
        SELECT 1 FROM public.transactions WHERE reference = v_reference
    ) THEN
        IF v_order_record.is_store THEN
            SELECT id
            INTO v_wallet_id
            FROM public.wallets
            WHERE store_id = v_order_record.store_id
              AND type = 'business'
            FOR UPDATE;
        ELSE
            SELECT id
            INTO v_wallet_id
            FROM public.wallets
            WHERE restaurant_id = v_order_record.restaurant_id
              AND type = 'business'
            FOR UPDATE;
        END IF;

        IF v_wallet_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message',
                CASE WHEN v_order_record.is_store THEN 'Store wallet not found' ELSE 'Restaurant wallet not found' END);
        END IF;

        UPDATE public.wallets
        SET balance = balance - v_delivery_fee,
            updated_at = now()
        WHERE id = v_wallet_id
          AND balance >= v_delivery_fee;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'message',
                CASE WHEN v_order_record.is_store THEN 'Insufficient store balance' ELSE 'Insufficient restaurant balance' END);
        END IF;

        INSERT INTO public.transactions (wallet_id, amount, type, description, reference)
        VALUES (
            v_wallet_id,
            -v_delivery_fee,
            'debit',
            'Delivery fee for order ' || p_order_id::text,
            v_reference
        );
    END IF;

    UPDATE public.orders
    SET rider_id = p_rider_id,
        delivery_fee = v_delivery_fee,
        updated_at = now()
    WHERE id = p_order_id;

    UPDATE public.order_rider_bids
    SET status = 'accepted', updated_at = now()
    WHERE id = v_bid_record.id;

    UPDATE public.order_rider_bids
    SET status = 'rejected', updated_at = now()
    WHERE order_id = p_order_id
      AND id != v_bid_record.id
      AND status IN ('pending', 'invited');

    RETURN jsonb_build_object('success', true, 'message', 'Rider assigned successfully');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;


CREATE OR REPLACE FUNCTION public.get_rider_order_invites(p_rider_id uuid)
RETURNS TABLE(
    bid_id uuid,
    order_id uuid,
    amount numeric,
    bid_status text,
    created_at timestamp with time zone,
    expired_at timestamp with time zone,
    order_total numeric,
    order_status text,
    restaurant_name text,
    restaurant_address text,
    restaurant_logo_url text,
    store_name text,
    store_address text,
    store_logo_url text,
    order_source text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id AS bid_id,
        b.order_id,
        b.amount,
        CASE
            WHEN b.status = 'invited' AND b.expired_at IS NOT NULL AND b.expired_at <= now() THEN 'expired'
            ELSE b.status
        END AS bid_status,
        b.created_at,
        b.expired_at,
        o.total_amount AS order_total,
        o.status::text AS order_status,
        r.name AS restaurant_name,
        r.address AS restaurant_address,
        r.logo_url AS restaurant_logo_url,
        s.name AS store_name,
        s.address AS store_address,
        s.logo_url AS store_logo_url,
        CASE WHEN o.store_id IS NOT NULL THEN 'store' ELSE 'restaurant' END AS order_source
    FROM public.order_rider_bids b
    JOIN public.orders o ON o.id = b.order_id
    LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
    LEFT JOIN public.stores s ON s.id = o.store_id
    WHERE b.rider_id = p_rider_id
      AND b.status IN ('invited', 'expired')
      AND o.rider_id IS NULL
      AND o.status NOT IN ('cancelled', 'delivered')
    ORDER BY b.created_at DESC;
END;
$$;


CREATE OR REPLACE FUNCTION public.get_rider_food_invites(p_rider_id uuid)
RETURNS TABLE(
    bid_id uuid,
    order_id uuid,
    amount numeric,
    bid_status text,
    created_at timestamp with time zone,
    expired_at timestamp with time zone,
    order_total numeric,
    order_status text,
    restaurant_name text,
    restaurant_address text,
    restaurant_logo_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id AS bid_id,
        b.order_id,
        b.amount,
        CASE
            WHEN b.status = 'invited' AND b.expired_at IS NOT NULL AND b.expired_at <= now() THEN 'expired'
            ELSE b.status
        END AS bid_status,
        b.created_at,
        b.expired_at,
        o.total_amount AS order_total,
        o.status::text AS order_status,
        COALESCE(r.name, s.name) AS restaurant_name,
        COALESCE(r.address, s.address) AS restaurant_address,
        COALESCE(r.logo_url, s.logo_url) AS restaurant_logo_url
    FROM public.order_rider_bids b
    JOIN public.orders o ON o.id = b.order_id
    LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
    LEFT JOIN public.stores s ON s.id = o.store_id
    WHERE b.rider_id = p_rider_id
      AND b.status IN ('invited', 'expired')
      AND o.rider_id IS NULL
      AND o.status NOT IN ('cancelled', 'delivered')
    ORDER BY b.created_at DESC;
END;
$$;
