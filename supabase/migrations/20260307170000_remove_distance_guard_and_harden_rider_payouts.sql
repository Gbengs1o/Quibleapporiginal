-- Remove geofence requirement for completion when code is valid.
-- Ensure rider payout posts reliably for both food/store orders and logistics requests.

CREATE OR REPLACE FUNCTION public.complete_food_delivery(
    p_order_id uuid,
    p_delivery_code text,
    p_lat double precision,
    p_lng double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_rider_wallet_id uuid;
    v_reference text;
    v_tx_id uuid;
    v_fee numeric := 0;
BEGIN
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_order IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    IF v_order.rider_id IS NULL OR v_order.rider_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized or rider not assigned');
    END IF;

    IF v_order.status NOT IN ('with_rider', 'out_for_delivery') THEN
        RETURN jsonb_build_object(
            'success',
            false,
            'message',
            'Order is not in a deliverable state (current: ' || v_order.status || ')'
        );
    END IF;

    IF v_order.delivery_code IS NULL OR p_delivery_code IS NULL OR v_order.delivery_code != p_delivery_code THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid delivery code');
    END IF;

    SELECT public.ensure_rider_wallet(auth.uid()) INTO v_rider_wallet_id;
    IF v_rider_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Could not initialize rider wallet');
    END IF;

    v_fee := COALESCE(v_order.delivery_fee, 0);
    IF v_fee <= 0 THEN
        SELECT COALESCE(b.amount, 0)
        INTO v_fee
        FROM public.order_rider_bids b
        WHERE b.order_id = p_order_id
          AND b.rider_id = auth.uid()
          AND b.status = 'accepted'
        ORDER BY b.updated_at DESC, b.created_at DESC
        LIMIT 1;
    END IF;

    IF v_fee > 0 THEN
        v_reference := 'rider_credit_order_' || p_order_id::text;

        INSERT INTO public.transactions (wallet_id, amount, type, description, reference)
        VALUES (
            v_rider_wallet_id,
            v_fee,
            'credit',
            'Earnings for Food/Store Order #' || substring(p_order_id::text, 1, 8),
            v_reference
        )
        ON CONFLICT (reference) DO NOTHING
        RETURNING id INTO v_tx_id;

        IF v_tx_id IS NOT NULL THEN
            UPDATE public.wallets
            SET balance = balance + v_fee,
                updated_at = now()
            WHERE id = v_rider_wallet_id;
        END IF;
    END IF;

    UPDATE public.orders
    SET status = 'delivered',
        delivery_fee = GREATEST(COALESCE(v_order.delivery_fee, 0), COALESCE(v_fee, 0)),
        updated_at = now()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Delivery completed and payment released',
        'paid_amount', COALESCE(v_fee, 0)
    );
END;
$$;


CREATE OR REPLACE FUNCTION public.complete_delivery_job_v2(
    p_request_id uuid,
    p_delivery_code text,
    p_lat double precision DEFAULT NULL,
    p_lng double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_req RECORD;
    v_rider_wallet_id uuid;
    v_reference text;
    v_tx_id uuid;
    v_fee numeric := 0;
BEGIN
    SELECT * INTO v_req
    FROM public.delivery_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF v_req IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Request not found');
    END IF;

    IF v_req.rider_id IS NULL OR v_req.rider_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;

    IF v_req.status NOT IN ('in_transit', 'picked_up') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not in transit');
    END IF;

    IF v_req.delivery_code IS NOT NULL AND (p_delivery_code IS NULL OR v_req.delivery_code != p_delivery_code) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid delivery code');
    END IF;

    SELECT public.ensure_rider_wallet(v_req.rider_id) INTO v_rider_wallet_id;
    IF v_rider_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Could not initialize rider wallet');
    END IF;

    v_fee := COALESCE(v_req.final_price, v_req.offered_price, 0);

    IF v_fee > 0 THEN
        v_reference := 'rider_credit_delivery_' || p_request_id::text;

        INSERT INTO public.transactions (wallet_id, amount, type, description, reference)
        VALUES (
            v_rider_wallet_id,
            v_fee,
            'credit',
            'Earnings for delivery request #' || substring(p_request_id::text, 1, 8),
            v_reference
        )
        ON CONFLICT (reference) DO NOTHING
        RETURNING id INTO v_tx_id;

        IF v_tx_id IS NOT NULL THEN
            UPDATE public.wallets
            SET balance = balance + v_fee,
                updated_at = now()
            WHERE id = v_rider_wallet_id;
        END IF;
    END IF;

    UPDATE public.delivery_requests
    SET status = 'delivered',
        final_price = COALESCE(v_req.final_price, v_fee),
        updated_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Delivery completed',
        'paid_amount', COALESCE(v_fee, 0)
    );
END;
$$;
