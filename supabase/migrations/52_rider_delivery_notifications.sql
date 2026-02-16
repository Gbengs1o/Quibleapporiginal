-- Trigger: Notify rider when they receive a food delivery invite
-- This inserts a row into the notifications table so the rider sees it

CREATE OR REPLACE FUNCTION notify_rider_on_invite()
RETURNS TRIGGER AS $$
DECLARE
    v_order RECORD;
    v_restaurant_name TEXT;
BEGIN
    -- Only fire on new invites
    IF NEW.status = 'invited' THEN
        -- Get order and restaurant info
        SELECT o.id, o.total_amount, r.name 
        INTO v_order
        FROM public.orders o
        JOIN public.restaurants r ON r.id = o.restaurant_id
        WHERE o.id = NEW.order_id;

        v_restaurant_name := v_order.name;

        INSERT INTO public.notifications (user_id, recipient_role, title, message, type, meta_data)
        VALUES (
            NEW.rider_id,
            'personal',
            '🍔 New Delivery Request!',
            COALESCE(v_restaurant_name, 'A restaurant') || ' wants you to deliver an order (₦' || COALESCE(NEW.amount::text, '0') || ')',
            'delivery',
            jsonb_build_object(
                'order_id', NEW.order_id,
                'bid_id', NEW.id,
                'amount', NEW.amount,
                'restaurant_name', v_restaurant_name
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists to avoid duplicate trigger errors  
DROP TRIGGER IF EXISTS on_rider_invited ON public.order_rider_bids;

CREATE TRIGGER on_rider_invited
    AFTER INSERT ON public.order_rider_bids
    FOR EACH ROW
    EXECUTE FUNCTION notify_rider_on_invite();

-- Also notify rider when assigned to a food order directly (via orders table)
CREATE OR REPLACE FUNCTION notify_rider_on_order_assignment()
RETURNS TRIGGER AS $$
DECLARE
    v_restaurant_name TEXT;
BEGIN
    -- Only fire when rider_id changes from NULL to a value
    IF OLD.rider_id IS NULL AND NEW.rider_id IS NOT NULL THEN
        SELECT r.name INTO v_restaurant_name
        FROM public.restaurants r
        WHERE r.id = NEW.restaurant_id;

        INSERT INTO public.notifications (user_id, recipient_role, title, message, type, meta_data)
        VALUES (
            NEW.rider_id,
            'personal',
            '✅ Delivery Assigned!',
            'You have been assigned to deliver an order from ' || COALESCE(v_restaurant_name, 'a restaurant') || '.',
            'delivery',
            jsonb_build_object(
                'order_id', NEW.id,
                'restaurant_name', v_restaurant_name
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_rider_assigned_to_order ON public.orders;

CREATE TRIGGER on_rider_assigned_to_order
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_rider_on_order_assignment();
