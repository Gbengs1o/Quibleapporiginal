-- 1. Create Order Rider Bids Table (If missing)
CREATE TABLE IF NOT EXISTS public.order_rider_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    rider_id UUID REFERENCES public.riders(user_id) NOT NULL,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0.00, -- Fee requested by rider
    status TEXT DEFAULT 'pending', -- pending, accepted, rejected
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_rider_bids ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Riders can insert bids" ON public.order_rider_bids
    FOR INSERT WITH CHECK (auth.uid() = rider_id);

CREATE POLICY "Riders can view own bids" ON public.order_rider_bids
    FOR SELECT USING (auth.uid() = rider_id);

CREATE POLICY "Restaurant Owners can view bids for their orders" ON public.order_rider_bids
    FOR SELECT USING (
        order_id IN (
            SELECT id FROM public.orders 
            WHERE restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
        )
    );

-- 2. Create `accept_rider_bid` RPC
-- Purpose: Restaurant accepts a rider's bid.
-- Actions:
--   - Validates authorization (Restaurant Owner)
--   - Locks Order (Prevent race conditions)
--   - Deducts Delivery Fee from Restaurant Business Wallet (Escrow Logic)
--   - Assigns Rider to Order
--   - Updates Order Status
--   - Rejects other bids

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
    v_restaurant_wallet_id UUID;
    v_delivery_fee DECIMAL;
BEGIN
    -- 1. Lock Order & Validate Permissions
    SELECT o.*, r.owner_id 
    INTO v_order_record
    FROM public.orders o
    JOIN public.restaurants r ON o.restaurant_id = r.id
    WHERE o.id = p_order_id
    FOR UPDATE; -- Lock to prevent double assignment

    IF v_order_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    IF v_order_record.owner_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;

    IF v_order_record.rider_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Rider already assigned');
    END IF;

    -- 2. Validate Bid
    SELECT * INTO v_bid_record
    FROM public.order_rider_bids
    WHERE order_id = p_order_id AND rider_id = p_rider_id AND status = 'pending';

    IF v_bid_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bid not found or no longer pending');
    END IF;

    v_delivery_fee := v_bid_record.amount;

    -- 3. Process Payment (Restaurant Pays Delivery Fee)
    -- Fetch Restaurant Wallet
    SELECT id INTO v_restaurant_wallet_id 
    FROM public.wallets 
    WHERE restaurant_id = v_order_record.restaurant_id AND type = 'business';

    IF v_restaurant_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Restaurant wallet not found');
    END IF;

    -- Atomic Deduction
    UPDATE public.wallets 
    SET balance = balance - v_delivery_fee, updated_at = now() 
    WHERE id = v_restaurant_wallet_id AND balance >= v_delivery_fee;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds in restaurant wallet');
    END IF;

    -- Record Debit
    INSERT INTO public.transactions (wallet_id, amount, type, description, reference_id, status)
    VALUES (
        v_restaurant_wallet_id, 
        v_delivery_fee, 
        'debit', 
        'Delivery Fee for Order #' || substr(p_order_id::text, 1, 8), 
        p_order_id::text,
        'completed'
    );
    
    -- Note: Money is "gone" from restaurant. It is effectively in "Escrow" (the system's float). 
    -- It will be released to rider in 'complete_delivery_job'.

    -- 4. Update Order
    UPDATE public.orders
    SET 
        rider_id = p_rider_id,
        delivery_fee = v_delivery_fee, -- Save the agreed fee
        status = 'with_rider', -- Or 'ready' -> 'with_rider' upon pickup? Usually assigning means they are coming.
        -- Let's stick to current status flow or keep it 'ready' until they pickup?
        -- Usually: Received -> Preparing -> Ready -> (Assign) -> With Rider (Picked Up) -> Delivered.
        -- If we just assign, maybe status doesn't change yet? 
        -- But 'with_rider' implies possession. 
        -- Let's keep status as is (Ready) or update to 'accepted'? 
        -- Reviewing 'orders.tsx': "Assign Rider" is allowed when "ready".
        -- If assigned, it waits for pickup. 
        -- Let's NOT change status to 'with_rider' yet unless picking up.
        -- However, we MUST prevent others from bidding. Setting rider_id does that.
        updated_at = now()
    WHERE id = p_order_id;
    
    -- 5. Update Bids
    UPDATE public.order_rider_bids
    SET status = 'accepted'
    WHERE order_id = p_order_id AND rider_id = p_rider_id;

    UPDATE public.order_rider_bids
    SET status = 'rejected'
    WHERE order_id = p_order_id AND rider_id != p_rider_id;

    RETURN jsonb_build_object('success', true, 'message', 'Rider assigned successfully');
EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;
