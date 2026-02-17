-- Fix: Allow restaurant owners to also use get_or_create_rider_order_chat
-- Previously only riders could call this RPC, which blocked restaurant owners
-- from opening rider chats from the Orders screen.

CREATE OR REPLACE FUNCTION public.get_or_create_rider_order_chat(p_order_id uuid, p_chat_type text DEFAULT 'general')
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_chat_id UUID;
    v_order RECORD;
    v_is_restaurant_owner BOOLEAN;
BEGIN
    SELECT id, user_id, restaurant_id, rider_id INTO v_order
    FROM public.orders
    WHERE id = p_order_id;

    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Check if caller is the assigned rider
    -- OR the restaurant owner
    SELECT EXISTS (
        SELECT 1 FROM public.restaurants
        WHERE id = v_order.restaurant_id
        AND owner_id = auth.uid()
    ) INTO v_is_restaurant_owner;

    IF v_order.rider_id != auth.uid() AND NOT v_is_restaurant_owner THEN
        RAISE EXCEPTION 'You are not the assigned rider or restaurant owner for this order';
    END IF;

    -- Check for existing chat of specific TYPE
    SELECT id INTO v_chat_id
    FROM public.order_chats
    WHERE order_id = p_order_id
    AND chat_type = p_chat_type;

    IF v_chat_id IS NOT NULL THEN
        RETURN v_chat_id;
    END IF;

    -- Create new chat of specific TYPE
    INSERT INTO public.order_chats (order_id, customer_id, restaurant_id, chat_type)
    VALUES (p_order_id, v_order.user_id, v_order.restaurant_id, p_chat_type)
    RETURNING id INTO v_chat_id;

    RETURN v_chat_id;
END;
$function$;
