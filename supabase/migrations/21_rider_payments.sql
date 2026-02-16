-- Create a function to securely complete a delivery and credit the rider's wallet
CREATE OR REPLACE FUNCTION public.complete_delivery_job(
    request_id_input UUID
) 
RETURNS JSONB AS $$
DECLARE
    request_record RECORD;
    rider_wallet_id UUID;
    v_rider_id UUID;
BEGIN
    -- 1. Fetch the delivery request
    SELECT * INTO request_record
    FROM public.delivery_requests
    WHERE id = request_id_input;

    -- 2. Validate request exists
    IF request_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Delivery request not found');
    END IF;

    -- 3. Validate Authorisation: The caller must be the assigned rider
    IF request_record.rider_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized to complete this delivery');
    END IF;

    -- 4. Validate Status: Must be picked_up (or accepted if mistakenly skipped)
    IF request_record.status = 'delivered' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Delivery already completed');
    END IF;

    -- 5. Helper: Get the internal rider ID (PK) from the public.riders table using the auth.uid (user_id)
    SELECT id INTO v_rider_id FROM public.riders WHERE user_id = auth.uid();

    -- 6. Get Rider's Wallet
    SELECT id INTO rider_wallet_id 
    FROM public.wallets 
    WHERE rider_id = v_rider_id AND type = 'rider';

    IF rider_wallet_id IS NULL THEN
         -- Attempt to create one if missing (using the trigger logic manually if needed, or erroring)
         -- Ideally, every rider has a wallet.
         RETURN jsonb_build_object('success', false, 'error', 'Rider wallet not found');
    END IF;

    -- 7. Update Request Status
    UPDATE public.delivery_requests
    SET status = 'delivered',
        updated_at = now()
    WHERE id = request_id_input;

    -- 8. Process Payment (Credit Rider Wallet)
    -- We use COALESCE to ensure we don't break on null price, though price should exist.
    IF request_record.final_price IS NOT NULL AND request_record.final_price > 0 THEN
        -- Credit Wallet
        UPDATE public.wallets
        SET balance = balance + request_record.final_price
        WHERE id = rider_wallet_id;

        -- Record Transaction
        INSERT INTO public.transactions (
            wallet_id, 
            type, 
            amount, 
            description, 
            reference_id, 
            status,
            created_at
        )
        VALUES (
            rider_wallet_id,
            'credit',
            request_record.final_price,
            'Earnings for Delivery #' || substring(request_id_input::text, 1, 8),
            request_id_input::text,
            'completed',
            now()
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Delivery completed and wallet credited');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
