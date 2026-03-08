
-- 1. Fix notify_user_status_change with better terminology and action_link
CREATE OR REPLACE FUNCTION notify_user_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_title TEXT;
    v_message TEXT;
    v_is_store BOOLEAN;
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        v_is_store := (NEW.store_id IS NOT NULL);
        
        -- Map titles and messages based on status and vendor type
        CASE NEW.status
            WHEN 'received' THEN
                v_title := 'Order Received';
                v_message := CASE WHEN v_is_store THEN 'The store has received your order.' ELSE 'The restaurant has received your order.' END;
            WHEN 'preparing' THEN
                v_title := CASE WHEN v_is_store THEN 'Order Packing' ELSE 'Meal Preparing' END;
                v_message := CASE WHEN v_is_store THEN 'Your items are being packed.' ELSE 'Your food is being prepared in the kitchen.' END;
            WHEN 'ready' THEN
                v_title := CASE WHEN v_is_store THEN 'Order Ready' ELSE 'Meal Ready' END;
                v_message := CASE WHEN v_is_store THEN 'Your order is ready for pickup.' ELSE 'Your meal is ready and waiting for a rider.' END;
            WHEN 'with_rider' THEN
                v_title := 'On the Way';
                v_message := 'A rider has picked up your order and is heading your way.';
            WHEN 'out_for_delivery' THEN
                v_title := 'Arriving Soon';
                v_message := 'The rider is close to your location!';
            WHEN 'delivered' THEN
                v_title := 'Order Delivered';
                v_message := 'Hope you enjoy your purchase! Please rate your experience.';
            WHEN 'cancelled' THEN
                v_title := 'Order Cancelled';
                v_message := 'Your order has been cancelled.';
            ELSE
                v_title := 'Order Update';
                v_message := 'Your order status is now ' || NEW.status;
        END CASE;

        INSERT INTO public.notifications (user_id, recipient_role, title, message, type, meta_data)
        VALUES (
            NEW.user_id,
            'personal',
            v_title,
            v_message,
            'order_update',
            jsonb_build_object(
                'order_id', NEW.id,
                'action_link', '/order/' || NEW.id,
                'status', NEW.status
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix notify_vendor_new_order to use valid action_link (list view)
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
  n_link := '/' || vendor_type || '/orders'; -- Changed from detail page (404) to list view

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

-- 3. Update Rider notifications with action_link
CREATE OR REPLACE FUNCTION notify_rider_on_invite()
RETURNS TRIGGER AS $$
DECLARE
    v_order RECORD;
    v_source_name TEXT;
    v_is_store BOOLEAN;
    v_title TEXT;
    v_message TEXT;
BEGIN
    IF NEW.status = 'invited' THEN
        SELECT o.id, o.total_amount, o.restaurant_id, o.store_id,
               r.name AS restaurant_name,
               s.name AS store_name
        INTO v_order
        FROM public.orders o
        LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
        LEFT JOIN public.stores s ON s.id = o.store_id
        WHERE o.id = NEW.order_id;

        v_is_store := (v_order.store_id IS NOT NULL);
        v_source_name := COALESCE(
            CASE WHEN v_is_store THEN v_order.store_name ELSE v_order.restaurant_name END,
            CASE WHEN v_is_store THEN 'A store' ELSE 'A restaurant' END
        );

        v_title := CASE WHEN v_is_store THEN '🛍️ New Store Delivery Request!' ELSE '🍔 New Delivery Request!' END;
        v_message := v_source_name || ' wants you to deliver an order (₦' || COALESCE(NEW.amount::text, '0') || ')';

        INSERT INTO public.notifications (user_id, recipient_role, title, message, type, meta_data)
        VALUES (
            NEW.rider_id,
            'personal',
            v_title,
            v_message,
            'delivery',
            jsonb_build_object(
                'order_id', NEW.order_id,
                'bid_id', NEW.id,
                'amount', NEW.amount,
                'source_name', v_source_name,
                'source_type', CASE WHEN v_is_store THEN 'store' ELSE 'restaurant' END,
                'action_link', '/rider/job-preview/' || NEW.order_id || '?amount=' || NEW.amount
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_rider_on_order_assignment()
RETURNS TRIGGER AS $$
DECLARE
    v_source_name TEXT;
    v_is_store BOOLEAN;
BEGIN
    IF OLD.rider_id IS NULL AND NEW.rider_id IS NOT NULL THEN
        v_is_store := (NEW.store_id IS NOT NULL);

        IF v_is_store THEN
            SELECT s.name INTO v_source_name FROM public.stores s WHERE s.id = NEW.store_id;
        ELSE
            SELECT r.name INTO v_source_name FROM public.restaurants r WHERE r.id = NEW.restaurant_id;
        END IF;

        INSERT INTO public.notifications (user_id, recipient_role, title, message, type, meta_data)
        VALUES (
            NEW.rider_id,
            'personal',
            '✅ Delivery Assigned!',
            'You have been assigned to deliver an order from ' || COALESCE(v_source_name, CASE WHEN v_is_store THEN 'a store' ELSE 'a restaurant' END) || '.',
            'delivery',
            jsonb_build_object(
                'order_id', NEW.id,
                'source_name', v_source_name,
                'source_type', CASE WHEN v_is_store THEN 'store' ELSE 'restaurant' END,
                'action_link', '/rider/delivery/' || NEW.id
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
