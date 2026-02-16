CREATE OR REPLACE FUNCTION public.assign_rider_direct(p_order_id uuid, p_rider_id uuid, p_fee numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_order_record RECORD;
    v_restaurant_wallet_id UUID;
    v_current_balance NUMERIC;
BEGIN
    -- 1. Check if order exists
    SELECT * INTO v_order_record FROM public.orders WHERE id = p_order_id;
    
    IF v_order_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    -- 2. Check if restaurant has enough balance (if fee > 0)
    IF p_fee > 0 THEN
        SELECT id, balance INTO v_restaurant_wallet_id, v_current_balance
        FROM public.wallets
        WHERE restaurant_id = v_order_record.restaurant_id;

        IF v_restaurant_wallet_id IS NULL THEN
             RETURN jsonb_build_object('success', false, 'message', 'Restaurant wallet not found');
        END IF;

        IF v_current_balance < p_fee THEN
             RETURN jsonb_build_object('success', false, 'message', 'Insufficient wallet balance');
        END IF;

        -- Deduct fee
        UPDATE public.wallets
        SET balance = balance - p_fee,
            updated_at = now()
        WHERE id = v_restaurant_wallet_id;

        -- Record transaction
        INSERT INTO public.transactions (
            wallet_id,
            amount,
            type,
            description,
            reference, -- CORRECTED: Was reference_id
            created_at
        ) VALUES (
            v_restaurant_wallet_id,
            -p_fee,
            'debit',
            'Delivery fee for order ' || p_order_id,
            p_order_id::text,
            now()
        );
    END IF;

    -- 3. Assign rider
    UPDATE public.orders
    SET 
        rider_id = p_rider_id,
        delivery_fee = p_fee,
        updated_at = now()
    WHERE id = p_order_id;

    -- 4. Update Bids logic (if any existing bids)
    -- Accept the assigned rider's bid if it exists
    UPDATE public.order_rider_bids
    SET status = 'accepted', updated_at = now()
    WHERE order_id = p_order_id AND rider_id = p_rider_id;

    -- Reject all other bids
    UPDATE public.order_rider_bids
    SET status = 'rejected', updated_at = now()
    WHERE order_id = p_order_id AND rider_id != p_rider_id;

    RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$
