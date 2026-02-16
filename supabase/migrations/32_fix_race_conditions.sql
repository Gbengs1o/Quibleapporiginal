-- Fix Race Conditions (Double Spending) in Financial RPCs via Atomic Updates

-- 1. Secure transfer_p2p
CREATE OR REPLACE FUNCTION transfer_p2p(
    recipient_email TEXT,
    amount DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    sender_wallet_id UUID;
    recipient_user_id UUID;
    recipient_wallet_id UUID;
BEGIN
    -- Get Sender Wallet ID (Don't check balance yet)
    SELECT id INTO sender_wallet_id
    FROM public.wallets
    WHERE user_id = auth.uid() AND type = 'personal';

    IF sender_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Sender wallet not found';
    END IF;

    -- ATOMIC DEDUCTION: Check balance AND deduct in one step
    UPDATE public.wallets 
    SET balance = balance - amount, updated_at = now() 
    WHERE id = sender_wallet_id AND balance >= amount;

    -- Check if the update actually happened
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- If we got here, funds are safely held/deducted. Now process recipient.
    
    -- Resolve Recipient
    SELECT id INTO recipient_user_id
    FROM auth.users
    WHERE email = recipient_email
    LIMIT 1;

    IF recipient_user_id IS NULL THEN
        -- ROLLBACK: Refund the sender because recipient wasn't found
        UPDATE public.wallets SET balance = balance + amount WHERE id = sender_wallet_id;
        RETURN jsonb_build_object('success', false, 'message', 'Recipient email not found');
    END IF;

    IF recipient_user_id = auth.uid() THEN
        -- ROLLBACK
        UPDATE public.wallets SET balance = balance + amount WHERE id = sender_wallet_id;
        RETURN jsonb_build_object('success', false, 'message', 'Cannot send money to yourself');
    END IF;

    -- Get/Create Recipient Wallet
    SELECT id INTO recipient_wallet_id
    FROM public.wallets
    WHERE user_id = recipient_user_id AND type = 'personal';

    IF recipient_wallet_id IS NULL THEN
         INSERT INTO public.wallets (user_id, type, balance) VALUES (recipient_user_id, 'personal', 0)
         RETURNING id INTO recipient_wallet_id;
    END IF;

    -- Log Sender Debit
    INSERT INTO public.transactions (wallet_id, amount, type, description)
    VALUES (sender_wallet_id, amount, 'debit', 'Transfer to ' || recipient_email);

    -- Credit Recipient
    UPDATE public.wallets 
    SET balance = balance + amount, updated_at = now() 
    WHERE id = recipient_wallet_id;

    -- Log Recipient Credit
    INSERT INTO public.transactions (wallet_id, amount, type, description)
    VALUES (recipient_wallet_id, amount, 'credit', 'Received from ' || (SELECT email FROM auth.users WHERE id = auth.uid()));

    RETURN jsonb_build_object('success', true, 'message', 'Transfer successful');

EXCEPTION WHEN OTHERS THEN
    -- In case of any other error, we should verify data consistency. 
    -- Ideally, Postgres transaction rollback handles this automatically if called as a single statement.
    RAISE;
END;
$$;

-- 2. Secure request_withdrawal
CREATE OR REPLACE FUNCTION request_withdrawal(
    p_amount DECIMAL,
    p_bank_name TEXT,
    p_account_number TEXT,
    p_account_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_wallet_id UUID;
BEGIN
    -- Get User Wallet
    SELECT id INTO user_wallet_id
    FROM public.wallets
    WHERE user_id = auth.uid() AND type = 'personal';

    IF user_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Wallet not found';
    END IF;

    -- ATOMIC DEDUCTION
    UPDATE public.wallets 
    SET balance = balance - p_amount, updated_at = now() 
    WHERE id = user_wallet_id AND balance >= p_amount;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- Log Debit
    INSERT INTO public.transactions (wallet_id, amount, type, description)
    VALUES (user_wallet_id, p_amount, 'debit', 'Withdrawal Request');

    -- Create Withdrawal Record
    INSERT INTO public.withdrawals (user_id, amount, bank_name, account_number, account_name)
    VALUES (auth.uid(), p_amount, p_bank_name, p_account_number, p_account_name);

    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal requested successfully');

EXCEPTION WHEN OTHERS THEN
    RAISE; -- Let Postgres rollback
END;
$$;

-- 3. Secure transfer_funds_generic (Business/Personal)
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
    recipient_user_id UUID;
    recipient_wallet_id UUID;
BEGIN
    -- Verify Ownership (Join to check permissions)
    -- We can't do UPDATE ... FROM ... JOIN easily with logic checks in one query efficiently if permissions fail.
    -- So we check permission first, THEN update atomically.
    
    SELECT w.type INTO wallet_type
    FROM public.wallets w
    LEFT JOIN public.restaurants r ON w.restaurant_id = r.id
    WHERE w.id = source_wallet_id
    AND (
        (w.type = 'personal' AND w.user_id = auth.uid()) OR
        (w.type = 'business' AND r.owner_id = auth.uid())
    );

    IF wallet_type IS NULL THEN
         RETURN jsonb_build_object('success', false, 'message', 'Wallet not found or access denied');
    END IF;

    -- ATOMIC DEDUCTION
    UPDATE public.wallets 
    SET balance = balance - amount, updated_at = now() 
    WHERE id = source_wallet_id AND balance >= amount;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- Resolve Recipient
    SELECT id INTO recipient_user_id
    FROM auth.users
    WHERE email = recipient_email
    LIMIT 1;

    IF recipient_user_id IS NULL THEN
        -- ROLLBACK
        UPDATE public.wallets SET balance = balance + amount WHERE id = source_wallet_id;
        RETURN jsonb_build_object('success', false, 'message', 'Recipient email not found');
    END IF;

    -- Get/Create Recipient Wallet
    SELECT id INTO recipient_wallet_id
    FROM public.wallets
    WHERE user_id = recipient_user_id AND type = 'personal';

    IF recipient_wallet_id IS NULL THEN
         INSERT INTO public.wallets (user_id, type, balance) VALUES (recipient_user_id, 'personal', 0)
         RETURNING id INTO recipient_wallet_id;
    END IF;

    -- Log Sender Debit
    INSERT INTO public.transactions (wallet_id, amount, type, description)
    VALUES (source_wallet_id, amount, 'debit', 'Transfer to ' || recipient_email);

    -- Credit Recipient
    UPDATE public.wallets 
    SET balance = balance + amount, updated_at = now() 
    WHERE id = recipient_wallet_id;

    -- Log Recipient Credit
    INSERT INTO public.transactions (wallet_id, amount, type, description)
    VALUES (recipient_wallet_id, amount, 'credit', 'Received from ' || (SELECT email FROM auth.users WHERE id = auth.uid()) || (CASE WHEN wallet_type = 'business' THEN ' (Business)' ELSE '' END));

    RETURN jsonb_build_object('success', true, 'message', 'Transfer successful');

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;

-- 4. Secure request_payout_generic
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
    wallet_type TEXT;
BEGIN
    -- Verify Ownership
    SELECT w.type INTO wallet_type
    FROM public.wallets w
    LEFT JOIN public.restaurants r ON w.restaurant_id = r.id
    WHERE w.id = source_wallet_id
    AND (
        (w.type = 'personal' AND w.user_id = auth.uid()) OR
        (w.type = 'business' AND r.owner_id = auth.uid())
    );

    IF wallet_type IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Wallet not found or access denied');
    END IF;

    -- ATOMIC DEDUCTION
    UPDATE public.wallets 
    SET balance = balance - amount, updated_at = now() 
    WHERE id = source_wallet_id AND balance >= amount;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- Log Debit
    INSERT INTO public.transactions (wallet_id, amount, type, description)
    VALUES (source_wallet_id, amount, 'debit', 'Withdrawal Request');

    -- Create Withdrawal Record
    INSERT INTO public.withdrawals (user_id, amount, bank_name, account_number, account_name, status)
    VALUES (auth.uid(), amount, bank_name, account_number, account_name, 'pending');

    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal requested successfully');

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;
