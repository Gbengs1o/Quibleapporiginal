-- Add rider_id to wallets table
ALTER TABLE public.wallets 
ADD COLUMN IF NOT EXISTS rider_id UUID REFERENCES public.riders(id);

-- Update check constraint for wallet type
ALTER TABLE public.wallets 
DROP CONSTRAINT IF EXISTS wallets_type_check;

ALTER TABLE public.wallets 
ADD CONSTRAINT wallets_type_check 
CHECK (type IN ('personal', 'business', 'rider'));

-- Create unique index for rider wallets
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_rider_id 
ON public.wallets(rider_id) 
WHERE type = 'rider';

-- Function to create rider wallet
CREATE OR REPLACE FUNCTION public.create_rider_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets (rider_id, type, balance)
  VALUES (NEW.id, 'rider', 0.0)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create wallet when rider is created
DROP TRIGGER IF EXISTS on_rider_created ON public.riders;
CREATE TRIGGER on_rider_created
  AFTER INSERT ON public.riders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_rider_wallet();

-- Backfill wallets for existing riders
INSERT INTO public.wallets (rider_id, type, balance)
SELECT id, 'rider', 0.0
FROM public.riders
WHERE id NOT IN (SELECT rider_id FROM public.wallets WHERE type = 'rider');

-- Update generic transfer function to support rider wallets
CREATE OR REPLACE FUNCTION transfer_funds_generic(
    source_wallet_id UUID,
    recipient_email TEXT,
    amount DECIMAL
) RETURNS JSONB AS $$
DECLARE
    recipient_user_id UUID;
    recipient_wallet_id UUID; 
    source_balance DECIMAL;
BEGIN
    -- Check if amount is valid
    IF amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
    END IF;

    -- Get recipient ID
    SELECT id INTO recipient_user_id FROM auth.users WHERE email = recipient_email;
    
    IF recipient_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Recipient not found');
    END IF;

    -- Get recipient personal wallet
    SELECT id INTO recipient_wallet_id FROM public.wallets 
    WHERE user_id = recipient_user_id AND type = 'personal';

    IF recipient_wallet_id IS NULL THEN
        -- Auto-create if missing
        INSERT INTO public.wallets (user_id, type, balance)
        VALUES (recipient_user_id, 'personal', 0.0)
        RETURNING id INTO recipient_wallet_id;
    END IF;

    -- Check source wallet ownership & balance
    SELECT balance INTO source_balance
    FROM public.wallets w
    LEFT JOIN public.restaurants r ON w.restaurant_id = r.id
    LEFT JOIN public.riders rd ON w.rider_id = rd.id
    WHERE w.id = source_wallet_id
    AND (
        (w.type = 'personal' AND w.user_id = auth.uid()) OR
        (w.type = 'business' AND r.owner_id = auth.uid()) OR
        (w.type = 'rider' AND rd.user_id = auth.uid())
    );

    IF source_balance IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found or access denied');
    END IF;

    IF source_balance < amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
    END IF;

    -- Perform Transfer
    UPDATE public.wallets SET balance = balance - amount WHERE id = source_wallet_id;
    UPDATE public.wallets SET balance = balance + amount WHERE id = recipient_wallet_id;

    -- Record Transaction
    INSERT INTO public.transactions (wallet_id, type, amount, description, reference_id, status)
    VALUES 
        (source_wallet_id, 'debit', amount, 'Transfer to ' || recipient_email, recipient_wallet_id::text, 'completed'),
        (recipient_wallet_id, 'credit', amount, 'Received from transfer', source_wallet_id::text, 'completed');

    RETURN jsonb_build_object('success', true, 'new_balance', source_balance - amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Update generic payout function to support rider wallets
CREATE OR REPLACE FUNCTION request_payout_generic(
    source_wallet_id UUID,
    amount DECIMAL,
    bank_name TEXT,
    account_number TEXT,
    account_name TEXT
) RETURNS JSONB AS $$
DECLARE
    source_balance DECIMAL;
    wallet_owner_id UUID;
    v_wallet_type TEXT;
    v_user_id UUID;
BEGIN
    IF amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
    END IF;

    -- Determine ownership
    SELECT 
        w.balance, 
        w.type,
        COALESCE(w.user_id, r.owner_id, rd.user_id)
    INTO source_balance, v_wallet_type, v_user_id
    FROM public.wallets w
    LEFT JOIN public.restaurants r ON w.restaurant_id = r.id
    LEFT JOIN public.riders rd ON w.rider_id = rd.id
    WHERE w.id = source_wallet_id;

    -- Validate Access
    IF v_user_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access denied');
    END IF;

    IF source_balance < amount THEN
         RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
    END IF;

    -- Create Withdrawal Request
    INSERT INTO public.withdrawals (user_id, amount, bank_name, account_number, account_name, status)
    VALUES (auth.uid(), amount, bank_name, account_number, account_name, 'pending');

    -- Deduct Balance
    UPDATE public.wallets SET balance = balance - amount WHERE id = source_wallet_id;

    -- Record Transaction
    INSERT INTO public.transactions (wallet_id, type, amount, description, reference_id, status)
    VALUES (source_wallet_id, 'debit', amount, 'Withdrawal Request', NULL, 'pending');

    RETURN jsonb_build_object('success', true, 'new_balance', source_balance - amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
