-- 1. Add Delivery Code Columns
ALTER TABLE public.delivery_requests 
ADD COLUMN IF NOT EXISTS delivery_code TEXT;

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_code TEXT;

-- 2. Create Code Generation Trigger
CREATE OR REPLACE FUNCTION generate_delivery_code() 
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.delivery_code IS NULL THEN
        -- Generate 4-digit code (e.g., '0412', '9981')
        NEW.delivery_code := lpad(floor(random() * 10000)::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Apply Triggers
DROP TRIGGER IF EXISTS set_code_requests ON public.delivery_requests;
CREATE TRIGGER set_code_requests 
BEFORE INSERT ON public.delivery_requests
FOR EACH ROW EXECUTE FUNCTION generate_delivery_code();

DROP TRIGGER IF EXISTS set_code_orders ON public.orders;
CREATE TRIGGER set_code_orders 
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION generate_delivery_code();

-- Backfill existing active requests (Optional, ensuring security for ongoing jobs)
UPDATE public.delivery_requests 
SET delivery_code = lpad(floor(random() * 10000)::text, 4, '0') 
WHERE delivery_code IS NULL AND status IN ('pending', 'accepted', 'picked_up');

-- 4. Update Completion RPC to Verify Code
CREATE OR REPLACE FUNCTION public.complete_delivery_job_v2(
    p_request_id UUID,
    p_lat FLOAT DEFAULT NULL,
    p_lng FLOAT DEFAULT NULL,
    p_delivery_code TEXT DEFAULT NULL -- New Parameter
) 
RETURNS JSONB AS $$
DECLARE
    v_req RECORD;
    v_rider_wallet_id UUID;
    v_dist_km FLOAT;
    v_is_user BOOLEAN;
    v_is_rider BOOLEAN;
BEGIN
    -- 1. Fetch Request WITH LOCK
    SELECT * INTO v_req FROM public.delivery_requests WHERE id = p_request_id FOR UPDATE;
    
    IF v_req IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Request not found');
    END IF;

    IF v_req.status = 'delivered' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Already delivered');
    END IF;

    -- 2. Identify Caller
    v_is_user := (v_req.user_id = auth.uid());
    
    SELECT EXISTS (
        SELECT 1 FROM public.riders WHERE user_id = auth.uid() AND user_id = v_req.rider_id
    ) INTO v_is_rider;

    IF NOT v_is_user AND NOT v_is_rider THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;

    -- 3. DELIVERY CODE VERIFICATION
    -- If a code exists on the request, it MUST be provided and match.
    -- Users can bypass this if they are manually completing it themselves (v_is_user).
    -- Riders MUST provide the code.
    IF v_is_rider AND v_req.delivery_code IS NOT NULL THEN
        IF p_delivery_code IS NULL OR p_delivery_code != v_req.delivery_code THEN
             RETURN jsonb_build_object('success', false, 'message', 'Invalid Delivery Code. Ask the recipient for the 4-digit code.');
        END IF;
    END IF;

    -- 4. Geofence Check (ONLY For Rider)
    IF v_is_rider THEN
        IF p_lat IS NULL OR p_lng IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'Location required for rider completion');
        END IF;

        v_dist_km := public.haversine_distance_km(p_lat, p_lng, v_req.dropoff_latitude, v_req.dropoff_longitude);
        
        -- Threshold: 0.2km (200 meters)
        IF v_dist_km > 0.3 THEN -- Slightly relaxed to 300m for GPS drift
            RETURN jsonb_build_object(
                'success', false, 
                'message', 'You are too far from the destination (' || round(v_dist_km::numeric, 2) || 'km away).'
            );
        END IF;
    END IF;

    -- 5. Process Payment
    SELECT id INTO v_rider_wallet_id FROM public.wallets WHERE rider_id = (SELECT id FROM public.riders WHERE user_id = v_req.rider_id);

    IF v_rider_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Rider wallet not found');
    END IF;

    -- Credit Rider
    UPDATE public.wallets
    SET balance = balance + COALESCE(v_req.final_price, v_req.offered_price), updated_at = now()
    WHERE id = v_rider_wallet_id;

    -- Record Transaction
    INSERT INTO public.transactions (wallet_id, type, amount, description, reference_id, status)
    VALUES (
        v_rider_wallet_id,
        'credit',
        COALESCE(v_req.final_price, v_req.offered_price),
        'Earnings for Delivery',
        p_request_id::text,
        'completed'
    );

    -- 6. Update Status
    UPDATE public.delivery_requests
    SET status = 'delivered', updated_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'message', 'Delivery completed successfully.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
