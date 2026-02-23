-- Migration: Fix SECURITY DEFINER for place_order and place_store_order
-- This allows the functions to bypass RLS on wallets table

-- 1. Fix place_store_order
CREATE OR REPLACE FUNCTION place_store_order(
    p_store_id UUID,
    p_total_amount DECIMAL,
    p_items JSONB,
    p_pickup_lat DOUBLE PRECISION DEFAULT NULL,
    p_pickup_lng DOUBLE PRECISION DEFAULT NULL,
    p_dropoff_lat DOUBLE PRECISION DEFAULT NULL,
    p_dropoff_lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- CRITICAL FIX
AS $$
DECLARE
    new_order_id UUID;
    item_record JSONB;
    v_calculated_total DECIMAL := 0;
    v_item_price DECIMAL;
    v_user_wallet_id UUID;
    v_user_balance DECIMAL;
    v_store_owner_id UUID;
    v_store_wallet_id UUID;
    v_service_fee DECIMAL;
    v_delivery_fee DECIMAL;
    v_items_total DECIMAL := 0;
    admin_wallet_id UUID;
BEGIN
    -- 1. Get User Wallet (With Auto-Creation)
    SELECT id, balance INTO v_user_wallet_id, v_user_balance
    FROM public.wallets
    WHERE user_id = auth.uid() AND type = 'personal'
    FOR UPDATE;

    IF v_user_wallet_id IS NULL THEN
        INSERT INTO public.wallets (user_id, type, balance)
        VALUES (auth.uid(), 'personal', 0)
        RETURNING id, balance INTO v_user_wallet_id, v_user_balance;
    END IF;

    -- 2. Validate Items and Calculate Subtotal
    FOR item_record IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT price INTO v_item_price
        FROM public.store_items
        WHERE id = (item_record->>'store_item_id')::UUID;

        IF v_item_price IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'Item not found');
        END IF;

        v_items_total := v_items_total + (v_item_price * (item_record->>'quantity')::INT);
    END LOOP;

    -- 3. Calculate Fees
    -- 10% Service Fee logic as per existing implementation
    v_service_fee := v_items_total * 0.10;
    v_delivery_fee := p_total_amount - v_items_total - v_service_fee;
    v_calculated_total := p_total_amount;

    -- 4. Check Balance
    IF v_user_balance < v_calculated_total THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient balance. Your current balance is ₦' || v_user_balance);
    END IF;

    -- 5. Create Order
    INSERT INTO public.orders (
        user_id, store_id, status, total_amount, pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude
    )
    VALUES (
        auth.uid(), p_store_id, 'received', v_calculated_total, p_pickup_lat, p_pickup_lng, p_dropoff_lat, p_dropoff_lng
    )
    RETURNING id INTO new_order_id;

    -- 6. Create Order Items
    FOR item_record IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (order_id, store_item_id, quantity, price_at_time)
        SELECT new_order_id, (item_record->>'store_item_id')::UUID, (item_record->>'quantity')::INT, price
        FROM public.store_items WHERE id = (item_record->>'store_item_id')::UUID;
    END LOOP;

    -- 7. Deduct from User Wallet
    UPDATE public.wallets SET balance = balance - v_calculated_total, updated_at = NOW() WHERE id = v_user_wallet_id;

    -- 8. Record Transaction for User
    INSERT INTO public.transactions (wallet_id, amount, type, description, location, reference)
    VALUES (v_user_wallet_id, v_calculated_total, 'debit', 'Store Order #' || substring(new_order_id::text, 1, 8), '{}'::jsonb, new_order_id::text);

    -- 9. Credit Store Wallet
    SELECT id INTO v_store_wallet_id FROM public.wallets WHERE store_id = p_store_id AND type = 'business';

    IF v_store_wallet_id IS NULL THEN
        INSERT INTO public.wallets (store_id, type, balance) VALUES (p_store_id, 'business', 0)
        RETURNING id INTO v_store_wallet_id;
    END IF;

    UPDATE public.wallets SET balance = balance + v_items_total, updated_at = NOW() WHERE id = v_store_wallet_id;

    INSERT INTO public.transactions (wallet_id, amount, type, description, location, reference)
    VALUES (v_store_wallet_id, v_items_total, 'credit', 'Order Payout #' || substring(new_order_id::text, 1, 8), '{}'::jsonb, new_order_id::text);

    -- 10. Credit Admin Wallet
    SELECT id INTO admin_wallet_id FROM public.wallets WHERE type = 'admin' LIMIT 1;
    IF admin_wallet_id IS NOT NULL THEN
        UPDATE public.wallets SET balance = balance + v_service_fee, updated_at = now() WHERE id = admin_wallet_id;
        INSERT INTO public.transactions (wallet_id, amount, type, description, location, reference)
        VALUES (admin_wallet_id, v_service_fee, 'credit', 'Service Fee from Store Order', '{}'::jsonb, new_order_id::text);
    END IF;

    RETURN jsonb_build_object('success', true, 'order_id', new_order_id, 'message', 'Order placed successfully');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 2. Fix place_order (The one with 7 arguments used in standard flow)
CREATE OR REPLACE FUNCTION place_order(
    p_restaurant_id UUID,
    p_total_amount DECIMAL,
    p_items JSONB,
    p_pickup_lat DOUBLE PRECISION DEFAULT NULL,
    p_pickup_lng DOUBLE PRECISION DEFAULT NULL,
    p_dropoff_lat DOUBLE PRECISION DEFAULT NULL,
    p_dropoff_lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- CRITICAL FIX
AS $$
DECLARE
    user_wallet_id UUID;
    restaurant_owner_id UUID;
    restaurant_wallet_id UUID;
    admin_wallet_id UUID;

    v_calculated_total DECIMAL := 0;
    v_item_price DECIMAL;
    v_menu_item_id UUID;
    v_quantity INTEGER;

    platform_fee DECIMAL;
    restaurant_share DECIMAL;
    new_order_id UUID;
    item JSONB;
BEGIN
    -- Standard logic followed in 40_food_delivery_payment.sql
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_menu_item_id := (item->>'menu_item_id')::UUID;
        v_quantity := (item->>'quantity')::INTEGER;
        SELECT price INTO v_item_price FROM public.menu_items WHERE id = v_menu_item_id;
        IF v_item_price IS NULL THEN
            RAISE EXCEPTION 'Menu item % not found', v_menu_item_id;
        END IF;
        v_calculated_total := v_calculated_total + (v_item_price * v_quantity);
    END LOOP;

    SELECT id INTO user_wallet_id FROM public.wallets WHERE user_id = auth.uid() AND type = 'personal' FOR UPDATE;
    IF user_wallet_id IS NULL THEN
        INSERT INTO public.wallets (user_id, type, balance) VALUES (auth.uid(), 'personal', 0) RETURNING id INTO user_wallet_id;
    END IF;

    IF (SELECT balance FROM public.wallets WHERE id = user_wallet_id) < v_calculated_total THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    SELECT owner_id INTO restaurant_owner_id FROM public.restaurants WHERE id = p_restaurant_id;
    SELECT id INTO restaurant_wallet_id FROM public.wallets WHERE restaurant_id = p_restaurant_id AND type = 'business';
    
    IF restaurant_wallet_id IS NULL THEN
        INSERT INTO public.wallets (restaurant_id, type, balance) VALUES (p_restaurant_id, 'business', 0) RETURNING id INTO restaurant_wallet_id;
    END IF;

    platform_fee := v_calculated_total * 0.10;
    restaurant_share := v_calculated_total - platform_fee;

    UPDATE public.wallets SET balance = balance - v_calculated_total, updated_at = now() WHERE id = user_wallet_id;
    UPDATE public.wallets SET balance = balance + restaurant_share, updated_at = now() WHERE id = restaurant_wallet_id;

    SELECT id INTO admin_wallet_id FROM public.wallets WHERE type = 'admin' LIMIT 1;
    IF admin_wallet_id IS NOT NULL THEN
        UPDATE public.wallets SET balance = balance + platform_fee, updated_at = now() WHERE id = admin_wallet_id;
        INSERT INTO public.transactions (wallet_id, amount, type, description, reference)
        VALUES (admin_wallet_id, platform_fee, 'credit', 'Platform Fee', new_order_id::text);
    END IF;

    INSERT INTO public.transactions (wallet_id, amount, type, description, reference)
    VALUES (user_wallet_id, v_calculated_total, 'debit', 'Order Payment', new_order_id::text);
    INSERT INTO public.transactions (wallet_id, amount, type, description, reference)
    VALUES (restaurant_wallet_id, restaurant_share, 'credit', 'Order Earnings', new_order_id::text);

    INSERT INTO public.orders (
        user_id, restaurant_id, status, total_amount, pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude
    )
    VALUES (auth.uid(), p_restaurant_id, 'received', v_calculated_total, p_pickup_lat, p_pickup_lng, p_dropoff_lat, p_dropoff_lng)
    RETURNING id INTO new_order_id;

    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (order_id, menu_item_id, quantity, price_at_time, options)
        VALUES (
            new_order_id, 
            (item->>'menu_item_id')::UUID, 
            (item->>'quantity')::INTEGER, 
            (SELECT price FROM public.menu_items WHERE id = (item->>'menu_item_id')::UUID),
            (item->>'options')::TEXT
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'message', 'Order placed successfully', 'order_id', new_order_id);
END;
$$;

-- 3. Update notify_restaurant_new_order trigger to handle stores
CREATE OR REPLACE FUNCTION notify_vendor_new_order()
RETURNS TRIGGER AS $$
DECLARE
  owner_auth_id UUID;
  customer_name TEXT;
  n_title TEXT;
  n_message TEXT;
  n_link TEXT;
  vendor_type TEXT;
BEGIN
  -- Handle Restaurant or Store
  IF NEW.restaurant_id IS NOT NULL THEN
    SELECT owner_id INTO owner_auth_id FROM public.restaurants WHERE id = NEW.restaurant_id;
    vendor_type := 'restaurant';
  ELSIF NEW.store_id IS NOT NULL THEN
    SELECT owner_id INTO owner_auth_id FROM public.stores WHERE id = NEW.store_id;
    vendor_type := 'store';
  END IF;

  IF owner_auth_id IS NULL THEN
      RETURN NEW;
  END IF;

  SELECT first_name || ' ' || LEFT(last_name, 1) || '.' INTO customer_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF customer_name IS NULL THEN
      customer_name := 'A Customer';
  END IF;

  n_title := 'New Order Received';
  n_message := 'New Order! ' || customer_name || ' placed a ₦' || NEW.total_amount || ' order.';
  n_link := '/' || vendor_type || '/orders/' || NEW.id;

  INSERT INTO public.notifications (
      user_id, title, message, type, is_read, meta_data
  ) VALUES (
      owner_auth_id, n_title, n_message, 'order', false,
      jsonb_build_object(
          'color', '#2196F3',
          'icon', CASE WHEN vendor_type = 'restaurant' THEN 'restaurant' ELSE 'storefront' END,
          'action_link', n_link,
          'order_id', NEW.id,
          'vendor_type', vendor_type
      )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Swap the trigger function
DROP TRIGGER IF EXISTS on_new_restaurant_order ON public.orders;
DROP TRIGGER IF EXISTS on_new_order_placed ON public.orders;

CREATE TRIGGER on_new_order_placed
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION notify_vendor_new_order();
