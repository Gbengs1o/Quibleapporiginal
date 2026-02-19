-- 38_dish_reviews_rpc.sql
CREATE OR REPLACE FUNCTION get_dish_reviews(p_dish_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT jsonb_agg(row_data)
        FROM (
            SELECT jsonb_build_object(
                'id', fir.id,
                'rating', fir.rating,
                'comment', fir.comment,
                'created_at', forv.created_at,
                'reviewer_name', COALESCE(NULLIF(TRIM(p.first_name || ' ' || COALESCE(p.last_name, '')), ''), 'Anonymous'),
                'reviewer_avatar', p.profile_picture_url
            ) as row_data
            FROM public.food_item_reviews fir
            JOIN public.order_items oi ON fir.order_item_id = oi.id
            JOIN public.food_order_reviews forv ON fir.review_id = forv.id
            LEFT JOIN public.profiles p ON forv.reviewer_id = p.id
            WHERE oi.menu_item_id = p_dish_id
            ORDER BY forv.created_at DESC
            LIMIT 20
        ) sub
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_dish_reviews(UUID) TO anon, authenticated;
