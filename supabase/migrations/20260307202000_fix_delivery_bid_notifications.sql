-- ============================================================================
-- Fix Delivery Bid Notifications
-- - Notify customer when a rider places a bid
-- - Notify rider when bid is accepted or rejected by customer
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_new_bid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_user_id UUID;
    v_rider_name TEXT;
BEGIN
    IF NEW.request_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT dr.user_id
    INTO v_target_user_id
    FROM public.delivery_requests dr
    WHERE dr.id = NEW.request_id;

    IF v_target_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT CONCAT_WS(
        ' ',
        p.first_name,
        CASE
            WHEN p.last_name IS NOT NULL AND p.last_name <> '' THEN LEFT(p.last_name, 1) || '.'
            ELSE NULL
        END
    )
    INTO v_rider_name
    FROM public.profiles p
    WHERE p.id = NEW.rider_id;

    IF v_rider_name IS NULL OR v_rider_name = '' THEN
        v_rider_name := 'A rider';
    END IF;

    INSERT INTO public.notifications (
        user_id,
        recipient_role,
        title,
        message,
        type,
        is_read,
        meta_data
    )
    VALUES (
        v_target_user_id,
        'personal',
        'New Bid Received',
        v_rider_name || ' placed a bid of ₦' || COALESCE(NEW.amount::text, '0'),
        'delivery',
        false,
        jsonb_build_object(
            'request_id', NEW.request_id,
            'bid_id', NEW.id,
            'amount', NEW.amount,
            'action_link', '/send-package/request/' || NEW.request_id
        )
    );

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_bid_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_title TEXT;
    v_message TEXT;
    v_action_link TEXT;
BEGIN
    IF TG_OP <> 'UPDATE' THEN
        RETURN NEW;
    END IF;

    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;

    IF NEW.status = 'accepted' THEN
        v_title := 'Bid Accepted';
        v_message := 'Your bid of ₦' || COALESCE(NEW.amount::text, '0') || ' was accepted.';
        v_action_link := '/rider/delivery/' || NEW.request_id;
    ELSIF NEW.status = 'rejected' THEN
        v_title := 'Bid Declined';
        v_message := 'Your bid of ₦' || COALESCE(NEW.amount::text, '0') || ' was declined.';
        v_action_link := '/rider/deliveries?tab=orders';
    ELSE
        RETURN NEW;
    END IF;

    IF NEW.rider_id IS NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.notifications (
        user_id,
        recipient_role,
        title,
        message,
        type,
        is_read,
        meta_data
    )
    VALUES (
        NEW.rider_id,
        'personal',
        v_title,
        v_message,
        'delivery',
        false,
        jsonb_build_object(
            'request_id', NEW.request_id,
            'bid_id', NEW.id,
            'status', NEW.status,
            'action_link', v_action_link
        )
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_bid ON public.delivery_bids;
CREATE TRIGGER on_new_bid
AFTER INSERT ON public.delivery_bids
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_bid();

DROP TRIGGER IF EXISTS on_bid_accepted ON public.delivery_bids;
CREATE TRIGGER on_bid_accepted
AFTER UPDATE ON public.delivery_bids
FOR EACH ROW
EXECUTE FUNCTION public.notify_bid_accepted();
