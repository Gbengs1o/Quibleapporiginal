-- Fix referral trigger on delivery_requests: table has no `price` column.
-- Use final_price/offered_price as the completed delivery amount.

CREATE OR REPLACE FUNCTION public.tr_handle_delivery_completion_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status <> 'delivered') THEN
        PERFORM public.process_referral_reward(
            NEW.user_id,
            COALESCE(NEW.final_price, NEW.offered_price, 0),
            p_delivery_id := NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$;
