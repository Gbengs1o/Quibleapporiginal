-- 57_separate_rider_chats.sql
-- Add chat_type to order_chats to distinguish between:
-- 'general' (Customer <-> Restaurant) - DEFAULT
-- 'rider_customer' (Rider <-> Customer)
-- 'rider_restaurant' (Rider <-> Restaurant)

-- 1. Add column
ALTER TABLE public.order_chats 
ADD COLUMN IF NOT EXISTS chat_type TEXT DEFAULT 'general';

-- 2. Update existing RPC: get_or_create_order_chat
-- Ensures Customers/Restaurants only get the 'general' chat by default
CREATE OR REPLACE FUNCTION public.get_or_create_order_chat(p_order_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_chat_id UUID;
    v_order RECORD;
BEGIN
    -- Check if GENERAL chat already exists
    SELECT id INTO v_chat_id
    FROM public.order_chats
    WHERE order_id = p_order_id
    AND chat_type = 'general'; -- Explicitly check for general type

    IF v_chat_id IS NOT NULL THEN
        RETURN v_chat_id;
    END IF;

    -- Get order details
    SELECT user_id, restaurant_id INTO v_order
    FROM public.orders
    WHERE id = p_order_id;

    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Create new GENERAL chat
    INSERT INTO public.order_chats (order_id, customer_id, restaurant_id, chat_type)
    VALUES (p_order_id, v_order.user_id, v_order.restaurant_id, 'general')
    RETURNING id INTO v_chat_id;

    RETURN v_chat_id;
END;
$function$;

-- 3. Update existing RPC: get_or_create_rider_order_chat
-- Takes an optional p_chat_type to fetch specific channels
CREATE OR REPLACE FUNCTION public.get_or_create_rider_order_chat(p_order_id uuid, p_chat_type text DEFAULT 'general')
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_chat_id UUID;
    v_order RECORD;
BEGIN
    SELECT id, user_id, restaurant_id, rider_id INTO v_order
    FROM public.orders
    WHERE id = p_order_id;

    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_order.rider_id != auth.uid() THEN
        RAISE EXCEPTION 'You are not the assigned rider for this order';
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
