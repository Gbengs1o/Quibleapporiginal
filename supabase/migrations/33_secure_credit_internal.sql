-- Secure Internal Crediting (Server-Side Verification Only)

-- 1. Create Internal Crediting Function (To be used by Edge Function ONLY)
CREATE OR REPLACE FUNCTION credit_wallet_internal(
    p_user_id UUID,
    p_amount DECIMAL,
    p_reference TEXT,
    p_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_id UUID;
BEGIN
    -- Get User's Personal Wallet
    SELECT id INTO v_wallet_id
    FROM public.wallets
    WHERE user_id = p_user_id AND type = 'personal';

    IF v_wallet_id IS NULL THEN
        -- Auto-create if missing (Safe here as it's system initiated)
        INSERT INTO public.wallets (user_id, type, balance) VALUES (p_user_id, 'personal', 0)
        RETURNING id INTO v_wallet_id;
    END IF;

    -- Check for Duplicate Reference
    IF EXISTS (SELECT 1 FROM public.transactions WHERE reference = p_reference) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Duplicate transaction: Payment already verified');
    END IF;

    -- Update Balance (Atomic)
    UPDATE public.wallets 
    SET balance = balance + p_amount, updated_at = now() 
    WHERE id = v_wallet_id;

    -- Record Transaction
    INSERT INTO public.transactions (wallet_id, amount, type, description, reference, location)
    VALUES (v_wallet_id, p_amount, 'credit', p_description, p_reference, '{}'::jsonb);

    RETURN jsonb_build_object('success', true, 'message', 'Wallet credited successfully');

EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'message', 'Duplicate transaction caught by constraint');
WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 2. LOCK DOWN: Revoke permissions from Public/Authenticated users
-- Only the Service Role (Superuser/Admin) should be able to execute this.
REVOKE EXECUTE ON FUNCTION credit_wallet_internal(UUID, DECIMAL, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION credit_wallet_internal(UUID, DECIMAL, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION credit_wallet_internal(UUID, DECIMAL, TEXT, TEXT) FROM authenticated;

-- 3. DEPRECATE: Revoke access to the old 'fund_wallet' to prevent any client-side calls
-- We keep the function definition in case we need to review history, but no one can call it.
REVOKE EXECUTE ON FUNCTION fund_wallet(UUID, DECIMAL, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fund_wallet(UUID, DECIMAL, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION fund_wallet(UUID, DECIMAL, TEXT, JSONB) FROM authenticated;
