-- ============================================================================
-- Fix Store Chat + Store Review Support
-- - Enables store order chat parity (customer/store/rider)
-- - Makes order reviews work for both restaurant and store orders
-- ============================================================================

-- 1) Schema parity (store source support)
ALTER TABLE public.order_chats
    ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id),
    ADD COLUMN IF NOT EXISTS chat_type TEXT DEFAULT 'general';

ALTER TABLE public.food_order_reviews
    ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id);

-- Restaurant/store source columns must allow one-or-the-other
ALTER TABLE public.order_chats
    ALTER COLUMN restaurant_id DROP NOT NULL;

ALTER TABLE public.food_order_reviews
    ALTER COLUMN restaurant_id DROP NOT NULL;

-- Normalize legacy rows
UPDATE public.order_chats
SET chat_type = 'general'
WHERE chat_type IS NULL;

-- Keep one chat per (order, chat_type)
ALTER TABLE public.order_chats
    DROP CONSTRAINT IF EXISTS order_chats_order_id_key;

DO $$
BEGIN
    ALTER TABLE public.order_chats
        ADD CONSTRAINT order_chats_order_id_type_key UNIQUE (order_id, chat_type);
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- Ensure source check constraints are present and accurate
ALTER TABLE public.order_chats
    DROP CONSTRAINT IF EXISTS check_chat_source;

DO $$
BEGIN
    ALTER TABLE public.order_chats
        ADD CONSTRAINT check_chat_source CHECK (
            (restaurant_id IS NOT NULL AND store_id IS NULL) OR
            (restaurant_id IS NULL AND store_id IS NOT NULL)
        );
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

ALTER TABLE public.food_order_reviews
    DROP CONSTRAINT IF EXISTS check_review_source;

DO $$
BEGIN
    ALTER TABLE public.food_order_reviews
        ADD CONSTRAINT check_review_source CHECK (
            (restaurant_id IS NOT NULL AND store_id IS NULL) OR
            (restaurant_id IS NULL AND store_id IS NOT NULL)
        );
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- 2) Chat RPCs (store + restaurant parity)
CREATE OR REPLACE FUNCTION public.get_or_create_order_chat(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_chat_id UUID;
    v_order RECORD;
    v_is_authorized BOOLEAN := false;
BEGIN
    SELECT id, user_id, restaurant_id, store_id
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id;

    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Customer can open general chat
    IF v_order.user_id = auth.uid() THEN
        v_is_authorized := true;
    END IF;

    -- Restaurant owner can open general chat
    IF NOT v_is_authorized AND v_order.restaurant_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.restaurants r
            WHERE r.id = v_order.restaurant_id
              AND r.owner_id = auth.uid()
        ) INTO v_is_authorized;
    END IF;

    -- Store owner can open general chat
    IF NOT v_is_authorized AND v_order.store_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.stores s
            WHERE s.id = v_order.store_id
              AND s.owner_id = auth.uid()
        ) INTO v_is_authorized;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Not authorized to access this order chat';
    END IF;

    SELECT id
    INTO v_chat_id
    FROM public.order_chats
    WHERE order_id = p_order_id
      AND chat_type = 'general'
    LIMIT 1;

    IF v_chat_id IS NOT NULL THEN
        RETURN v_chat_id;
    END IF;

    INSERT INTO public.order_chats (order_id, customer_id, restaurant_id, store_id, chat_type)
    VALUES (p_order_id, v_order.user_id, v_order.restaurant_id, v_order.store_id, 'general')
    RETURNING id INTO v_chat_id;

    RETURN v_chat_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_customer_order_chat(
    p_order_id UUID,
    p_chat_type TEXT DEFAULT 'rider_customer'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_chat_id UUID;
    v_order RECORD;
BEGIN
    IF p_chat_type <> 'rider_customer' THEN
        RAISE EXCEPTION 'Invalid chat type for customer flow: %', p_chat_type;
    END IF;

    SELECT id, user_id, restaurant_id, store_id, rider_id
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id;

    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF auth.uid() <> v_order.user_id AND auth.uid() <> v_order.rider_id THEN
        RAISE EXCEPTION 'Not authorized to access rider-customer chat';
    END IF;

    SELECT id
    INTO v_chat_id
    FROM public.order_chats
    WHERE order_id = p_order_id
      AND chat_type = p_chat_type
    LIMIT 1;

    IF v_chat_id IS NOT NULL THEN
        RETURN v_chat_id;
    END IF;

    INSERT INTO public.order_chats (order_id, customer_id, restaurant_id, store_id, chat_type)
    VALUES (p_order_id, v_order.user_id, v_order.restaurant_id, v_order.store_id, p_chat_type)
    RETURNING id INTO v_chat_id;

    RETURN v_chat_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_rider_order_chat(
    p_order_id UUID,
    p_chat_type TEXT DEFAULT 'rider_restaurant'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_chat_id UUID;
    v_order RECORD;
    v_is_rider BOOLEAN := false;
    v_is_restaurant_owner BOOLEAN := false;
    v_is_store_owner BOOLEAN := false;
BEGIN
    IF p_chat_type NOT IN ('rider_customer', 'rider_restaurant', 'rider_store') THEN
        RAISE EXCEPTION 'Invalid chat type: %', p_chat_type;
    END IF;

    SELECT id, user_id, restaurant_id, store_id, rider_id
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id;

    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    v_is_rider := (v_order.rider_id = auth.uid());

    IF v_order.restaurant_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.restaurants r
            WHERE r.id = v_order.restaurant_id
              AND r.owner_id = auth.uid()
        ) INTO v_is_restaurant_owner;
    END IF;

    IF v_order.store_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.stores s
            WHERE s.id = v_order.store_id
              AND s.owner_id = auth.uid()
        ) INTO v_is_store_owner;
    END IF;

    IF NOT (v_is_rider OR v_is_restaurant_owner OR v_is_store_owner) THEN
        RAISE EXCEPTION 'Not authorized to access rider order chat';
    END IF;

    -- Owners should only open rider chat that matches their business type
    IF NOT v_is_rider THEN
        IF p_chat_type = 'rider_customer' THEN
            RAISE EXCEPTION 'Business owners cannot open rider-customer chat';
        END IF;
        IF p_chat_type = 'rider_restaurant' AND NOT v_is_restaurant_owner THEN
            RAISE EXCEPTION 'Not authorized for restaurant rider chat';
        END IF;
        IF p_chat_type = 'rider_store' AND NOT v_is_store_owner THEN
            RAISE EXCEPTION 'Not authorized for store rider chat';
        END IF;
    END IF;

    IF p_chat_type = 'rider_restaurant' AND v_order.restaurant_id IS NULL THEN
        RAISE EXCEPTION 'Order is not a restaurant order';
    END IF;
    IF p_chat_type = 'rider_store' AND v_order.store_id IS NULL THEN
        RAISE EXCEPTION 'Order is not a store order';
    END IF;

    SELECT id
    INTO v_chat_id
    FROM public.order_chats
    WHERE order_id = p_order_id
      AND chat_type = p_chat_type
    LIMIT 1;

    IF v_chat_id IS NOT NULL THEN
        RETURN v_chat_id;
    END IF;

    INSERT INTO public.order_chats (order_id, customer_id, restaurant_id, store_id, chat_type)
    VALUES (p_order_id, v_order.user_id, v_order.restaurant_id, v_order.store_id, p_chat_type)
    RETURNING id INTO v_chat_id;

    RETURN v_chat_id;
END;
$$;

-- 3) Review RPCs (store + restaurant parity)
CREATE OR REPLACE FUNCTION public.submit_order_review(
    p_order_id UUID,
    p_restaurant_rating INTEGER,
    p_restaurant_comment TEXT DEFAULT NULL,
    p_item_reviews JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_review_id UUID;
    v_order RECORD;
    v_item JSONB;
    v_order_item_id UUID;
    v_item_rating INTEGER;
BEGIN
    SELECT id, user_id, restaurant_id, store_id, status
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id;

    IF v_order IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    IF v_order.user_id <> auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'You can only review your own orders');
    END IF;

    IF v_order.status <> 'delivered' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Can only review delivered orders');
    END IF;

    IF p_restaurant_rating IS NULL OR p_restaurant_rating < 1 OR p_restaurant_rating > 5 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Rating must be between 1 and 5');
    END IF;

    IF EXISTS (SELECT 1 FROM public.food_order_reviews WHERE order_id = p_order_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order already reviewed');
    END IF;

    INSERT INTO public.food_order_reviews (
        order_id,
        reviewer_id,
        restaurant_id,
        store_id,
        restaurant_rating,
        restaurant_comment
    )
    VALUES (
        p_order_id,
        auth.uid(),
        v_order.restaurant_id,
        v_order.store_id,
        p_restaurant_rating,
        p_restaurant_comment
    )
    RETURNING id INTO v_review_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_item_reviews, '[]'::JSONB))
    LOOP
        v_order_item_id := NULL;
        v_item_rating := NULL;

        BEGIN
            v_order_item_id := (v_item->>'order_item_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_order_item_id := NULL;
        END;

        BEGIN
            v_item_rating := (v_item->>'rating')::INTEGER;
        EXCEPTION WHEN OTHERS THEN
            v_item_rating := NULL;
        END;

        IF v_order_item_id IS NULL THEN
            CONTINUE;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM public.order_items oi
            WHERE oi.id = v_order_item_id
              AND oi.order_id = p_order_id
        ) THEN
            CONTINUE;
        END IF;

        IF v_item_rating IS NOT NULL AND (v_item_rating < 1 OR v_item_rating > 5) THEN
            v_item_rating := NULL;
        END IF;

        INSERT INTO public.food_item_reviews (review_id, order_item_id, rating, comment)
        VALUES (
            v_review_id,
            v_order_item_id,
            v_item_rating,
            NULLIF(v_item->>'comment', '')
        )
        ON CONFLICT (review_id, order_item_id)
        DO UPDATE SET
            rating = EXCLUDED.rating,
            comment = EXCLUDED.comment;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'message', 'Review submitted successfully', 'review_id', v_review_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_order_review(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_review RECORD;
    v_items JSONB;
BEGIN
    SELECT *
    INTO v_review
    FROM public.food_order_reviews
    WHERE order_id = p_order_id;

    IF v_review IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT jsonb_agg(jsonb_build_object(
        'order_item_id', order_item_id,
        'rating', rating,
        'comment', comment
    ))
    INTO v_items
    FROM public.food_item_reviews
    WHERE review_id = v_review.id;

    RETURN jsonb_build_object(
        'id', v_review.id,
        'restaurant_rating', v_review.restaurant_rating,
        'restaurant_comment', v_review.restaurant_comment,
        'store_id', v_review.store_id,
        'vendor_type', CASE WHEN v_review.store_id IS NOT NULL THEN 'store' ELSE 'restaurant' END,
        'created_at', v_review.created_at,
        'item_reviews', COALESCE(v_items, '[]'::JSONB)
    );
END;
$$;

-- 4) Chat RLS policies with store parity
DROP POLICY IF EXISTS "Customer can view their order chats" ON public.order_chats;
DROP POLICY IF EXISTS "Restaurant owner can view order chats" ON public.order_chats;
DROP POLICY IF EXISTS "Store owner can view order chats" ON public.order_chats;
DROP POLICY IF EXISTS "Rider can view order chats for assigned orders" ON public.order_chats;
DROP POLICY IF EXISTS "Rider can create order chats for assigned orders" ON public.order_chats;
DROP POLICY IF EXISTS "Participants can update order chats" ON public.order_chats;

CREATE POLICY "Customer can view their order chats" ON public.order_chats
    FOR SELECT USING (
        auth.uid() = customer_id
        AND chat_type IN ('general', 'rider_customer')
    );

CREATE POLICY "Restaurant owner can view order chats" ON public.order_chats
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.restaurants r
            WHERE r.id = order_chats.restaurant_id
              AND r.owner_id = auth.uid()
        )
        AND chat_type IN ('general', 'rider_restaurant')
    );

CREATE POLICY "Store owner can view order chats" ON public.order_chats
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.stores s
            WHERE s.id = order_chats.store_id
              AND s.owner_id = auth.uid()
        )
        AND chat_type IN ('general', 'rider_store')
    );

CREATE POLICY "Rider can view order chats for assigned orders" ON public.order_chats
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.orders o
            WHERE o.id = order_chats.order_id
              AND o.rider_id = auth.uid()
        )
        AND chat_type IN ('rider_customer', 'rider_restaurant', 'rider_store')
    );

CREATE POLICY "Rider can create order chats for assigned orders" ON public.order_chats
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.orders o
            WHERE o.id = order_id
              AND o.rider_id = auth.uid()
        )
        AND chat_type IN ('rider_customer', 'rider_restaurant', 'rider_store')
    );

CREATE POLICY "Participants can update order chats" ON public.order_chats
    FOR UPDATE USING (
        customer_id = auth.uid()
        OR restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
        OR store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
        OR EXISTS (
            SELECT 1
            FROM public.orders o
            WHERE o.id = order_chats.order_id
              AND o.rider_id = auth.uid()
        )
    )
    WITH CHECK (
        customer_id = auth.uid()
        OR restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
        OR store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
        OR EXISTS (
            SELECT 1
            FROM public.orders o
            WHERE o.id = order_chats.order_id
              AND o.rider_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Participants can view order chat messages" ON public.order_chat_messages;
DROP POLICY IF EXISTS "Participants can insert order chat messages" ON public.order_chat_messages;
DROP POLICY IF EXISTS "Participants can update order chat messages" ON public.order_chat_messages;
DROP POLICY IF EXISTS "Rider can view order chat messages" ON public.order_chat_messages;
DROP POLICY IF EXISTS "Rider can send order chat messages" ON public.order_chat_messages;
DROP POLICY IF EXISTS "Customer can view order chat messages" ON public.order_chat_messages;
DROP POLICY IF EXISTS "Customer can send order chat messages" ON public.order_chat_messages;
DROP POLICY IF EXISTS "Restaurant can view order chat messages" ON public.order_chat_messages;
DROP POLICY IF EXISTS "Restaurant can send order chat messages" ON public.order_chat_messages;
DROP POLICY IF EXISTS "Store can view order chat messages" ON public.order_chat_messages;
DROP POLICY IF EXISTS "Store can send order chat messages" ON public.order_chat_messages;

CREATE POLICY "Rider can view order chat messages" ON public.order_chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.order_chats oc
            JOIN public.orders o ON o.id = oc.order_id
            WHERE oc.id = order_chat_messages.chat_id
              AND o.rider_id = auth.uid()
              AND oc.chat_type IN ('rider_customer', 'rider_restaurant', 'rider_store')
        )
    );

CREATE POLICY "Rider can send order chat messages" ON public.order_chat_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1
            FROM public.order_chats oc
            JOIN public.orders o ON o.id = oc.order_id
            WHERE oc.id = chat_id
              AND o.rider_id = auth.uid()
              AND oc.chat_type IN ('rider_customer', 'rider_restaurant', 'rider_store')
        )
    );

CREATE POLICY "Customer can view order chat messages" ON public.order_chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.order_chats oc
            WHERE oc.id = order_chat_messages.chat_id
              AND oc.customer_id = auth.uid()
              AND oc.chat_type IN ('general', 'rider_customer')
        )
    );

CREATE POLICY "Customer can send order chat messages" ON public.order_chat_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1
            FROM public.order_chats oc
            WHERE oc.id = chat_id
              AND oc.customer_id = auth.uid()
              AND oc.chat_type IN ('general', 'rider_customer')
        )
    );

CREATE POLICY "Restaurant can view order chat messages" ON public.order_chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.order_chats oc
            JOIN public.restaurants r ON r.id = oc.restaurant_id
            WHERE oc.id = order_chat_messages.chat_id
              AND r.owner_id = auth.uid()
              AND oc.chat_type IN ('general', 'rider_restaurant')
        )
    );

CREATE POLICY "Restaurant can send order chat messages" ON public.order_chat_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1
            FROM public.order_chats oc
            JOIN public.restaurants r ON r.id = oc.restaurant_id
            WHERE oc.id = chat_id
              AND r.owner_id = auth.uid()
              AND oc.chat_type IN ('general', 'rider_restaurant')
        )
    );

CREATE POLICY "Store can view order chat messages" ON public.order_chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.order_chats oc
            JOIN public.stores s ON s.id = oc.store_id
            WHERE oc.id = order_chat_messages.chat_id
              AND s.owner_id = auth.uid()
              AND oc.chat_type IN ('general', 'rider_store')
        )
    );

CREATE POLICY "Store can send order chat messages" ON public.order_chat_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1
            FROM public.order_chats oc
            JOIN public.stores s ON s.id = oc.store_id
            WHERE oc.id = chat_id
              AND s.owner_id = auth.uid()
              AND oc.chat_type IN ('general', 'rider_store')
        )
    );

CREATE POLICY "Participants can update order chat messages" ON public.order_chat_messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1
            FROM public.order_chats oc
            WHERE oc.id = order_chat_messages.chat_id
              AND (
                  oc.customer_id = auth.uid()
                  OR oc.restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
                  OR oc.store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
                  OR EXISTS (
                      SELECT 1
                      FROM public.orders o
                      WHERE o.id = oc.order_id
                        AND o.rider_id = auth.uid()
                  )
              )
        )
    );

-- 5) Review update policy (store + restaurant owners can mark viewed)
DROP POLICY IF EXISTS "Restaurant owner can update reviews" ON public.food_order_reviews;
DROP POLICY IF EXISTS "Business owner can update reviews" ON public.food_order_reviews;

CREATE POLICY "Business owner can update reviews" ON public.food_order_reviews
    FOR UPDATE USING (
        restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
        OR store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
    )
    WITH CHECK (
        restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
        OR store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
    );

-- 6) Chat notification routing parity (store + rider_store support)
CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_chat RECORD;
    v_sender_name TEXT;
    v_recipient_id UUID;
    v_restaurant_owner_id UUID;
    v_store_owner_id UUID;
    v_rider_id UUID;
BEGIN
    SELECT oc.customer_id, oc.restaurant_id, oc.store_id, oc.order_id, oc.chat_type
    INTO v_chat
    FROM public.order_chats oc
    WHERE oc.id = NEW.chat_id;

    IF v_chat IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(first_name || ' ' || last_name, first_name, 'Someone')
    INTO v_sender_name
    FROM public.profiles
    WHERE id = NEW.sender_id;

    SELECT owner_id INTO v_restaurant_owner_id
    FROM public.restaurants
    WHERE id = v_chat.restaurant_id;

    SELECT owner_id INTO v_store_owner_id
    FROM public.stores
    WHERE id = v_chat.store_id;

    SELECT rider_id INTO v_rider_id
    FROM public.orders
    WHERE id = v_chat.order_id;

    v_recipient_id := NULL;

    IF v_chat.chat_type = 'rider_customer' THEN
        IF NEW.sender_id = v_chat.customer_id THEN
            v_recipient_id := v_rider_id;
        ELSIF v_rider_id IS NOT NULL AND NEW.sender_id = v_rider_id THEN
            v_recipient_id := v_chat.customer_id;
        END IF;

    ELSIF v_chat.chat_type = 'rider_restaurant' THEN
        IF NEW.sender_id = v_restaurant_owner_id THEN
            v_recipient_id := v_rider_id;
        ELSIF v_rider_id IS NOT NULL AND NEW.sender_id = v_rider_id THEN
            v_recipient_id := v_restaurant_owner_id;
        END IF;

    ELSIF v_chat.chat_type = 'rider_store' THEN
        IF NEW.sender_id = v_store_owner_id THEN
            v_recipient_id := v_rider_id;
        ELSIF v_rider_id IS NOT NULL AND NEW.sender_id = v_rider_id THEN
            v_recipient_id := v_store_owner_id;
        END IF;

    ELSE
        -- General customer <-> business chat
        IF NEW.sender_id = v_chat.customer_id THEN
            v_recipient_id := COALESCE(v_restaurant_owner_id, v_store_owner_id);
        ELSE
            v_recipient_id := v_chat.customer_id;
        END IF;
    END IF;

    IF v_recipient_id IS NOT NULL AND v_recipient_id <> NEW.sender_id THEN
        INSERT INTO public.notifications (user_id, title, message, type, meta_data)
        VALUES (
            v_recipient_id,
            'New message from ' || COALESCE(v_sender_name, 'Someone'),
            LEFT(COALESCE(NEW.content, ''), 100),
            'chat',
            jsonb_build_object(
                'chat_id', NEW.chat_id,
                'order_id', v_chat.order_id,
                'sender_id', NEW.sender_id,
                'action_link', '/order-chat/' || NEW.chat_id
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

