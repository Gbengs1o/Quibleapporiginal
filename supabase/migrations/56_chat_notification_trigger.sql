-- Enable Realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to create a notification when a chat message is sent
CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS TRIGGER AS $$
DECLARE
    v_chat RECORD;
    v_sender_name TEXT;
    v_recipient_id UUID;
    v_restaurant_owner_id UUID;
BEGIN
    -- Get chat details
    SELECT oc.customer_id, oc.restaurant_id, oc.order_id
    INTO v_chat
    FROM public.order_chats oc
    WHERE oc.id = NEW.chat_id;

    -- Get sender name
    SELECT COALESCE(first_name || ' ' || last_name, first_name, 'Someone')
    INTO v_sender_name
    FROM public.profiles
    WHERE id = NEW.sender_id;

    -- Get restaurant owner ID
    SELECT owner_id INTO v_restaurant_owner_id
    FROM public.restaurants
    WHERE id = v_chat.restaurant_id;

    -- Determine recipient: if sender is customer, notify restaurant owner; otherwise notify customer
    IF NEW.sender_id = v_chat.customer_id THEN
        v_recipient_id := v_restaurant_owner_id;
    ELSE
        v_recipient_id := v_chat.customer_id;
    END IF;

    -- Don't notify yourself
    IF v_recipient_id IS NOT NULL AND v_recipient_id != NEW.sender_id THEN
        INSERT INTO public.notifications (user_id, title, message, type, meta_data)
        VALUES (
            v_recipient_id,
            'New message from ' || v_sender_name,
            LEFT(NEW.content, 100),
            'chat',
            jsonb_build_object(
                'chat_id', NEW.chat_id,
                'order_id', v_chat.order_id,
                'sender_id', NEW.sender_id
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on order_chat_messages
DROP TRIGGER IF EXISTS on_chat_message_notify ON public.order_chat_messages;
CREATE TRIGGER on_chat_message_notify
    AFTER INSERT ON public.order_chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_chat_message();
