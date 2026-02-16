-- ============================================================================
-- UPDATE policy for order_chats: participants can update last_message
-- ============================================================================
CREATE POLICY "Participants can update order chats" ON public.order_chats
    FOR UPDATE USING (
        customer_id = auth.uid() OR
        restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_chats.order_id AND orders.rider_id = auth.uid()
        )
    )
    WITH CHECK (
        customer_id = auth.uid() OR
        restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_chats.order_id AND orders.rider_id = auth.uid()
        )
    );

-- ============================================================================
-- UPDATE policy for order_chat_messages: participants can update is_read
-- ============================================================================
CREATE POLICY "Participants can update order chat messages" ON public.order_chat_messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.order_chats
            WHERE order_chats.id = order_chat_messages.chat_id
            AND (
                order_chats.customer_id = auth.uid() OR
                order_chats.restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()) OR
                EXISTS (
                    SELECT 1 FROM public.orders
                    WHERE orders.id = order_chats.order_id AND orders.rider_id = auth.uid()
                )
            )
        )
    );
