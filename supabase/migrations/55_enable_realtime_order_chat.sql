-- Enable Realtime for order_chat_messages and order_chats
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_chats;
