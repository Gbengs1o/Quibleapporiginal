-- Add store_id to food_order_reviews
ALTER TABLE public.food_order_reviews
ADD COLUMN store_id uuid references public.stores(id),
ADD CONSTRAINT check_review_source CHECK (
    (restaurant_id IS NOT NULL AND store_id IS NULL) OR
    (restaurant_id IS NULL AND store_id IS NOT NULL)
);

-- Add store_id to order_chats
ALTER TABLE public.order_chats
ADD COLUMN store_id uuid references public.stores(id),
ADD CONSTRAINT check_chat_source CHECK (
    (restaurant_id IS NOT NULL AND store_id IS NULL) OR
    (restaurant_id IS NULL AND store_id IS NOT NULL)
);
