-- 53_rider_restaurant_chat.sql
-- Allow riders assigned to an order to participate in the order chat with the restaurant

-- ============================================================================
-- 1. RLS POLICIES for rider access to order_chats
-- ============================================================================

-- Rider can view order chats for orders they are assigned to
CREATE POLICY "Rider can view order chats for assigned orders" ON public.order_chats
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_chats.order_id
            AND orders.rider_id = auth.uid()
        )
    );

-- Rider can insert into order_chats (via function mostly, but belt-and-suspenders)
CREATE POLICY "Rider can create order chats for assigned orders" ON public.order_chats
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_id
            AND orders.rider_id = auth.uid()
        )
    );

-- ============================================================================
-- 2. RLS POLICIES for rider access to order_chat_messages
-- ============================================================================

-- Rider can view messages in order chats for their assigned orders
CREATE POLICY "Rider can view order chat messages" ON public.order_chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.order_chats
            JOIN public.orders ON orders.id = order_chats.order_id
            WHERE order_chats.id = order_chat_messages.chat_id
            AND orders.rider_id = auth.uid()
        )
    );

-- Rider can send messages in order chats for their assigned orders  
CREATE POLICY "Rider can send order chat messages" ON public.order_chat_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.order_chats
            JOIN public.orders ON orders.id = order_chats.order_id
            WHERE order_chats.id = chat_id
            AND orders.rider_id = auth.uid()
        )
    );

-- ============================================================================
-- 3. FUNCTION: Get or create order chat for rider
-- ============================================================================
CREATE OR REPLACE FUNCTION get_or_create_rider_order_chat(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_chat_id UUID;
    v_order RECORD;
BEGIN
    -- Verify the caller is the assigned rider
    SELECT id, user_id, restaurant_id, rider_id INTO v_order
    FROM public.orders
    WHERE id = p_order_id;

    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_order.rider_id != auth.uid() THEN
        RAISE EXCEPTION 'You are not the assigned rider for this order';
    END IF;

    -- Check if chat already exists for this order
    SELECT id INTO v_chat_id
    FROM public.order_chats
    WHERE order_id = p_order_id;

    IF v_chat_id IS NOT NULL THEN
        RETURN v_chat_id;
    END IF;

    -- Create new chat (customer_id from order, restaurant_id from order)
    INSERT INTO public.order_chats (order_id, customer_id, restaurant_id)
    VALUES (p_order_id, v_order.user_id, v_order.restaurant_id)
    RETURNING id INTO v_chat_id;

    RETURN v_chat_id;
END;
$$;
