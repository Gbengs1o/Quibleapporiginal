-- Fix accept_rider_bid FOR UPDATE error caused by outer-join row locking.

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
    v_owner_id UUID;
    v_is_store BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Authentication required');
    END IF;

    SELECT id, rider_id, restaurant_id, store_id, status::text AS order_status
    INTO v_order_record
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_order_record.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    v_is_store := v_order_record.store_id IS NOT NULL;

    IF v_is_store THEN
        SELECT owner_id INTO v_owner_id FROM public.stores WHERE id = v_order_record.store_id;
    ELSE
        SELECT owner_id INTO v_owner_id FROM public.restaurants WHERE id = v_order_record.restaurant_id;
    END IF;

    IF v_owner_id IS DISTINCT FROM auth.uid() THEN
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
        IF v_is_store THEN
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
                CASE WHEN v_is_store THEN 'Store wallet not found' ELSE 'Restaurant wallet not found' END);
        END IF;

        UPDATE public.wallets
        SET balance = balance - v_delivery_fee,
            updated_at = now()
        WHERE id = v_wallet_id
          AND balance >= v_delivery_fee;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'message',
                CASE WHEN v_is_store THEN 'Insufficient store balance' ELSE 'Insufficient restaurant balance' END);
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
