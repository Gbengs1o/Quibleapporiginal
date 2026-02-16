-- Create a function to handle User accepting a Bid
-- This creates the transaction: User Pays -> System Hold (Escrow)
-- It also assigns the rider and updates request status

CREATE OR REPLACE FUNCTION public.accept_delivery_bid(
    p_request_id UUID,
    p_bid_id UUID
) 
RETURNS JSONB AS $$
DECLARE
    v_bid_amount DECIMAL;
    v_rider_id UUID;
    v_user_id UUID;
    v_user_wallet_id UUID;
    v_user_balance DECIMAL;
    v_request_status request_status;
BEGIN
    -- 1. Get Bid Details
    SELECT amount, rider_id INTO v_bid_amount, v_rider_id
    FROM public.delivery_bids
    WHERE id = p_bid_id;

    IF v_bid_amount IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bid not found');
    END IF;

    -- 2. Validate Request
    SELECT user_id, status INTO v_user_id, v_request_status
    FROM public.delivery_requests
    WHERE id = p_request_id;

    IF v_user_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;

    IF v_request_status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Request is no longer pending');
    END IF;

    -- 3. Get User Wallet
    SELECT id, balance INTO v_user_wallet_id, v_user_balance
    FROM public.wallets
    WHERE user_id = auth.uid() AND type = 'personal';

    -- Auto-create wallet if missing (for seamless UX)
    IF v_user_wallet_id IS NULL THEN
        INSERT INTO public.wallets (user_id, type, balance)
        VALUES (auth.uid(), 'personal', 0.0)
        RETURNING id, balance INTO v_user_wallet_id, v_user_balance;
    END IF;

    -- 4. Check Balance
    IF v_user_balance < v_bid_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient wallet balance. Please top up.');
    END IF;

    -- 5. Process Payment (Debit User)
    UPDATE public.wallets
    SET balance = balance - v_bid_amount
    WHERE id = v_user_wallet_id;

    -- Record Transaction (Debit)
    INSERT INTO public.transactions (
        wallet_id, 
        type, 
        amount, 
        description, 
        reference_id, 
        status
    )
    VALUES (
        v_user_wallet_id,
        'debit',
        v_bid_amount,
        'Payment for Delivery Request',
        p_request_id::text,
        'completed'
    );

    -- 6. Update Request (Assign Rider)
    UPDATE public.delivery_requests
    SET 
        status = 'accepted',
        rider_id = v_rider_id,
        final_price = v_bid_amount,
        updated_at = now()
    WHERE id = p_request_id;

    -- 7. Update Bid Status
    UPDATE public.delivery_bids
    SET status = 'accepted'
    WHERE id = p_bid_id;

    -- Reject other bids (Optional but good practice)
    UPDATE public.delivery_bids
    SET status = 'rejected'
    WHERE request_id = p_request_id AND id != p_bid_id;

    RETURN jsonb_build_object('success', true, 'message', 'Bid accepted and payment processed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
