-- 37_dish_stats_view.sql
CREATE OR REPLACE VIEW public.dish_stats AS
SELECT
    mi.id as dish_id,
    COUNT(fir.id) as review_count,
    COALESCE(ROUND(AVG(fir.rating), 1), 0) as average_rating
FROM public.menu_items mi
JOIN public.order_items oi ON mi.id = oi.menu_item_id
JOIN public.food_item_reviews fir ON oi.id = fir.order_item_id
GROUP BY mi.id;

-- Grant access
GRANT SELECT ON public.dish_stats TO anon, authenticated;
