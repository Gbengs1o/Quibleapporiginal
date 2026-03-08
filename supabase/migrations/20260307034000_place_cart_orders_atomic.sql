-- Atomic mixed-cart checkout for restaurant + store orders.
-- Uses existing place_order/place_store_order logic per vendor, but wraps
-- the full cart in one transaction so either all orders succeed or none do.

CREATE OR REPLACE FUNCTION public.place_cart_orders(p_orders JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order JSONB;
    v_result JSONB;
    v_vendor_type TEXT;
    v_order_id UUID;
    v_order_ids UUID[] := '{}';
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Authentication required');
    END IF;

    IF p_orders IS NULL OR jsonb_typeof(p_orders) <> 'array' OR jsonb_array_length(p_orders) = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No orders provided');
    END IF;

    FOR v_order IN SELECT * FROM jsonb_array_elements(p_orders)
    LOOP
        IF jsonb_typeof(v_order->'items') <> 'array' OR jsonb_array_length(v_order->'items') = 0 THEN
            RAISE EXCEPTION 'Each vendor order must include at least one item';
        END IF;

        v_vendor_type := lower(coalesce(v_order->>'vendor_type', ''));

        IF v_vendor_type = 'restaurant' THEN
            v_result := public.place_order(
                p_restaurant_id => (v_order->>'vendor_id')::UUID,
                p_total_amount => coalesce((v_order->>'total_amount')::DECIMAL, 0),
                p_items => coalesce(v_order->'items', '[]'::jsonb),
                p_pickup_lat => NULLIF(v_order->>'pickup_lat', '')::DOUBLE PRECISION,
                p_pickup_lng => NULLIF(v_order->>'pickup_lng', '')::DOUBLE PRECISION,
                p_dropoff_lat => NULLIF(v_order->>'dropoff_lat', '')::DOUBLE PRECISION,
                p_dropoff_lng => NULLIF(v_order->>'dropoff_lng', '')::DOUBLE PRECISION,
                p_delivery_fee => coalesce((v_order->>'delivery_fee')::DECIMAL, 0)
            );
        ELSIF v_vendor_type = 'store' THEN
            v_result := public.place_store_order(
                p_store_id => (v_order->>'vendor_id')::UUID,
                p_total_amount => coalesce((v_order->>'total_amount')::DECIMAL, 0),
                p_items => coalesce(v_order->'items', '[]'::jsonb),
                p_pickup_lat => NULLIF(v_order->>'pickup_lat', '')::DOUBLE PRECISION,
                p_pickup_lng => NULLIF(v_order->>'pickup_lng', '')::DOUBLE PRECISION,
                p_dropoff_lat => NULLIF(v_order->>'dropoff_lat', '')::DOUBLE PRECISION,
                p_dropoff_lng => NULLIF(v_order->>'dropoff_lng', '')::DOUBLE PRECISION,
                p_delivery_fee => coalesce((v_order->>'delivery_fee')::DECIMAL, 0)
            );
        ELSE
            RAISE EXCEPTION 'Unsupported vendor type: %', v_vendor_type;
        END IF;

        IF coalesce((v_result->>'success')::BOOLEAN, false) = false THEN
            RAISE EXCEPTION '%', coalesce(v_result->>'message', 'Failed to place order');
        END IF;

        v_order_id := (v_result->>'order_id')::UUID;
        v_order_ids := array_append(v_order_ids, v_order_id);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Orders placed successfully',
        'order_ids', to_jsonb(v_order_ids),
        'count', cardinality(v_order_ids)
    );

EXCEPTION WHEN OTHERS THEN
    -- The exception rolls back the entire function transaction scope.
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_cart_orders(JSONB) TO authenticated;
