-- 58_update_chat_rls.sql
-- Restrict access to order_chats and order_chat_messages based on chat_type

-- ============================================================================
-- 1. ORDER CHATS POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Customer can view their order chats" ON public.order_chats;
DROP POLICY IF EXISTS "Restaurant owner can view order chats" ON public.order_chats;
DROP POLICY IF EXISTS "Rider can view order chats for assigned orders" ON public.order_chats;
DROP POLICY IF EXISTS "Rider can create order chats for assigned orders" ON public.order_chats;

-- Customer Policy
CREATE POLICY "Customer can view their order chats" ON public.order_chats
    FOR SELECT USING (
        auth.uid() = customer_id
        AND chat_type IN ('general', 'rider_customer')
    );

-- Restaurant Policy
CREATE POLICY "Restaurant owner can view order chats" ON public.order_chats
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.restaurants
            WHERE id = order_chats.restaurant_id
            AND owner_id = auth.uid()
        )
        AND chat_type IN ('general', 'rider_restaurant')
    );

-- Rider Policy (View)
CREATE POLICY "Rider can view order chats for assigned orders" ON public.order_chats
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_chats.order_id
            AND orders.rider_id = auth.uid()
        )
        AND chat_type IN ('rider_customer', 'rider_restaurant')
    );

-- Rider Policy (Insert)
CREATE POLICY "Rider can create order chats for assigned orders" ON public.order_chats
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_id
            AND orders.rider_id = auth.uid()
        )
        AND chat_type IN ('rider_customer', 'rider_restaurant')
    );


-- ============================================================================
-- 2. ORDER CHAT MESSAGES POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Participants can view order chat messages" ON public.order_chat_messages;
DROP POLICY IF EXISTS "Participants can insert order chat messages" ON public.order_chat_messages;
DROP POLICY IF EXISTS "Participants can update order chat messages" ON public.order_chat_messages;

DROP POLICY IF EXISTS "Rider can view order chat messages" ON public.order_chat_messages;
DROP POLICY IF EXISTS "Rider can send order chat messages" ON public.order_chat_messages;
-- Drop legacy if any
DROP POLICY IF EXISTS "Customer can view order chat messages" ON public.order_chat_messages;
DROP POLICY IF EXISTS "Restaurant can view order chat messages" ON public.order_chat_messages;

-- Re-create Rider policies
CREATE POLICY "Rider can view order chat messages" ON public.order_chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.order_chats
            JOIN public.orders ON orders.id = order_chats.order_id
            WHERE order_chats.id = order_chat_messages.chat_id
            AND orders.rider_id = auth.uid()
            AND order_chats.chat_type IN ('rider_customer', 'rider_restaurant')
        )
    );

CREATE POLICY "Rider can send order chat messages" ON public.order_chat_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.order_chats
            JOIN public.orders ON orders.id = order_chats.order_id
            WHERE order_chats.id = chat_id
            AND orders.rider_id = auth.uid()
            AND order_chats.chat_type IN ('rider_customer', 'rider_restaurant')
        )
    );

-- Re-create Customer policies (View/Send)
CREATE POLICY "Customer can view order chat messages" ON public.order_chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.order_chats
            WHERE order_chats.id = order_chat_messages.chat_id
            AND order_chats.customer_id = auth.uid()
            AND order_chats.chat_type IN ('general', 'rider_customer')
        )
    );

CREATE POLICY "Customer can send order chat messages" ON public.order_chat_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.order_chats
            WHERE order_chats.id = chat_id
            AND order_chats.customer_id = auth.uid()
            AND order_chats.chat_type IN ('general', 'rider_customer')
        )
    );

-- Re-create Restaurant policies (View/Send)
CREATE POLICY "Restaurant can view order chat messages" ON public.order_chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.order_chats
            JOIN public.restaurants ON restaurants.id = order_chats.restaurant_id
            WHERE order_chats.id = order_chat_messages.chat_id
            AND restaurants.owner_id = auth.uid()
            AND order_chats.chat_type IN ('general', 'rider_restaurant')
        )
    );

CREATE POLICY "Restaurant can send order chat messages" ON public.order_chat_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.order_chats
            JOIN public.restaurants ON restaurants.id = order_chats.restaurant_id
            WHERE order_chats.id = chat_id
            AND restaurants.owner_id = auth.uid()
            AND order_chats.chat_type IN ('general', 'rider_restaurant')
        )
    );
