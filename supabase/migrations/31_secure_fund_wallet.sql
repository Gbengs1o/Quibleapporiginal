-- Secure fund_wallet and prevent replay attacks

-- 1. Add Unique Index to transactions reference to prevent double-spending at DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_reference ON public.transactions(reference) WHERE reference IS NOT NULL;

-- 2. Secure fund_wallet RPC
CREATE OR REPLACE FUNCTION fund_wallet(
    wallet_id UUID,
    amount DECIMAL,
    reference TEXT,
    p_location JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_wallet_type TEXT;
    v_restaurant_id UUID;
BEGIN
    -- 1. Validate Amount
    IF amount <= 0 THEN
         RETURN jsonb_build_object('success', false, 'message', 'Invalid amount');
    END IF;

    -- 2. Validate Ownership
    -- Check if the wallet belongs to the authenticated user OR is a business wallet needed by the restaurant owner
    SELECT user_id, type, restaurant_id INTO v_user_id, v_wallet_type, v_restaurant_id
    FROM public.wallets
    WHERE id = wallet_id;

    IF v_user_id IS NULL AND v_restaurant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Wallet not found');
    END IF;

    -- Auth Check:
    -- 1. Personal Wallet: user_id == auth.uid()
    -- 2. Business Wallet: restaurant owner == auth.uid()
    IF v_wallet_type = 'personal' THEN
        IF v_user_id != auth.uid() THEN
            RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: You can only fund your own wallet');
        END IF;
    ELSIF v_wallet_type = 'business' THEN
        -- Check if user owns the restaurant
        IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = v_restaurant_id AND owner_id = auth.uid()) THEN
             RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: You do not own this business wallet');
        END IF;
    ELSE
         RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Unknown wallet type');
    END IF;

    -- 3. Check for Duplicate Reference
    -- (The Unique Index will also catch this, but a nice error message is better)
    IF EXISTS (SELECT 1 FROM public.transactions WHERE reference = fund_wallet.reference) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Duplicate transaction: Payment already verified');
    END IF;

    -- 4. Update Balance
    UPDATE public.wallets 
    SET balance = balance + amount, updated_at = now() 
    WHERE id = wallet_id;

    -- 5. Record Transaction (Now including reference column)
    INSERT INTO public.transactions (wallet_id, amount, type, description, reference, location)
    VALUES (wallet_id, amount, 'credit', 'Wallet Top Up', reference, p_location);

    RETURN jsonb_build_object('success', true, 'message', 'Funds added successfully');

EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'message', 'Duplicate transaction caught by constraint');
WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
