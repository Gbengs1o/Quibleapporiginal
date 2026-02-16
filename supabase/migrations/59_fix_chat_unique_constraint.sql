-- 59_fix_chat_unique_constraint.sql
-- Fix the unique constraint on order_chats to allow multiple chats per order (one per type)

-- Drop the old unique constraint which only allowed one chat per order
ALTER TABLE public.order_chats DROP CONSTRAINT IF EXISTS order_chats_order_id_key;

-- Add a new unique constraint that includes the chat_type
-- This allows (order_1, 'general'), (order_1, 'rider_customer'), etc. to coexist
ALTER TABLE public.order_chats ADD CONSTRAINT order_chats_order_id_type_key UNIQUE (order_id, chat_type);
