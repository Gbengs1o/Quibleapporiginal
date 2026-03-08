-- ============================================================
-- Store-Rider Parity Migration
-- Makes all rider-facing RPCs, triggers, and notifications
-- work for store orders just like restaurant orders.
-- ============================================================

-- 1. Fix notify_rider_on_invite trigger
-- Support both restaurant and store orders in notification text
CREATE OR REPLACE FUNCTION notify_rider_on_invite()
RETURNS TRIGGER AS $$
DECLARE
    v_order RECORD;
    v_source_name TEXT;
    v_is_store BOOLEAN;
    v_title TEXT;
    v_message TEXT;
BEGIN
    IF NEW.status = 'invited' THEN
        SELECT o.id, o.total_amount, o.restaurant_id, o.store_id,
               r.name AS restaurant_name,
               s.name AS store_name
        INTO v_order
        FROM public.orders o
        LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
        LEFT JOIN public.stores s ON s.id = o.store_id
        WHERE o.id = NEW.order_id;

        v_is_store := (v_order.store_id IS NOT NULL);
        v_source_name := COALESCE(
            CASE WHEN v_is_store THEN v_order.store_name ELSE v_order.restaurant_name END,
            CASE WHEN v_is_store THEN 'A store' ELSE 'A restaurant' END
        );

        v_title := CASE WHEN v_is_store THEN '🛍️ New Store Delivery Request!' ELSE '🍔 New Delivery Request!' END;
        v_message := v_source_name || ' wants you to deliver an order (₦' || COALESCE(NEW.amount::text, '0') || ')';

        INSERT INTO public.notifications (user_id, recipient_role, title, message, type, meta_data)
        VALUES (
            NEW.rider_id,
            'personal',
            v_title,
            v_message,
            'delivery',
            jsonb_build_object(
                'order_id', NEW.order_id,
                'bid_id', NEW.id,
                'amount', NEW.amount,
                'source_name', v_source_name,
                'source_type', CASE WHEN v_is_store THEN 'store' ELSE 'restaurant' END
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix notify_rider_on_order_assignment trigger
-- Support both restaurant and store orders
CREATE OR REPLACE FUNCTION notify_rider_on_order_assignment()
RETURNS TRIGGER AS $$
DECLARE
    v_source_name TEXT;
    v_is_store BOOLEAN;
BEGIN
    IF OLD.rider_id IS NULL AND NEW.rider_id IS NOT NULL THEN
        v_is_store := (NEW.store_id IS NOT NULL);

        IF v_is_store THEN
            SELECT s.name INTO v_source_name FROM public.stores s WHERE s.id = NEW.store_id;
        ELSE
            SELECT r.name INTO v_source_name FROM public.restaurants r WHERE r.id = NEW.restaurant_id;
        END IF;

        INSERT INTO public.notifications (user_id, recipient_role, title, message, type, meta_data)
        VALUES (
            NEW.rider_id,
            'personal',
            '✅ Delivery Assigned!',
            'You have been assigned to deliver an order from ' || COALESCE(v_source_name, CASE WHEN v_is_store THEN 'a store' ELSE 'a restaurant' END) || '.',
            'delivery',
            jsonb_build_object(
                'order_id', NEW.id,
                'source_name', v_source_name,
                'source_type', CASE WHEN v_is_store THEN 'store' ELSE 'restaurant' END
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix expire_stale_invites to support store orders
CREATE OR REPLACE FUNCTION expire_stale_invites(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expired RECORD;
    v_count INT := 0;
    v_source_name TEXT;
    v_is_store BOOLEAN;
BEGIN
    -- Get source name (restaurant or store)
    SELECT 
        COALESCE(s.name, r.name) AS source_name,
        (o.store_id IS NOT NULL) AS is_store
    INTO v_source_name, v_is_store
    FROM public.orders o
    LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
    LEFT JOIN public.stores s ON s.id = o.store_id
    WHERE o.id = p_order_id;

    FOR v_expired IN
        SELECT id, rider_id 
        FROM public.order_rider_bids
        WHERE order_id = p_order_id
          AND status = 'invited'
          AND expired_at IS NOT NULL
          AND expired_at <= now()
    LOOP
        UPDATE public.order_rider_bids
        SET status = 'expired', updated_at = now()
        WHERE id = v_expired.id;

        INSERT INTO public.notifications (user_id, recipient_role, title, message, type, meta_data)
        VALUES (
            v_expired.rider_id,
            'personal',
            '⏰ Delivery Request Expired',
            'The delivery request from ' || COALESCE(v_source_name, CASE WHEN v_is_store THEN 'a store' ELSE 'a restaurant' END) || ' expired because you didn''t respond in time.',
            'delivery',
            jsonb_build_object(
                'order_id', p_order_id,
                'reason', 'timeout',
                'source_name', v_source_name,
                'source_type', CASE WHEN v_is_store THEN 'store' ELSE 'restaurant' END
            )
        );

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'expired_count', v_count);
END;
$$;

-- 4. Replace get_rider_food_invites with get_rider_order_invites
-- Supports both restaurant and store orders
CREATE OR REPLACE FUNCTION get_rider_order_invites(p_rider_id UUID)
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
    restaurant_logo_url TEXT,
    store_name TEXT,
    store_address TEXT,
    store_logo_url TEXT,
    order_source TEXT
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
        r.logo_url AS restaurant_logo_url,
        s.name AS store_name,
        s.address AS store_address,
        s.logo_url AS store_logo_url,
        CASE WHEN o.store_id IS NOT NULL THEN 'store' ELSE 'restaurant' END AS order_source
    FROM public.order_rider_bids b
    JOIN public.orders o ON o.id = b.order_id
    LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
    LEFT JOIN public.stores s ON s.id = o.store_id
    WHERE b.rider_id = p_rider_id
      AND b.status IN ('invited', 'expired')
      AND o.rider_id IS NULL
      AND o.status NOT IN ('cancelled', 'delivered')
    ORDER BY b.created_at DESC;
END;
$$;

-- Keep old function name as alias for backward compatibility
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
        COALESCE(r.name, s.name) AS restaurant_name,
        COALESCE(r.address, s.address) AS restaurant_address,
        COALESCE(r.logo_url, s.logo_url) AS restaurant_logo_url
    FROM public.order_rider_bids b
    JOIN public.orders o ON o.id = b.order_id
    LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
    LEFT JOIN public.stores s ON s.id = o.store_id
    WHERE b.rider_id = p_rider_id
      AND b.status IN ('invited', 'expired')
      AND o.rider_id IS NULL
      AND o.status NOT IN ('cancelled', 'delivered')
    ORDER BY b.created_at DESC;
END;
$$;

-- 5. Fix rider_respond_to_invite to support store wallet
CREATE OR REPLACE FUNCTION public.rider_respond_to_invite(p_order_id uuid, p_rider_id uuid, p_response text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_order_record RECORD;
    v_bid_record RECORD;
    v_wallet_id UUID;
    v_current_balance NUMERIC;
    v_fee NUMERIC;
    v_is_store BOOLEAN;
BEGIN
    IF p_response NOT IN ('accepted', 'rejected') THEN
         RETURN jsonb_build_object('success', false, 'message', 'Invalid response type');
    END IF;

    SELECT * INTO v_bid_record FROM public.order_rider_bids 
    WHERE order_id = p_order_id AND rider_id = p_rider_id AND status = 'invited';

    IF v_bid_record IS NULL THEN
        SELECT * INTO v_bid_record FROM public.order_rider_bids 
        WHERE order_id = p_order_id AND rider_id = p_rider_id AND status = 'expired';
        
        IF v_bid_record IS NOT NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'This request has expired because you did not respond in time.');
        END IF;
        
        RETURN jsonb_build_object('success', false, 'message', 'Invite not found or already processed');
    END IF;

    IF v_bid_record.expired_at IS NOT NULL AND v_bid_record.expired_at <= now() THEN
        UPDATE public.order_rider_bids 
        SET status = 'expired', updated_at = now()
        WHERE id = v_bid_record.id;
        RETURN jsonb_build_object('success', false, 'message', 'This request has expired because you did not respond in time.');
    END IF;

    v_fee := v_bid_record.amount;

    IF p_response = 'rejected' THEN
        UPDATE public.order_rider_bids 
        SET status = 'rejected', updated_at = now()
        WHERE id = v_bid_record.id;
        RETURN jsonb_build_object('success', true, 'message', 'Invite rejected');
    END IF;

    -- Handle Acceptance
    SELECT * INTO v_order_record FROM public.orders WHERE id = p_order_id;
    IF v_order_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;
    
    IF v_order_record.rider_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order already assigned to another rider');
    END IF;

    -- Determine if this is a store or restaurant order
    v_is_store := (v_order_record.store_id IS NOT NULL);

    -- Check Wallet & Balance
    IF v_fee > 0 THEN
        IF v_is_store THEN
            SELECT id, balance INTO v_wallet_id, v_current_balance
            FROM public.wallets
            WHERE store_id = v_order_record.store_id;
        ELSE
            SELECT id, balance INTO v_wallet_id, v_current_balance
            FROM public.wallets
            WHERE restaurant_id = v_order_record.restaurant_id;
        END IF;

        IF v_wallet_id IS NULL THEN
             RETURN jsonb_build_object('success', false, 'message', 
                CASE WHEN v_is_store THEN 'Store wallet not found' ELSE 'Restaurant wallet not found' END);
        END IF;

        IF v_current_balance < v_fee THEN
             RETURN jsonb_build_object('success', false, 'message', 
                CASE WHEN v_is_store THEN 'Insufficient store balance' ELSE 'Insufficient restaurant balance' END);
        END IF;

        UPDATE public.wallets
        SET balance = balance - v_fee, updated_at = now()
        WHERE id = v_wallet_id;

        INSERT INTO public.transactions (
            wallet_id, amount, type, description, reference, created_at
        ) VALUES (
            v_wallet_id, -v_fee, 'debit',
            'Delivery fee for order ' || p_order_id,
            p_order_id::text, now()
        );
    END IF;

    -- Update Order
    UPDATE public.orders
    SET rider_id = p_rider_id, delivery_fee = v_fee, updated_at = now()
    WHERE id = p_order_id;

    -- Accept this bid
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

-- 6. Fix accept_rider_bid to support store orders
CREATE OR REPLACE FUNCTION accept_rider_bid(
    p_order_id UUID,
    p_rider_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_record RECORD;
    v_bid_record RECORD;
    v_wallet_id UUID;
    v_delivery_fee DECIMAL;
    v_is_store BOOLEAN;
    v_owner_id UUID;
BEGIN
    -- 1. Lock Order & determine source
    SELECT o.*, 
           COALESCE(r.owner_id, s.owner_id) AS the_owner_id,
           (o.store_id IS NOT NULL) AS is_store
    INTO v_order_record
    FROM public.orders o
    LEFT JOIN public.restaurants r ON o.restaurant_id = r.id
    LEFT JOIN public.stores s ON o.store_id = s.id
    WHERE o.id = p_order_id
    FOR UPDATE;

    IF v_order_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    IF v_order_record.the_owner_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;

    IF v_order_record.rider_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Rider already assigned');
    END IF;

    v_is_store := v_order_record.is_store;

    -- 2. Validate Bid
    SELECT * INTO v_bid_record
    FROM public.order_rider_bids
    WHERE order_id = p_order_id AND rider_id = p_rider_id AND status = 'pending';

    IF v_bid_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bid not found or no longer pending');
    END IF;

    v_delivery_fee := v_bid_record.amount;

    -- 3. Process Payment
    IF v_is_store THEN
        SELECT id INTO v_wallet_id FROM public.wallets WHERE store_id = v_order_record.store_id AND type = 'business';
    ELSE
        SELECT id INTO v_wallet_id FROM public.wallets WHERE restaurant_id = v_order_record.restaurant_id AND type = 'business';
    END IF;

    IF v_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 
            CASE WHEN v_is_store THEN 'Store wallet not found' ELSE 'Restaurant wallet not found' END);
    END IF;

    UPDATE public.wallets 
    SET balance = balance - v_delivery_fee, updated_at = now() 
    WHERE id = v_wallet_id AND balance >= v_delivery_fee;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds in wallet');
    END IF;

    INSERT INTO public.transactions (wallet_id, amount, type, description, reference_id, status)
    VALUES (
        v_wallet_id, v_delivery_fee, 'debit', 
        'Delivery Fee for Order #' || substr(p_order_id::text, 1, 8), 
        p_order_id::text, 'completed'
    );

    -- 4. Update Order
    UPDATE public.orders
    SET rider_id = p_rider_id, delivery_fee = v_delivery_fee, updated_at = now()
    WHERE id = p_order_id;
    
    -- 5. Update Bids
    UPDATE public.order_rider_bids SET status = 'accepted' WHERE order_id = p_order_id AND rider_id = p_rider_id;
    UPDATE public.order_rider_bids SET status = 'rejected' WHERE order_id = p_order_id AND rider_id != p_rider_id;

    RETURN jsonb_build_object('success', true, 'message', 'Rider assigned successfully');
EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;

-- 7. Fix get_or_create_rider_order_chat to support store owners
CREATE OR REPLACE FUNCTION public.get_or_create_rider_order_chat(p_order_id uuid, p_chat_type text DEFAULT 'general')
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_chat_id UUID;
    v_order RECORD;
    v_is_authorized BOOLEAN := false;
BEGIN
    SELECT id, user_id, restaurant_id, store_id, rider_id INTO v_order
    FROM public.orders
    WHERE id = p_order_id;

    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Check if caller is the assigned rider
    IF v_order.rider_id = auth.uid() THEN
        v_is_authorized := true;
    END IF;

    -- Check if caller is the restaurant owner
    IF NOT v_is_authorized AND v_order.restaurant_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.restaurants
            WHERE id = v_order.restaurant_id AND owner_id = auth.uid()
        ) INTO v_is_authorized;
    END IF;

    -- Check if caller is the store owner
    IF NOT v_is_authorized AND v_order.store_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.stores
            WHERE id = v_order.store_id AND owner_id = auth.uid()
        ) INTO v_is_authorized;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'You are not the assigned rider or business owner for this order';
    END IF;

    -- Check for existing chat
    SELECT id INTO v_chat_id
    FROM public.order_chats
    WHERE order_id = p_order_id AND chat_type = p_chat_type;

    IF v_chat_id IS NOT NULL THEN
        RETURN v_chat_id;
    END IF;

    -- Create new chat (use restaurant_id or store_id as appropriate)
    INSERT INTO public.order_chats (order_id, customer_id, restaurant_id, store_id, chat_type)
    VALUES (p_order_id, v_order.user_id, v_order.restaurant_id, v_order.store_id, p_chat_type)
    RETURNING id INTO v_chat_id;

    RETURN v_chat_id;
END;
$function$;

-- 8. Create/update get_order_job_details to support stores
DROP FUNCTION IF EXISTS get_order_job_details(uuid, uuid);
CREATE OR REPLACE FUNCTION get_order_job_details(p_order_id UUID, p_rider_id UUID)
RETURNS TABLE (
    the_order_id UUID,
    the_total_amount DECIMAL,
    the_delivery_fee DECIMAL,
    the_pickup_code TEXT,
    the_pickup_latitude DOUBLE PRECISION,
    the_pickup_longitude DOUBLE PRECISION,
    the_dropoff_latitude DOUBLE PRECISION,
    the_dropoff_longitude DOUBLE PRECISION,
    the_restaurant_name TEXT,
    the_restaurant_address TEXT,
    the_restaurant_latitude DOUBLE PRECISION,
    the_restaurant_longitude DOUBLE PRECISION,
    the_order_source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id AS the_order_id,
        o.total_amount AS the_total_amount,
        o.delivery_fee AS the_delivery_fee,
        o.pickup_code AS the_pickup_code,
        o.pickup_latitude AS the_pickup_latitude,
        o.pickup_longitude AS the_pickup_longitude,
        o.dropoff_latitude AS the_dropoff_latitude,
        o.dropoff_longitude AS the_dropoff_longitude,
        COALESCE(r.name, s.name) AS the_restaurant_name,
        COALESCE(r.address, s.address) AS the_restaurant_address,
        COALESCE(r.latitude, s.latitude) AS the_restaurant_latitude,
        COALESCE(r.longitude, s.longitude) AS the_restaurant_longitude,
        CASE WHEN o.store_id IS NOT NULL THEN 'store' ELSE 'restaurant' END AS the_order_source
    FROM public.orders o
    LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
    LEFT JOIN public.stores s ON s.id = o.store_id
    WHERE o.id = p_order_id
      AND EXISTS (
          SELECT 1 FROM public.order_rider_bids
          WHERE order_id = p_order_id AND rider_id = p_rider_id
      );
END;
$$;

-- 9. Add RLS policy for store owners to view bids on their store orders
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'order_rider_bids' 
        AND policyname = 'Store Owners can view bids for their orders'
    ) THEN
        CREATE POLICY "Store Owners can view bids for their orders" ON public.order_rider_bids
            FOR SELECT USING (
                order_id IN (
                    SELECT id FROM public.orders 
                    WHERE store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
                )
            );
    END IF;
END;
$$;
