-- RPC to invite a rider (Restaurant actions)
CREATE OR REPLACE FUNCTION public.invite_rider(p_order_id uuid, p_rider_id uuid, p_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_bid_id UUID;
    v_existing_status TEXT;
BEGIN
    -- Check if already invited or pending
    SELECT status INTO v_existing_status FROM public.order_rider_bids 
    WHERE order_id = p_order_id AND rider_id = p_rider_id AND status IN ('pending', 'invited');

    IF v_existing_status IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Rider already invited or has pending bid');
    END IF;

    -- Insert invite
    INSERT INTO public.order_rider_bids (order_id, rider_id, amount, status)
    VALUES (p_order_id, p_rider_id, p_amount, 'invited')
    RETURNING id INTO v_bid_id;

    RETURN jsonb_build_object('success', true, 'bid_id', v_bid_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$;

-- RPC for Rider to resond (Accept/Reject)
CREATE OR REPLACE FUNCTION public.rider_respond_to_invite(p_order_id uuid, p_rider_id uuid, p_response text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_order_record RECORD;
    v_bid_record RECORD;
    v_restaurant_wallet_id UUID;
    v_current_balance NUMERIC;
    v_fee NUMERIC;
BEGIN
    -- Validate response type
    IF p_response NOT IN ('accepted', 'rejected') THEN
         RETURN jsonb_build_object('success', false, 'message', 'Invalid response type');
    END IF;

    -- Get the bid/invite
    SELECT * INTO v_bid_record FROM public.order_rider_bids 
    WHERE order_id = p_order_id AND rider_id = p_rider_id AND status = 'invited';

    IF v_bid_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invite not found or already processed');
    END IF;

    v_fee := v_bid_record.amount;

    -- Handle Rejection
    IF p_response = 'rejected' THEN
        UPDATE public.order_rider_bids 
        SET status = 'rejected', updated_at = now()
        WHERE id = v_bid_record.id;
        RETURN jsonb_build_object('success', true, 'message', 'Invite rejected');
    END IF;

    -- Handle Acceptance (Payment & Assignment Logic)
    
    -- 1. Check Order
    SELECT * INTO v_order_record FROM public.orders WHERE id = p_order_id;
    IF v_order_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;
    
    -- Check if order already has a rider
    IF v_order_record.rider_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order already assigned to another rider');
    END IF;

    -- 2. Check Wallet & Balance
    IF v_fee > 0 THEN
        SELECT id, balance INTO v_restaurant_wallet_id, v_current_balance
        FROM public.wallets
        WHERE restaurant_id = v_order_record.restaurant_id;

        IF v_restaurant_wallet_id IS NULL THEN
             RETURN jsonb_build_object('success', false, 'message', 'Restaurant wallet not found');
        END IF;

        IF v_current_balance < v_fee THEN
             RETURN jsonb_build_object('success', false, 'message', 'Insufficient restaurant balance');
        END IF;

        -- Deduct fee
        UPDATE public.wallets
        SET balance = balance - v_fee,
            updated_at = now()
        WHERE id = v_restaurant_wallet_id;

        -- Record transaction
        INSERT INTO public.transactions (
            wallet_id,
            amount,
            type,
            description,
            reference,
            created_at
        ) VALUES (
            v_restaurant_wallet_id,
            -v_fee,
            'debit',
            'Delivery fee for order ' || p_order_id,
            p_order_id::text,
            now()
        );
    END IF;

    -- 3. Update Order
    UPDATE public.orders
    SET 
        rider_id = p_rider_id,
        delivery_fee = v_fee,
        updated_at = now()
    WHERE id = p_order_id;

    -- 4. Update Bids
    -- Accept this one
    UPDATE public.order_rider_bids
    SET status = 'accepted', updated_at = now()
    WHERE id = v_bid_record.id;

    -- Reject others
    UPDATE public.order_rider_bids
    SET status = 'rejected', updated_at = now()
    WHERE order_id = p_order_id AND id != v_bid_record.id;

    RETURN jsonb_build_object('success', true, 'message', 'Invite accepted and rider assigned');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$;
