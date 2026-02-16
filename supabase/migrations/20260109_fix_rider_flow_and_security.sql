-- 1. Fix order_rider_bids schema
ALTER TABLE public.order_rider_bids 
ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2) DEFAULT 0.00;

-- 1b. Fix CHECK constraint to include 'invited' status
ALTER TABLE public.order_rider_bids DROP CONSTRAINT IF EXISTS order_rider_bids_status_check;
ALTER TABLE public.order_rider_bids ADD CONSTRAINT order_rider_bids_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'invited'::text]));

-- 2. Add pickup_code to orders for Secure Handoff
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS pickup_code TEXT;

-- Function to generate a random 4-digit code
CREATE OR REPLACE FUNCTION generate_pickup_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN lpad(floor(random() * 10000)::text, 4, '0');
END;
$$;

-- Trigger to automatically assign pickup_code on order creation
CREATE OR REPLACE FUNCTION set_order_pickup_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.pickup_code IS NULL THEN
        NEW.pickup_code := generate_pickup_code();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_set_order_pickup_code ON public.orders;
CREATE TRIGGER tr_set_order_pickup_code
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION set_order_pickup_code();

-- Backfill existing orders with codes (optional, but good for testing)
UPDATE public.orders SET pickup_code = generate_pickup_code() WHERE pickup_code IS NULL;

-- 3. Broadcast RPC (Beacon)
-- Invites 20 nearest/active riders (simplified to just active for now)
CREATE OR REPLACE FUNCTION broadcast_order_request(p_order_id UUID, p_amount DECIMAL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rider RECORD;
    v_count INT := 0;
BEGIN
    -- Iterate over active riders who are not already invited/bidding
    FOR v_rider IN 
        SELECT user_id FROM public.riders 
        WHERE status = 'active'
        AND user_id NOT IN (
            SELECT rider_id FROM public.order_rider_bids WHERE order_id = p_order_id
        )
        LIMIT 20
    LOOP
        INSERT INTO public.order_rider_bids (order_id, rider_id, amount, status)
        VALUES (p_order_id, v_rider.user_id, p_amount, 'invited');
        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'count', v_count, 'message', 'Broadcasted to ' || v_count || ' riders');
END;
$$;

-- 4. Verify Pickup RPC
-- Verify code and move order to 'out_for_delivery'
CREATE OR REPLACE FUNCTION verify_order_pickup(p_order_id UUID, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_record RECORD;
BEGIN
    SELECT * INTO v_order_record FROM public.orders WHERE id = p_order_id;

    IF v_order_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    IF v_order_record.pickup_code != p_code THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid pickup code');
    END IF;

    -- Update Status
    -- Assuming status flow: ready -> (assigned) -> out_for_delivery -> delivered
    UPDATE public.orders 
    SET status = 'out_for_delivery', updated_at = now()
    WHERE id = p_order_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Pickup verified! Order is out for delivery.');
END;
$$;
