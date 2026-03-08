-- Route promotion campaign fees to the platform (admin) wallet.
-- Keeps promotion creation atomic and explicitly non-refundable.

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
    p_budget DECIMAL,
    p_destination_type TEXT DEFAULT 'profile',
    p_destination_value TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_vendor_wallet_id UUID;
    v_admin_wallet_id UUID;
    v_promo_id UUID;
    v_vendor_name TEXT;
    v_destination_value TEXT;
    v_destination_item_id UUID;
    v_rows_updated INTEGER := 0;
BEGIN
    v_destination_value := NULLIF(BTRIM(p_destination_value), '');

    IF COALESCE(p_budget, 0) <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Promotion budget must be greater than zero');
    END IF;

    IF p_end_date <= p_start_date THEN
        RETURN jsonb_build_object('success', false, 'message', 'Promotion end date must be after start date');
    END IF;

    -- 1) Validate vendor and wallet ownership
    IF p_vendor_type = 'restaurant' THEN
        SELECT name INTO v_vendor_name
        FROM public.restaurants
        WHERE id = p_vendor_id
          AND owner_id = auth.uid();

        SELECT id INTO v_vendor_wallet_id
        FROM public.wallets
        WHERE restaurant_id = p_vendor_id
          AND type = 'business';
    ELSIF p_vendor_type = 'store' THEN
        SELECT name INTO v_vendor_name
        FROM public.stores
        WHERE id = p_vendor_id
          AND owner_id = auth.uid();

        SELECT id INTO v_vendor_wallet_id
        FROM public.wallets
        WHERE store_id = p_vendor_id
          AND type = 'business';
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Invalid vendor type');
    END IF;

    IF v_vendor_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vendor not found or unauthorized');
    END IF;

    IF v_vendor_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Business wallet not found');
    END IF;

    SELECT id INTO v_admin_wallet_id
    FROM public.wallets
    WHERE type = 'admin'
    LIMIT 1;

    IF v_admin_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Platform wallet is not configured');
    END IF;

    -- 2) Validate destination settings
    IF p_destination_type NOT IN ('profile', 'items', 'item', 'custom_url') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid destination type');
    END IF;

    IF p_destination_type IN ('profile', 'items') THEN
        v_destination_value := NULL;
    ELSIF p_destination_type = 'item' THEN
        IF v_destination_value IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'Please select a destination item');
        END IF;

        BEGIN
            v_destination_item_id := v_destination_value::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            RETURN jsonb_build_object('success', false, 'message', 'Invalid destination item');
        END;

        IF p_vendor_type = 'restaurant' THEN
            IF NOT EXISTS (
                SELECT 1
                FROM public.menu_items
                WHERE id = v_destination_item_id
                  AND restaurant_id = p_vendor_id
            ) THEN
                RETURN jsonb_build_object('success', false, 'message', 'Selected item does not belong to this restaurant');
            END IF;
        ELSE
            IF NOT EXISTS (
                SELECT 1
                FROM public.store_items
                WHERE id = v_destination_item_id
                  AND store_id = p_vendor_id
            ) THEN
                RETURN jsonb_build_object('success', false, 'message', 'Selected product does not belong to this store');
            END IF;
        END IF;
    ELSIF p_destination_type = 'custom_url' THEN
        IF v_destination_value IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'Please provide a custom destination URL');
        END IF;

        IF v_destination_value !~ '^(https?://|/)' THEN
            RETURN jsonb_build_object('success', false, 'message', 'Custom URL must start with http(s):// or /');
        END IF;
    END IF;

    -- 3) Atomic vendor deduction
    UPDATE public.wallets
    SET balance = balance - p_budget,
        updated_at = NOW()
    WHERE id = v_vendor_wallet_id
      AND balance >= p_budget;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    IF v_rows_updated = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds in business wallet');
    END IF;

    -- 4) Credit platform wallet with promotion revenue
    UPDATE public.wallets
    SET balance = balance + p_budget,
        updated_at = NOW()
    WHERE id = v_admin_wallet_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Platform wallet is not configured';
    END IF;

    -- 5) Insert promotion (pending admin approval)
    INSERT INTO public.promotions (
        vendor_id,
        vendor_type,
        title,
        description,
        media_url,
        media_type,
        start_date,
        end_date,
        city,
        budget,
        status,
        destination_type,
        destination_value
    )
    VALUES (
        p_vendor_id,
        p_vendor_type,
        p_title,
        p_description,
        p_media_url,
        p_media_type,
        p_start_date,
        p_end_date,
        p_city,
        p_budget,
        'pending',
        p_destination_type,
        v_destination_value
    )
    RETURNING id INTO v_promo_id;

    -- 6) Ledger entries (vendor debit + platform credit)
    INSERT INTO public.transactions (wallet_id, amount, type, description, reference)
    VALUES (
        v_vendor_wallet_id,
        p_budget,
        'debit',
        'Promotion Campaign (Non-refundable): ' || p_title,
        v_promo_id::text
    );

    INSERT INTO public.transactions (wallet_id, amount, type, description, reference)
    VALUES (
        v_admin_wallet_id,
        p_budget,
        'credit',
        'Promotion Revenue: ' || p_title,
        v_promo_id::text
    );

    RETURN jsonb_build_object(
        'success', true,
        'promo_id', v_promo_id,
        'message', 'Promotion submitted successfully. Fees are non-refundable.'
    );
END;
$$;

-- Legacy signature wrapper for older clients.
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
SET search_path = public
AS $$
BEGIN
    RETURN public.create_promotion(
        p_vendor_id := p_vendor_id,
        p_vendor_type := p_vendor_type,
        p_title := p_title,
        p_description := p_description,
        p_media_url := p_media_url,
        p_media_type := p_media_type,
        p_start_date := p_start_date,
        p_end_date := p_end_date,
        p_city := p_city,
        p_budget := p_budget,
        p_destination_type := 'profile',
        p_destination_value := NULL
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_promotion(
    UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, DECIMAL
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_promotion(
    UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, DECIMAL, TEXT, TEXT
) TO authenticated;
