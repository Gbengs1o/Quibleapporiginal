-- Secure Delivery Completion & Fund Release
-- This function replaces the basic one, adding specific constraints:
-- 1. If called by RIDER: Must be within 200m of Dropoff Location.
-- 2. If called by USER: Bypasses location check (Manual Confirmation).
-- 3. Both release the "Escrowed" funds to the Rider.

-- Prerequisite: PostGIS extension is often hefty, so we use a simple Haversine formula for distance check.
CREATE OR REPLACE FUNCTION public.haversine_distance_km(
    lat1 FLOAT, lng1 FLOAT,
    lat2 FLOAT, lng2 FLOAT
) RETURNS FLOAT AS $$
DECLARE
    R CONSTANT FLOAT := 6371; -- Earth radius in km
    dLat FLOAT;
    dLon FLOAT;
    a FLOAT;
    c FLOAT;
BEGIN
    dLat := radians(lat2 - lat1);
    dLon := radians(lng2 - lng1);
    a := sin(dLat/2) * sin(dLat/2) + 
         cos(radians(lat1)) * cos(radians(lat2)) * 
         sin(dLon/2) * sin(dLon/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.complete_delivery_job_v2(
    p_request_id UUID,
    p_lat FLOAT DEFAULT NULL,
    p_lng FLOAT DEFAULT NULL
) 
RETURNS JSONB AS $$
DECLARE
    v_req RECORD;
    v_rider_wallet_id UUID;
    v_dist_km FLOAT;
    v_is_user BOOLEAN;
    v_is_rider BOOLEAN;
BEGIN
    -- 1. Fetch Request
    SELECT * INTO v_req FROM public.delivery_requests WHERE id = p_request_id;
    
    IF v_req IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Request not found');
    END IF;

    IF v_req.status = 'delivered' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Already delivered');
    END IF;

    -- 2. Identify Caller
    v_is_user := (v_req.user_id = auth.uid());
    
    -- Check if caller is the assigned rider
    SELECT EXISTS (
        SELECT 1 FROM public.riders WHERE user_id = auth.uid() AND user_id = v_req.rider_id
    ) INTO v_is_rider;

    IF NOT v_is_user AND NOT v_is_rider THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;

    -- 3. Geofence Check (ONLY For Rider)
    IF v_is_rider THEN
        IF p_lat IS NULL OR p_lng IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'Location required for rider completion');
        END IF;

        -- Check distance to dropoff
        v_dist_km := public.haversine_distance_km(p_lat, p_lng, v_req.dropoff_latitude, v_req.dropoff_longitude);
        
        -- Threshold: 0.2km (200 meters)
        IF v_dist_km > 0.2 THEN
            RETURN jsonb_build_object(
                'success', false, 
                'message', 'You are too far from the destination (' || round(v_dist_km::numeric, 2) || 'km away). Please get closer or ask the user to confirm.'
            );
        END IF;
    END IF;

    -- 4. Process Payment (Release Funds from Escrow/Void to Rider)
    -- Note: Money was already deducted from User in `accept_delivery_bid`. 
    -- Ideally, we moved it to a system wallet or just decremented user balance. 
    -- Now we just need to CREDIT the rider.
    -- (If we had a true Double-Entry Escrow specific wallet, we would debit that. 
    -- For now, we assume the system "held" it by simply debiting the user earlier).

    -- Get Rider Wallet
    SELECT id INTO v_rider_wallet_id FROM public.wallets WHERE rider_id = (SELECT id FROM public.riders WHERE user_id = v_req.rider_id);

    IF v_rider_wallet_id IS NULL THEN
        -- Should have been created on signup, but safeguard:
        RETURN jsonb_build_object('success', false, 'message', 'Rider wallet not found');
    END IF;

    -- Credit Rider
    UPDATE public.wallets
    SET balance = balance + COALESCE(v_req.final_price, v_req.offered_price)
    WHERE id = v_rider_wallet_id;

    -- Record Transaction (Credit)
    INSERT INTO public.transactions (
        wallet_id, 
        type, 
        amount, 
        description, 
        reference_id, 
        status
    )
    VALUES (
        v_rider_wallet_id,
        'credit',
        COALESCE(v_req.final_price, v_req.offered_price),
        'Earnings for Delivery',
        p_request_id::text,
        'completed'
    );

    -- 5. Update Status
    UPDATE public.delivery_requests
    SET status = 'delivered', updated_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'message', 'Delivery completed and funds released.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
