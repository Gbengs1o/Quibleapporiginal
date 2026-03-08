-- Ensure every rider always has a rider wallet and delivery completion never fails for missing wallet.

CREATE OR REPLACE FUNCTION public.ensure_rider_wallet(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet_id uuid;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT id
    INTO v_wallet_id
    FROM public.wallets
    WHERE user_id = p_user_id
      AND type = 'rider'
    LIMIT 1;

    IF v_wallet_id IS NULL THEN
        INSERT INTO public.wallets (user_id, type, balance)
        VALUES (p_user_id, 'rider', 0)
        ON CONFLICT (user_id, type) DO UPDATE
            SET updated_at = now()
        RETURNING id INTO v_wallet_id;
    END IF;

    RETURN v_wallet_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.create_rider_wallet_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.ensure_rider_wallet(NEW.user_id);
    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS on_rider_created ON public.riders;
DROP TRIGGER IF EXISTS tr_create_rider_wallet_after_insert ON public.riders;
CREATE TRIGGER tr_create_rider_wallet_after_insert
AFTER INSERT ON public.riders
FOR EACH ROW
EXECUTE FUNCTION public.create_rider_wallet_on_insert();


-- Backfill rider wallets for any existing riders who were created before this trigger existed.
INSERT INTO public.wallets (user_id, type, balance)
SELECT r.user_id, 'rider', 0
FROM public.riders r
LEFT JOIN public.wallets w
    ON w.user_id = r.user_id
   AND w.type = 'rider'
WHERE w.id IS NULL
ON CONFLICT (user_id, type) DO NOTHING;


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
    v_distance_km float;
    v_threshold_km float := 0.5;
    v_reference text;
    v_tx_id uuid;
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

    IF p_lat IS NULL OR p_lng IS NULL OR v_order.dropoff_latitude IS NULL OR v_order.dropoff_longitude IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Location data required for verification');
    END IF;

    v_distance_km := 6371 * acos(
        least(
            1.0,
            greatest(
                -1.0,
                cos(radians(p_lat)) * cos(radians(v_order.dropoff_latitude)) *
                cos(radians(v_order.dropoff_longitude) - radians(p_lng)) +
                sin(radians(p_lat)) * sin(radians(v_order.dropoff_latitude))
            )
        )
    );

    IF v_distance_km > v_threshold_km THEN
        RETURN jsonb_build_object(
            'success',
            false,
            'message',
            'You are too far from the delivery location (' || round(v_distance_km::numeric, 2) || 'km)'
        );
    END IF;

    -- Auto-heal: if rider wallet is missing for any reason, create it on demand.
    SELECT public.ensure_rider_wallet(auth.uid()) INTO v_rider_wallet_id;
    IF v_rider_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Could not initialize rider wallet');
    END IF;

    IF COALESCE(v_order.delivery_fee, 0) > 0 THEN
        v_reference := 'rider_credit_' || p_order_id::text;

        INSERT INTO public.transactions (wallet_id, amount, type, description, reference)
        VALUES (
            v_rider_wallet_id,
            v_order.delivery_fee,
            'credit',
            'Earnings for Food Order #' || substring(p_order_id::text, 1, 8),
            v_reference
        )
        ON CONFLICT (reference) DO NOTHING
        RETURNING id INTO v_tx_id;

        IF v_tx_id IS NOT NULL THEN
            UPDATE public.wallets
            SET balance = balance + v_order.delivery_fee,
                updated_at = now()
            WHERE id = v_rider_wallet_id;
        END IF;
    END IF;

    UPDATE public.orders
    SET status = 'delivered',
        updated_at = now()
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Delivery completed and payment released');
END;
$$;
