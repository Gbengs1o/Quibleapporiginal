-- 36_fix_review_rls.sql
-- Allow restaurant owners to update reviews (specifically for marking as viewed)

-- Drop existing update policy if it exists (it likely doesn't, but for safety)
DROP POLICY IF EXISTS "Restaurant owner can update reviews" ON public.food_order_reviews;

-- Create new policy
CREATE POLICY "Restaurant owner can update reviews" ON public.food_order_reviews
    FOR UPDATE
    USING (
        restaurant_id IN (
            SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
        )
    )
    WITH CHECK (
        restaurant_id IN (
            SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
        )
    );
