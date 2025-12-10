-- 1. Create Order Status Enum
CREATE TYPE order_status AS ENUM (
  'received', 
  'preparing', 
  'ready', 
  'with_rider', 
  'delivered', 
  'cancelled'
);

-- 2. Create Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    restaurant_id UUID REFERENCES public.restaurants(id) NOT NULL,
    status order_status DEFAULT 'received',
    total_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create Order Items Table
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    menu_item_id UUID REFERENCES public.menu_items(id) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_time DECIMAL(10,2) NOT NULL,
    options TEXT, -- For sides, notes, etc.
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 5. Policies
-- Users can view their own orders
CREATE POLICY "Users can view own orders" ON public.orders
    FOR SELECT USING (auth.uid() = user_id);

-- Restaurant owners can view orders for their restaurant
CREATE POLICY "Owners can view restaurant orders" ON public.orders
    FOR ALL USING (
        restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    );

-- Users can view their own order items
CREATE POLICY "Users can view own order items" ON public.order_items
    FOR SELECT USING (
        order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid())
    );

-- Owners can view items for their restaurant orders
CREATE POLICY "Owners can view restaurant order items" ON public.order_items
    FOR SELECT USING (
        order_id IN (SELECT id FROM public.orders WHERE 
            restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
        )
    );

-- 6. Atomic Place Order RPC
CREATE OR REPLACE FUNCTION place_order(
    p_restaurant_id UUID,
    p_total_amount DECIMAL,
    p_items JSONB -- Array of { menu_item_id, quantity, price, options }
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_wallet_id UUID;
    user_balance DECIMAL;
    restaurant_owner_id UUID;
    restaurant_wallet_id UUID;
    admin_wallet_id UUID;
    
    platform_fee DECIMAL;
    restaurant_share DECIMAL;
    new_order_id UUID;
    item JSONB;
BEGIN
    -- 1. Validate User Funds
    SELECT id, balance INTO user_wallet_id, user_balance
    FROM public.wallets
    WHERE user_id = auth.uid() AND type = 'personal';

    IF user_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Personal wallet not found';
    END IF;

    IF user_balance < p_total_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- 2. Validate Restaurant (Check existence)
    SELECT owner_id INTO restaurant_owner_id
    FROM public.restaurants
    WHERE id = p_restaurant_id;

    IF restaurant_owner_id IS NULL THEN
        RAISE EXCEPTION 'Restaurant not found';
    END IF;

    -- Get Restaurant Business Wallet (Linked by restaurant_id, NOT user_id)
    SELECT id INTO restaurant_wallet_id
    FROM public.wallets
    WHERE restaurant_id = p_restaurant_id AND type = 'business';

    -- Create Business Wallet if missing (Fallback)
    -- Constraint: type='business' requires restaurant_id NOT NULL and user_id NULL
    IF restaurant_wallet_id IS NULL THEN
        INSERT INTO public.wallets (restaurant_id, type, balance) 
        VALUES (p_restaurant_id, 'business', 0)
        RETURNING id INTO restaurant_wallet_id;
    END IF;

    -- 3. Calculate Fees (10% Platform Fee)
    platform_fee := p_total_amount * 0.10;
    restaurant_share := p_total_amount - platform_fee;

    -- Get Admin Wallet
    SELECT id INTO admin_wallet_id FROM public.wallets WHERE type = 'admin' LIMIT 1;
    
    -- 4. Process Payment
    -- Debit User
    UPDATE public.wallets 
    SET balance = balance - p_total_amount, updated_at = now() 
    WHERE id = user_wallet_id;

    -- Credit Restaurant
    UPDATE public.wallets 
    SET balance = balance + restaurant_share, updated_at = now() 
    WHERE id = restaurant_wallet_id;

    -- Credit Admin (if exists)
    IF admin_wallet_id IS NOT NULL THEN
        UPDATE public.wallets 
        SET balance = balance + platform_fee, updated_at = now() 
        WHERE id = admin_wallet_id;
    END IF;

    -- Record Transactions
    INSERT INTO public.transactions (wallet_id, amount, type, description, location)
    VALUES (user_wallet_id, p_total_amount, 'debit', 'Order Payment to Restaurant', '{}'::jsonb);

    INSERT INTO public.transactions (wallet_id, amount, type, description, location)
    VALUES (restaurant_wallet_id, restaurant_share, 'credit', 'Payment for Order', '{}'::jsonb);
    
    -- If admin wallet exists, record fee? Optional but good for accounting.
    IF admin_wallet_id IS NOT NULL THEN
        INSERT INTO public.transactions (wallet_id, amount, type, description, location)
        VALUES (admin_wallet_id, platform_fee, 'credit', 'Platform Fee from Order', '{}'::jsonb);
    END IF;

    -- 5. Create Order
    INSERT INTO public.orders (user_id, restaurant_id, status, total_amount)
    VALUES (auth.uid(), p_restaurant_id, 'received', p_total_amount)
    RETURNING id INTO new_order_id;

    -- 6. Create Order Items
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (order_id, menu_item_id, quantity, price_at_time, options)
        VALUES (
            new_order_id, 
            (item->>'menu_item_id')::UUID, 
            (item->>'quantity')::INTEGER, 
            (item->>'price')::DECIMAL, 
            (item->>'options')::TEXT
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'message', 'Order placed successfully', 'order_id', new_order_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
