-- Logistics (package/ride) should not require secure delivery codes.
-- Keep food/store order code flow unchanged.

DROP TRIGGER IF EXISTS set_code_requests ON public.delivery_requests;

UPDATE public.delivery_requests
SET delivery_code = NULL
WHERE delivery_code IS NOT NULL
  AND status IN ('pending', 'accepted', 'picked_up');

CREATE OR REPLACE FUNCTION public.complete_delivery_job_v2(
    p_request_id uuid,
    p_delivery_code text,
    p_lat double precision DEFAULT NULL::double precision,
    p_lng double precision DEFAULT NULL::double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_req RECORD;
    v_rider_wallet_id uuid;
    v_reference text;
    v_tx_id uuid;
    v_fee numeric := 0;
    v_is_user boolean := false;
    v_is_rider boolean := false;
BEGIN
    SELECT *
    INTO v_req
    FROM public.delivery_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF v_req IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Request not found');
    END IF;

    v_is_user := (v_req.user_id = auth.uid());
    v_is_rider := (v_req.rider_id = auth.uid());

    IF NOT v_is_user AND NOT v_is_rider THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;

    IF v_req.status NOT IN ('accepted', 'picked_up') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Request is not ready for completion');
    END IF;

    IF v_req.rider_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No rider assigned to this request');
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
