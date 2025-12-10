-- 1. Create Withdrawals Table
CREATE TABLE IF NOT EXISTS public.withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    amount DECIMAL NOT NULL CHECK (amount > 0),
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for Withdrawals
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own withdrawals"
ON public.withdrawals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own withdrawals"
ON public.withdrawals FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 2. RPC: P2P Transfer
-- Allows sending money to another user via email
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

    -- Resolve Recipient (Check auth.users - requires slight hack or view normally, 
    -- but usually we can query public.profiles using email if we sync it, 
    -- OR we assume we can look up auth.users. 
    -- Since we can't directly query auth.users from here easily without permissions, 
    -- let's try to look up via public.profiles assuming checking 'email' matches (if we added email to profiles).
    -- If profiles doesn't have email, we might need a trusted lookup function.
    -- Let's check public.profiles structure first. It has no email column by default in my viewing earlier.
    -- FAILSAFE: We will assume we can select from auth.users because we are SECURITY DEFINER.)
    
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

    -- Perform Transfer
    -- Debit Sender
    UPDATE public.wallets 
    SET balance = balance - amount, updated_at = now() 
    WHERE id = sender_wallet_id;

    INSERT INTO public.transactions (wallet_id, amount, type, description)
    VALUES (sender_wallet_id, amount, 'debit', 'Transfer to ' || recipient_email);

    -- Credit Recipient
    UPDATE public.wallets 
    SET balance = balance + amount, updated_at = now() 
    WHERE id = recipient_wallet_id;

    INSERT INTO public.transactions (wallet_id, amount, type, description)
    VALUES (recipient_wallet_id, amount, 'credit', 'Received from ' || (SELECT email FROM auth.users WHERE id = auth.uid()));

    RETURN jsonb_build_object('success', true, 'message', 'Transfer successful');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 3. RPC: Request Withdrawal
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
    user_balance DECIMAL;
BEGIN
    -- Get User Wallet
    SELECT id, balance INTO user_wallet_id, user_balance
    FROM public.wallets
    WHERE user_id = auth.uid() AND type = 'personal';

    IF user_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Wallet not found';
    END IF;

    IF user_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- Debit Wallet (Hold Funds)
    UPDATE public.wallets 
    SET balance = balance - p_amount, updated_at = now() 
    WHERE id = user_wallet_id;

    INSERT INTO public.transactions (wallet_id, amount, type, description)
    VALUES (user_wallet_id, p_amount, 'debit', 'Withdrawal Request');

    -- Create Withdrawal Record
    INSERT INTO public.withdrawals (user_id, amount, bank_name, account_number, account_name)
    VALUES (auth.uid(), p_amount, p_bank_name, p_account_number, p_account_name);

    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal requested successfully');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
