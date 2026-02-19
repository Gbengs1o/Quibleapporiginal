-- ============================================================
-- Auto-Timeout Rider Invites (20 second expiry + cascading broadcast)
-- ============================================================

-- 1. Add expired_at column to track when invite expires
ALTER TABLE public.order_rider_bids 
ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;

-- 2. Update status CHECK constraint to include 'expired'
ALTER TABLE public.order_rider_bids DROP CONSTRAINT IF EXISTS order_rider_bids_status_check;
ALTER TABLE public.order_rider_bids ADD CONSTRAINT order_rider_bids_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'invited'::text, 'expired'::text]));

-- 3. Set expired_at on insert for invited status (20 seconds from now)
CREATE OR REPLACE FUNCTION set_invite_expiry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'invited' AND NEW.expired_at IS NULL THEN
        NEW.expired_at := now() + interval '20 seconds';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_invite_expiry ON public.order_rider_bids;
CREATE TRIGGER tr_set_invite_expiry
BEFORE INSERT ON public.order_rider_bids
FOR EACH ROW
EXECUTE FUNCTION set_invite_expiry();

-- Backfill existing invited bids with an expiry (20s from their creation)
UPDATE public.order_rider_bids 
SET expired_at = created_at + interval '20 seconds'
WHERE status = 'invited' AND expired_at IS NULL;

-- 4. expire_stale_invites RPC
-- Expires all invites for an order that have passed their expired_at time
-- Also creates a notification for each expired rider
CREATE OR REPLACE FUNCTION expire_stale_invites(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expired RECORD;
    v_count INT := 0;
    v_restaurant_name TEXT;
BEGIN
    -- Get restaurant name for notifications
    SELECT r.name INTO v_restaurant_name
    FROM public.orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE o.id = p_order_id;

    -- Expire stale invites
    FOR v_expired IN
        SELECT id, rider_id 
        FROM public.order_rider_bids
        WHERE order_id = p_order_id
          AND status = 'invited'
          AND expired_at IS NOT NULL
          AND expired_at <= now()
    LOOP
        -- Update status to expired
        UPDATE public.order_rider_bids
        SET status = 'expired', updated_at = now()
        WHERE id = v_expired.id;

        -- Notify the rider
        INSERT INTO public.notifications (user_id, recipient_role, title, message, type, meta_data)
        VALUES (
            v_expired.rider_id,
            'personal',
            '⏰ Delivery Request Expired',
            'The delivery request from ' || COALESCE(v_restaurant_name, 'a restaurant') || ' expired because you didn''t respond in time.',
            'delivery',
            jsonb_build_object(
                'order_id', p_order_id,
                'reason', 'timeout',
                'restaurant_name', v_restaurant_name
            )
        );

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'expired_count', v_count);
END;
$$;

-- 5. expire_and_broadcast RPC
-- Expires stale invites, then broadcasts to remaining un-invited active riders
CREATE OR REPLACE FUNCTION expire_and_broadcast(p_order_id UUID, p_amount DECIMAL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expire_result JSONB;
    v_rider RECORD;
    v_broadcast_count INT := 0;
    v_order_record RECORD;
BEGIN
    -- Check order still needs a rider
    SELECT * INTO v_order_record FROM public.orders WHERE id = p_order_id;
    IF v_order_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;
    IF v_order_record.rider_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order already has a rider assigned');
    END IF;

    -- Step 1: Expire stale invites
    SELECT expire_stale_invites(p_order_id) INTO v_expire_result;

    -- Step 2: Broadcast to remaining active riders who haven't been invited/bid
    FOR v_rider IN 
        SELECT user_id FROM public.riders 
        WHERE status = 'active'
        AND is_online = true -- Fix: Only target online riders
        AND user_id NOT IN (
            SELECT rider_id FROM public.order_rider_bids 
            WHERE order_id = p_order_id
        )
        LIMIT 20
    LOOP
        INSERT INTO public.order_rider_bids (order_id, rider_id, amount, status)
        VALUES (p_order_id, v_rider.user_id, p_amount, 'invited');
        v_broadcast_count := v_broadcast_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 
        'expired_count', (v_expire_result->>'expired_count')::int,
        'broadcast_count', v_broadcast_count,
        'message', 'Expired ' || (v_expire_result->>'expired_count') || ' invites, broadcasted to ' || v_broadcast_count || ' new riders'
    );
END;
$$;

-- 6. Update rider_respond_to_invite to reject if expired
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
        -- Check if it was expired
        SELECT * INTO v_bid_record FROM public.order_rider_bids 
        WHERE order_id = p_order_id AND rider_id = p_rider_id AND status = 'expired';
        
        IF v_bid_record IS NOT NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'This request has expired because you did not respond in time.');
        END IF;
        
        RETURN jsonb_build_object('success', false, 'message', 'Invite not found or already processed');
    END IF;

    -- Check if invite has timed out
    IF v_bid_record.expired_at IS NOT NULL AND v_bid_record.expired_at <= now() THEN
        -- Auto-expire it
        UPDATE public.order_rider_bids 
        SET status = 'expired', updated_at = now()
        WHERE id = v_bid_record.id;
        RETURN jsonb_build_object('success', false, 'message', 'This request has expired because you did not respond in time.');
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

    -- Reject/Expire others
    UPDATE public.order_rider_bids
    SET status = 'rejected', updated_at = now()
    WHERE order_id = p_order_id AND id != v_bid_record.id AND status IN ('invited', 'pending');

    RETURN jsonb_build_object('success', true, 'message', 'Invite accepted and rider assigned');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$;

-- 7. Update get_rider_food_invites to include expired_at and expired invites
CREATE OR REPLACE FUNCTION get_rider_food_invites(p_rider_id UUID)
RETURNS TABLE (
    bid_id UUID,
    order_id UUID,
    amount DECIMAL,
    bid_status TEXT,
    created_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    order_total DECIMAL,
    order_status TEXT,
    restaurant_name TEXT,
    restaurant_address TEXT,
    restaurant_logo_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id AS bid_id,
        b.order_id,
        b.amount,
        b.status AS bid_status,
        b.created_at,
        b.expired_at,
        o.total_amount AS order_total,
        o.status AS order_status,
        r.name AS restaurant_name,
        r.address AS restaurant_address,
        r.logo_url AS restaurant_logo_url
    FROM public.order_rider_bids b
    JOIN public.orders o ON o.id = b.order_id
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE b.rider_id = p_rider_id
      AND b.status IN ('invited', 'expired')
      AND o.rider_id IS NULL  -- Order not yet assigned
      AND o.status NOT IN ('cancelled', 'delivered')
    ORDER BY b.created_at DESC;
END;
$$;
