-- Migration: Create Promotions System
-- Allows restaurants and stores to run image/video ad campaigns.

-- 1. Create promotions table
CREATE TABLE public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL, -- restaurant_id or store_id
    vendor_type TEXT NOT NULL CHECK (vendor_type IN ('restaurant', 'store')),
    title TEXT NOT NULL,
    description TEXT,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'expired')),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    city TEXT, -- for location targeting
    budget DECIMAL NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add indexes for performance
CREATE INDEX idx_promotions_vendor ON public.promotions(vendor_id, vendor_type);
CREATE INDEX idx_promotions_status_dates ON public.promotions(status, start_date, end_date);
CREATE INDEX idx_promotions_city ON public.promotions(city);

-- 3. Enable RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Public: Can view active, approved promotions
CREATE POLICY "Public can view active promotions"
    ON public.promotions FOR SELECT
    USING (status = 'active' AND NOW() BETWEEN start_date AND end_date);

-- Vendor Owners: Can view their own promotions
CREATE POLICY "Vendors can view their own promotions"
    ON public.promotions FOR SELECT
    USING (
        (vendor_type = 'restaurant' AND EXISTS (
            SELECT 1 FROM public.restaurants r 
            WHERE r.id = vendor_id AND r.owner_id = auth.uid()
        )) OR
        (vendor_type = 'store' AND EXISTS (
            SELECT 1 FROM public.stores s 
            WHERE s.id = vendor_id AND s.owner_id = auth.uid()
        ))
    );

-- Vendor Owners: Can insert their own promotions
CREATE POLICY "Vendors can insert their own promotions"
    ON public.promotions FOR INSERT
    WITH CHECK (
        (vendor_type = 'restaurant' AND EXISTS (
            SELECT 1 FROM public.restaurants r 
            WHERE r.id = vendor_id AND r.owner_id = auth.uid()
        )) OR
        (vendor_type = 'store' AND EXISTS (
            SELECT 1 FROM public.stores s 
            WHERE s.id = vendor_id AND s.owner_id = auth.uid()
        ))
    );

-- Admin: Full access
CREATE POLICY "Admins have full access"
    ON public.promotions FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ));

-- 5. RPC for Atomic Promotion Creation & Budget Deduction
CREATE OR REPLACE FUNCTION public.create_promotion(
    p_vendor_id UUID,
    p_vendor_type TEXT,
    p_title TEXT,
    p_description TEXT,
    p_media_url TEXT,
    p_media_type TEXT,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_city TEXT,
    p_budget DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_id UUID;
    v_promo_id UUID;
    v_vendor_name TEXT;
BEGIN
    -- 1. Validate vendor and get wallet
    IF p_vendor_type = 'restaurant' THEN
        SELECT name INTO v_vendor_name FROM public.restaurants WHERE id = p_vendor_id AND owner_id = auth.uid();
        SELECT id INTO v_wallet_id FROM public.wallets WHERE restaurant_id = p_vendor_id AND type = 'business';
    ELSIF p_vendor_type = 'store' THEN
        SELECT name INTO v_vendor_name FROM public.stores WHERE id = p_vendor_id AND owner_id = auth.uid();
        SELECT id INTO v_wallet_id FROM public.wallets WHERE store_id = p_vendor_id AND type = 'business';
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Invalid vendor type');
    END IF;

    IF v_vendor_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vendor not found or unauthorized');
    END IF;

    IF v_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Business wallet not found');
    END IF;

    -- 2. Check balance
    IF (SELECT balance FROM public.wallets WHERE id = v_wallet_id) < p_budget THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds in business wallet');
    END IF;

    -- 3. Atomic deduction and insertion
    UPDATE public.wallets 
    SET balance = balance - p_budget, updated_at = NOW() 
    WHERE id = v_wallet_id;

    INSERT INTO public.promotions (
        vendor_id, vendor_type, title, description, media_url, media_type, 
        start_date, end_date, city, budget, status
    )
    VALUES (
        p_vendor_id, p_vendor_type, p_title, p_description, p_media_url, p_media_type, 
        p_start_date, p_end_date, p_city, p_budget, 'pending'
    )
    RETURNING id INTO v_promo_id;

    -- 4. Record transaction
    INSERT INTO public.transactions (wallet_id, amount, type, description, reference)
    VALUES (v_wallet_id, p_budget, 'debit', 'Promotion Campaign: ' || p_title, v_promo_id::text);

    RETURN jsonb_build_object('success', true, 'promo_id', v_promo_id, 'message', 'Promotion submitted successfully');
END;
$$;
