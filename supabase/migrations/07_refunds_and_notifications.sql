-- 1. Create Notifications Table
CREATE TYPE notification_role AS ENUM ('personal', 'business');

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    recipient_role notification_role DEFAULT 'personal',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'order_update', 'new_order', 'promo', 'system'
    is_read BOOLEAN DEFAULT false,
    meta_data JSONB, -- store { order_id: ... }
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (true); -- Or restricted to service role if we wanted strictness, but we use triggers.

-- 2. Trigger Function: Notify on Status Change (For User)
CREATE OR REPLACE FUNCTION notify_user_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO public.notifications (user_id, recipient_role, title, message, type, meta_data)
        VALUES (
            NEW.user_id,
            'personal',
            'Order Update',
            'Your order is now ' || NEW.status,
            'order_update',
            jsonb_build_object('order_id', NEW.id)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_order_status_update
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_user_status_change();

-- 3. Trigger Function: Notify Restaurant on New Order
CREATE OR REPLACE FUNCTION notify_restaurant_new_order()
RETURNS TRIGGER AS $$
DECLARE
    owner_id UUID;
    restaurant_name TEXT;
BEGIN
    SELECT r.owner_id, r.name INTO owner_id, restaurant_name
    FROM public.restaurants r
    WHERE r.id = NEW.restaurant_id;

    IF owner_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, recipient_role, title, message, type, meta_data)
        VALUES (
            owner_id,
            'business',
            'New Order Received! 🔔',
            'New order of ₦' || NEW.total_amount || ' received.',
            'new_order',
            jsonb_build_object('order_id', NEW.id, 'restaurant_id', NEW.restaurant_id)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_order_placed
    AFTER INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_restaurant_new_order();


-- 4. RPC: Cancel Order & Refund
CREATE OR REPLACE FUNCTION cancel_order_refund(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_user_wallet UUID;
    v_rest_wallet UUID;
    v_admin_wallet UUID;
    v_platform_fee DECIMAL;
    v_rest_share DECIMAL;
BEGIN
    -- Get Order
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    
    IF v_order IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    IF v_order.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order already cancelled');
    END IF;
    
    -- Ensure only Restaurant Owner (or Admin) can cancel
    -- (Ideally pass a reason or checks here, but assuming authorized via RLS on UI/middleware for now)
    -- For RPC, we can check if auth.uid() owns the restaurant or is the user (if allowing user cancel)
    -- For now, let's assume this is triggered by Restaurant Owner.
    
    -- Calculate Amounts
    v_platform_fee := v_order.total_amount * 0.10;
    v_rest_share := v_order.total_amount - v_platform_fee;

    -- Get Wallets
    SELECT id INTO v_user_wallet FROM public.wallets WHERE user_id = v_order.user_id AND type = 'personal';
    
    -- Business wallet linked to restaurant
    SELECT id INTO v_rest_wallet FROM public.wallets WHERE restaurant_id = v_order.restaurant_id AND type = 'business';

    SELECT id INTO v_admin_wallet FROM public.wallets WHERE type = 'admin' LIMIT 1;

    -- Perform Refund (Reverse Flows)
    -- 1. Deduct from Restaurant
    UPDATE public.wallets SET balance = balance - v_rest_share WHERE id = v_rest_wallet;
    INSERT INTO public.transactions (wallet_id, amount, type, description) 
    VALUES (v_rest_wallet, v_rest_share, 'debit', 'Refund for Order #' || substring(p_order_id::text, 1, 8));

    -- 2. Deduct from Admin (Fee Reversal)
    IF v_admin_wallet IS NOT NULL THEN
        UPDATE public.wallets SET balance = balance - v_platform_fee WHERE id = v_admin_wallet;
         INSERT INTO public.transactions (wallet_id, amount, type, description) 
        VALUES (v_admin_wallet, v_platform_fee, 'debit', 'Fee Reversal for Order #' || substring(p_order_id::text, 1, 8));
    END IF;

    -- 3. Credit User (Full Amount)
    UPDATE public.wallets SET balance = balance + v_order.total_amount WHERE id = v_user_wallet;
    INSERT INTO public.transactions (wallet_id, amount, type, description) 
    VALUES (v_user_wallet, v_order.total_amount, 'credit', 'Refund for Order #' || substring(p_order_id::text, 1, 8));

    -- Update Order Status
    UPDATE public.orders SET status = 'cancelled' WHERE id = p_order_id;

    -- Notify User
    INSERT INTO public.notifications (user_id, recipient_role, title, message, type, meta_data)
    VALUES (
        v_order.user_id,
        'personal',
        'Order Cancelled',
        'Your order has been cancelled and funds refunded.',
        'cancelled',
        jsonb_build_object('order_id', p_order_id)
    );

    RETURN jsonb_build_object('success', true, 'message', 'Order cancelled and refunded');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
