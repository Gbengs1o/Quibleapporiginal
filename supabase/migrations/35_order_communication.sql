-- 35_order_communication.sql
-- Order-based chat (customer-restaurant) and review system

-- ============================================================================
-- 1. ADD PHONE TO RESTAURANTS (if not exists)
-- ============================================================================
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- ============================================================================
-- 2. ORDER CHATS (Customer ↔ Restaurant Communication)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL UNIQUE,
    customer_id UUID REFERENCES auth.users(id) NOT NULL,
    restaurant_id UUID REFERENCES public.restaurants(id) NOT NULL,
    last_message TEXT,
    last_message_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Order chat messages
CREATE TABLE IF NOT EXISTS public.order_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES public.order_chats(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES auth.users(id) NOT NULL,
    content TEXT NOT NULL,
    media_url TEXT,
    media_type TEXT DEFAULT 'text', -- 'text', 'image', 'audio'
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_chat_messages ENABLE ROW LEVEL SECURITY;

-- Order Chats RLS Policies
CREATE POLICY "Customer can view their order chats" ON public.order_chats
    FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Restaurant owner can view order chats" ON public.order_chats
    FOR SELECT USING (
        restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    );

CREATE POLICY "System can create order chats" ON public.order_chats
    FOR INSERT WITH CHECK (true);

-- Order Chat Messages RLS Policies
CREATE POLICY "Participants can view order chat messages" ON public.order_chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.order_chats 
            WHERE order_chats.id = order_chat_messages.chat_id 
            AND (order_chats.customer_id = auth.uid() OR 
                 order_chats.restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()))
        )
    );

CREATE POLICY "Participants can insert order chat messages" ON public.order_chat_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.order_chats 
            WHERE order_chats.id = chat_id 
            AND (order_chats.customer_id = auth.uid() OR 
                 order_chats.restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()))
        )
    );

-- ============================================================================
-- 3. FOOD ORDER REVIEWS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.food_order_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL UNIQUE,
    reviewer_id UUID REFERENCES auth.users(id) NOT NULL,
    restaurant_id UUID REFERENCES public.restaurants(id) NOT NULL,
    restaurant_rating INTEGER CHECK (restaurant_rating >= 1 AND restaurant_rating <= 5) NOT NULL,
    restaurant_comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Individual food item ratings within a review
CREATE TABLE IF NOT EXISTS public.food_item_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID REFERENCES public.food_order_reviews(id) ON DELETE CASCADE NOT NULL,
    order_item_id UUID REFERENCES public.order_items(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(review_id, order_item_id)
);

-- Enable RLS
ALTER TABLE public.food_order_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_item_reviews ENABLE ROW LEVEL SECURITY;

-- Reviews Policies (Public read, authenticated insert)
CREATE POLICY "Public can view food order reviews" ON public.food_order_reviews
    FOR SELECT USING (true);

CREATE POLICY "Users can create food order reviews" ON public.food_order_reviews
    FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Public can view food item reviews" ON public.food_item_reviews
    FOR SELECT USING (true);

CREATE POLICY "Users can create item reviews via parent" ON public.food_item_reviews
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.food_order_reviews
            WHERE food_order_reviews.id = review_id
            AND food_order_reviews.reviewer_id = auth.uid()
        )
    );

-- ============================================================================
-- 4. RPC FUNCTIONS
-- ============================================================================

-- Get or create order chat
CREATE OR REPLACE FUNCTION get_or_create_order_chat(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_chat_id UUID;
    v_order RECORD;
BEGIN
    -- Check if chat already exists
    SELECT id INTO v_chat_id
    FROM public.order_chats
    WHERE order_id = p_order_id;

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

    -- Create new chat
    INSERT INTO public.order_chats (order_id, customer_id, restaurant_id)
    VALUES (p_order_id, v_order.user_id, v_order.restaurant_id)
    RETURNING id INTO v_chat_id;

    RETURN v_chat_id;
END;
$$;

-- Submit order review (with optional item reviews)
CREATE OR REPLACE FUNCTION submit_order_review(
    p_order_id UUID,
    p_restaurant_rating INTEGER,
    p_restaurant_comment TEXT DEFAULT NULL,
    p_item_reviews JSONB DEFAULT '[]'::JSONB -- Array of { order_item_id, rating, comment }
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_review_id UUID;
    v_order RECORD;
    v_item JSONB;
BEGIN
    -- Validate order exists and is delivered
    SELECT id, user_id, restaurant_id, status INTO v_order
    FROM public.orders
    WHERE id = p_order_id;

    IF v_order IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    IF v_order.user_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'You can only review your own orders');
    END IF;

    IF v_order.status != 'delivered' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Can only review delivered orders');
    END IF;

    -- Check if already reviewed
    IF EXISTS (SELECT 1 FROM public.food_order_reviews WHERE order_id = p_order_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order already reviewed');
    END IF;

    -- Create main review
    INSERT INTO public.food_order_reviews (order_id, reviewer_id, restaurant_id, restaurant_rating, restaurant_comment)
    VALUES (p_order_id, auth.uid(), v_order.restaurant_id, p_restaurant_rating, p_restaurant_comment)
    RETURNING id INTO v_review_id;

    -- Create item reviews
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_item_reviews)
    LOOP
        INSERT INTO public.food_item_reviews (review_id, order_item_id, rating, comment)
        VALUES (
            v_review_id,
            (v_item->>'order_item_id')::UUID,
            (v_item->>'rating')::INTEGER,
            v_item->>'comment'
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'message', 'Review submitted successfully', 'review_id', v_review_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Get restaurant average rating from food order reviews
CREATE OR REPLACE FUNCTION get_restaurant_food_rating(p_restaurant_id UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(ROUND(AVG(restaurant_rating), 1), 0)
        FROM public.food_order_reviews
        WHERE restaurant_id = p_restaurant_id
    );
END;
$$;

-- Get review for a specific order (if exists)
CREATE OR REPLACE FUNCTION get_order_review(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_review RECORD;
    v_items JSONB;
BEGIN
    SELECT * INTO v_review
    FROM public.food_order_reviews
    WHERE order_id = p_order_id;

    IF v_review IS NULL THEN
        RETURN NULL;
    END IF;

    -- Get item reviews
    SELECT jsonb_agg(jsonb_build_object(
        'order_item_id', order_item_id,
        'rating', rating,
        'comment', comment
    )) INTO v_items
    FROM public.food_item_reviews
    WHERE review_id = v_review.id;

    RETURN jsonb_build_object(
        'id', v_review.id,
        'restaurant_rating', v_review.restaurant_rating,
        'restaurant_comment', v_review.restaurant_comment,
        'created_at', v_review.created_at,
        'item_reviews', COALESCE(v_items, '[]'::JSONB)
    );
END;
$$;
