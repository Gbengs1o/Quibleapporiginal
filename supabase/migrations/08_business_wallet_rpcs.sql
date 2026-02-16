-- 8. Business Wallet RPCs
-- Generic Transfer Function (Supports Personal & Business)
CREATE OR REPLACE FUNCTION transfer_funds_generic(
    source_wallet_id UUID,
    recipient_email TEXT,
    amount DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    wallet_owner_id UUID;
    wallet_type TEXT;
    sender_balance DECIMAL;
    recipient_user_id UUID;
    recipient_wallet_id UUID;
BEGIN
    -- 1. Verify Ownership & Balance
    -- Check if it's a personal wallet owned by auth.uid() OR business wallet owned by restaurant owned by auth.uid()
    -- We join wallets with restaurants (left join) to check owner.
    
    SELECT 
        w.balance, w.type
    INTO 
        sender_balance, wallet_type
    FROM public.wallets w
    LEFT JOIN public.restaurants r ON w.restaurant_id = r.id
    WHERE w.id = source_wallet_id
    AND (
        (w.type = 'personal' AND w.user_id = auth.uid()) OR
        (w.type = 'business' AND r.owner_id = auth.uid())
    );

    IF sender_balance IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Wallet not found or access denied');
    END IF;

    IF sender_balance < amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- 2. Resolve Recipient
    SELECT id INTO recipient_user_id
    FROM auth.users
    WHERE email = recipient_email
    LIMIT 1;

    IF recipient_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Recipient email not found');
    END IF;
    
    -- Prevent self-sending (if personal to personal)
    -- But Business to Owner Personal is allowed (Drawings)
    -- Business to Other Personal is allowed (Salary/Payout)
    
    -- 3. Get Recipient Personal Wallet
    SELECT id INTO recipient_wallet_id
    FROM public.wallets
    WHERE user_id = recipient_user_id AND type = 'personal';

    IF recipient_wallet_id IS NULL THEN
         INSERT INTO public.wallets (user_id, type, balance) VALUES (recipient_user_id, 'personal', 0)
         RETURNING id INTO recipient_wallet_id;
    END IF;

    -- 4. Perform Transfer
    -- Debit Sender
    UPDATE public.wallets 
    SET balance = balance - amount, updated_at = now() 
    WHERE id = source_wallet_id;

    INSERT INTO public.transactions (wallet_id, amount, type, description)
    VALUES (source_wallet_id, amount, 'debit', 'Transfer to ' || recipient_email);

    -- Credit Recipient
    UPDATE public.wallets 
    SET balance = balance + amount, updated_at = now() 
    WHERE id = recipient_wallet_id;

    INSERT INTO public.transactions (wallet_id, amount, type, description)
    VALUES (recipient_wallet_id, amount, 'credit', 'Received from ' || (SELECT email FROM auth.users WHERE id = auth.uid()) || (CASE WHEN wallet_type = 'business' THEN ' (Business)' ELSE '' END));

    RETURN jsonb_build_object('success', true, 'message', 'Transfer successful');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Generic Payout/Withdrawal Request
CREATE OR REPLACE FUNCTION request_payout_generic(
    source_wallet_id UUID,
    amount DECIMAL,
    bank_name TEXT,
    account_number TEXT,
    account_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    sender_balance DECIMAL;
BEGIN
    -- 1. Verify Ownership & Balance
    SELECT balance INTO sender_balance
    FROM public.wallets w
    LEFT JOIN public.restaurants r ON w.restaurant_id = r.id
    WHERE w.id = source_wallet_id
    AND (
        (w.type = 'personal' AND w.user_id = auth.uid()) OR
        (w.type = 'business' AND r.owner_id = auth.uid())
    );

    IF sender_balance IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Wallet not found or access denied');
    END IF;

    IF sender_balance < amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- 2. Debit Wallet (Hold Funds)
    UPDATE public.wallets 
    SET balance = balance - amount, updated_at = now() 
    WHERE id = source_wallet_id;

    INSERT INTO public.transactions (wallet_id, amount, type, description)
    VALUES (source_wallet_id, amount, 'debit', 'Withdrawal Request');

    -- 3. Create Withdrawal Record
    INSERT INTO public.withdrawals (user_id, amount, bank_name, account_number, account_name, status)
    VALUES (auth.uid(), amount, bank_name, account_number, account_name, 'pending');

    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal requested successfully');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
