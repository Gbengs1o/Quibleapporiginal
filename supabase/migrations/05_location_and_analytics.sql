-- 1. Add Location to Transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS location JSONB DEFAULT '{}'::jsonb;

-- 2. Update fund_wallet to include location
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
BEGIN
    -- Update Balance
    UPDATE public.wallets 
    SET balance = balance + amount, updated_at = now() 
    WHERE id = wallet_id;

    -- Record Transaction
    INSERT INTO public.transactions (wallet_id, amount, type, description, location)
    VALUES (wallet_id, amount, 'credit', 'Wallet Top Up (Ref: ' || reference || ')', p_location);

    RETURN jsonb_build_object('success', true, 'message', 'Funds added successfully');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 3. Update transfer_p2p to include location
CREATE OR REPLACE FUNCTION transfer_p2p(
    recipient_email TEXT,
    amount DECIMAL,
    p_location JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    sender_wallet_id UUID;
    recipient_user_id UUID;
    recipient_wallet_id UUID;
    sender_balance DECIMAL;
BEGIN
    -- Get Sender Wallet
    SELECT id, balance INTO sender_wallet_id, sender_balance
    FROM public.wallets
    WHERE user_id = auth.uid() AND type = 'personal';

    IF sender_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Sender wallet not found';
    END IF;

    IF sender_balance < amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- Resolve Recipient
    SELECT id INTO recipient_user_id
    FROM auth.users
    WHERE email = recipient_email
    LIMIT 1;

    IF recipient_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Recipient email not found');
    END IF;

    IF recipient_user_id = auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cannot send money to yourself');
    END IF;

    -- Get Recipient Wallet (Create if missing)
    SELECT id INTO recipient_wallet_id
    FROM public.wallets
    WHERE user_id = recipient_user_id AND type = 'personal';

    IF recipient_wallet_id IS NULL THEN
         INSERT INTO public.wallets (user_id, type, balance) VALUES (recipient_user_id, 'personal', 0)
         RETURNING id INTO recipient_wallet_id;
    END IF;

    -- Debit Sender
    UPDATE public.wallets 
    SET balance = balance - amount, updated_at = now() 
    WHERE id = sender_wallet_id;

    INSERT INTO public.transactions (wallet_id, amount, type, description, location)
    VALUES (sender_wallet_id, amount, 'debit', 'Transfer to ' || recipient_email, p_location);

    -- Credit Recipient (No location for recipient, or maybe use sender's generic "Remote")
    UPDATE public.wallets 
    SET balance = balance + amount, updated_at = now() 
    WHERE id = recipient_wallet_id;

    INSERT INTO public.transactions (wallet_id, amount, type, description, location)
    VALUES (recipient_wallet_id, amount, 'credit', 'Received from ' || (SELECT email FROM auth.users WHERE id = auth.uid()), p_location);

    RETURN jsonb_build_object('success', true, 'message', 'Transfer successful');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 4. Update request_withdrawal to include location
CREATE OR REPLACE FUNCTION request_withdrawal(
    p_amount DECIMAL,
    p_bank_name TEXT,
    p_account_number TEXT,
    p_account_name TEXT,
    p_location JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_wallet_id UUID;
    user_balance DECIMAL;
BEGIN
    SELECT id, balance INTO user_wallet_id, user_balance
    FROM public.wallets
    WHERE user_id = auth.uid() AND type = 'personal';

    IF user_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Wallet not found';
    END IF;

    IF user_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    UPDATE public.wallets 
    SET balance = balance - p_amount, updated_at = now() 
    WHERE id = user_wallet_id;

    INSERT INTO public.transactions (wallet_id, amount, type, description, location)
    VALUES (user_wallet_id, p_amount, 'debit', 'Withdrawal Request', p_location);

    INSERT INTO public.withdrawals (user_id, amount, bank_name, account_number, account_name)
    VALUES (auth.uid(), p_amount, p_bank_name, p_account_number, p_account_name);

    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal requested successfully');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
