-- Fix legacy accept_delivery_bid function that referenced removed transactions columns
-- and could fail with:
-- column "reference_id" of relation "transactions" does not exist

CREATE OR REPLACE FUNCTION public.accept_delivery_bid(
    p_request_id uuid,
    p_bid_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bid_amount numeric;
    v_rider_id uuid;
    v_user_id uuid;
    v_user_wallet_id uuid;
    v_user_balance numeric;
    v_request_status request_status;
    v_reference text;
BEGIN
    -- 1) Resolve bid
    SELECT amount, rider_id
    INTO v_bid_amount, v_rider_id
    FROM public.delivery_bids
    WHERE id = p_bid_id
    FOR UPDATE;

    IF v_bid_amount IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bid not found');
    END IF;

    -- 2) Resolve and lock request
    SELECT user_id, status
    INTO v_user_id, v_request_status
    FROM public.delivery_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Request not found');
    END IF;

    IF v_user_id <> auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;

    v_reference := 'delivery_bid_debit_' || p_request_id::text;

    -- 3) Idempotency guard: already debited for this request
    IF EXISTS (
        SELECT 1
        FROM public.transactions
        WHERE reference = v_reference
    ) THEN
        UPDATE public.delivery_requests
        SET status = 'accepted',
            rider_id = v_rider_id,
            final_price = COALESCE(final_price, v_bid_amount),
            updated_at = now()
        WHERE id = p_request_id;

        UPDATE public.delivery_bids
        SET status = 'accepted'
        WHERE id = p_bid_id;

        UPDATE public.delivery_bids
        SET status = 'rejected'
        WHERE request_id = p_request_id
          AND id <> p_bid_id
          AND status = 'pending';

        RETURN jsonb_build_object('success', true, 'message', 'Bid already accepted');
    END IF;

    IF v_request_status <> 'pending' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Request is no longer pending');
    END IF;

    -- 4) Get/Create user wallet
    SELECT id, balance
    INTO v_user_wallet_id, v_user_balance
    FROM public.wallets
    WHERE user_id = auth.uid()
      AND type = 'personal'
    LIMIT 1;

    IF v_user_wallet_id IS NULL THEN
        INSERT INTO public.wallets (user_id, type, balance)
        VALUES (auth.uid(), 'personal', 0.0)
        RETURNING id, balance INTO v_user_wallet_id, v_user_balance;
    END IF;

    -- 5) Check balance
    IF v_user_balance < v_bid_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient wallet balance. Please top up.');
    END IF;

    -- 6) Debit user wallet atomically
    UPDATE public.wallets
    SET balance = balance - v_bid_amount,
        updated_at = now()
    WHERE id = v_user_wallet_id
      AND balance >= v_bid_amount;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient wallet balance. Please top up.');
    END IF;

    -- 7) Record debit transaction using valid schema columns
    INSERT INTO public.transactions (
        wallet_id,
        type,
        amount,
        description,
        reference
    )
    VALUES (
        v_user_wallet_id,
        'debit',
        v_bid_amount,
        'Payment for Delivery Request',
        v_reference
    )
    ON CONFLICT (reference) DO NOTHING;

    -- 8) Assign rider and update bid statuses
    UPDATE public.delivery_requests
    SET status = 'accepted',
        rider_id = v_rider_id,
        final_price = v_bid_amount,
        updated_at = now()
    WHERE id = p_request_id;

    UPDATE public.delivery_bids
    SET status = 'accepted'
    WHERE id = p_bid_id;

    UPDATE public.delivery_bids
    SET status = 'rejected'
    WHERE request_id = p_request_id
      AND id <> p_bid_id
      AND status = 'pending';

    RETURN jsonb_build_object('success', true, 'message', 'Bid accepted and payment processed');
END;
$$;
