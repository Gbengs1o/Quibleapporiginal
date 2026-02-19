-- 1. Add Foreign Key from orders.user_id to public.profiles.id
-- This allows easy embedding of customer profiles in order queries
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_orders_profiles' 
        AND table_name = 'orders'
    ) THEN
        ALTER TABLE public.orders 
        ADD CONSTRAINT fk_orders_profiles 
        FOREIGN KEY (user_id) 
        REFERENCES public.profiles(id);
    END IF;
END $$;
