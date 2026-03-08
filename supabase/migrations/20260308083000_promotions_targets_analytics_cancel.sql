-- Promotions: destination targeting, analytics counters, and cancellation controls

-- 1) Extend promotions table
ALTER TABLE public.promotions
    ADD COLUMN IF NOT EXISTS destination_type TEXT NOT NULL DEFAULT 'profile',
    ADD COLUMN IF NOT EXISTS destination_value TEXT,
    ADD COLUMN IF NOT EXISTS views_count BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS clicks_count BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reach_count BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- 2) Refresh status check to include cancelled
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.promotions'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE public.promotions DROP CONSTRAINT %I', r.conname);
    END LOOP;
END;
$$;

ALTER TABLE public.promotions
    ADD CONSTRAINT promotions_status_check
    CHECK (status IN ('pending', 'active', 'rejected', 'expired', 'cancelled'));

ALTER TABLE public.promotions
    DROP CONSTRAINT IF EXISTS promotions_destination_type_check;

ALTER TABLE public.promotions
    ADD CONSTRAINT promotions_destination_type_check
    CHECK (destination_type IN ('profile', 'items', 'item', 'custom_url'));

CREATE INDEX IF NOT EXISTS idx_promotions_destination_type ON public.promotions(destination_type);

-- 3) Raw analytics event log tables
CREATE TABLE IF NOT EXISTS public.promotion_events (
    id BIGSERIAL PRIMARY KEY,
    promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('view', 'click')),
    viewer_key TEXT NOT NULL,
    user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotion_events_promo_time
    ON public.promotion_events(promotion_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promotion_events_type
    ON public.promotion_events(event_type);

CREATE TABLE IF NOT EXISTS public.promotion_reach (
    promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
    viewer_key TEXT NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (promotion_id, viewer_key)
);

ALTER TABLE public.promotion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_reach ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read promotion events" ON public.promotion_events;
CREATE POLICY "Admins can read promotion events"
    ON public.promotion_events FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can read promotion reach" ON public.promotion_reach;
CREATE POLICY "Admins can read promotion reach"
    ON public.promotion_reach FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 4) Replace create_promotion RPC to support destination settings
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
    v_wallet_id UUID;
    v_promo_id UUID;
    v_vendor_name TEXT;
    v_destination_value TEXT;
    v_destination_item_id UUID;
BEGIN
    v_destination_value := NULLIF(BTRIM(p_destination_value), '');

    -- 1. Validate vendor and wallet ownership
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

    -- 2. Validate destination settings
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
                SELECT 1 FROM public.menu_items
                WHERE id = v_destination_item_id
                  AND restaurant_id = p_vendor_id
            ) THEN
                RETURN jsonb_build_object('success', false, 'message', 'Selected item does not belong to this restaurant');
            END IF;
        ELSE
            IF NOT EXISTS (
                SELECT 1 FROM public.store_items
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

    -- 3. Check wallet balance
    IF (SELECT balance FROM public.wallets WHERE id = v_wallet_id) < p_budget THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds in business wallet');
    END IF;

    -- 4. Atomic deduction and insertion
    UPDATE public.wallets
    SET balance = balance - p_budget, updated_at = NOW()
    WHERE id = v_wallet_id;

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

    -- 5. Record transaction
    INSERT INTO public.transactions (wallet_id, amount, type, description, reference)
    VALUES (v_wallet_id, p_budget, 'debit', 'Promotion Campaign: ' || p_title, v_promo_id::text);

    RETURN jsonb_build_object('success', true, 'promo_id', v_promo_id, 'message', 'Promotion submitted successfully');
END;
$$;

-- 5) Event tracker RPC for views/clicks/reach
CREATE OR REPLACE FUNCTION public.record_promotion_event(
    p_promotion_id UUID,
    p_event_type TEXT,
    p_viewer_key TEXT,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reach_inserted INTEGER := 0;
    v_views BIGINT := 0;
    v_clicks BIGINT := 0;
    v_reach BIGINT := 0;
    v_ctr NUMERIC := 0;
BEGIN
    IF p_event_type NOT IN ('view', 'click') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid event type');
    END IF;

    IF p_viewer_key IS NULL OR BTRIM(p_viewer_key) = '' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Viewer key is required');
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.promotions p
        WHERE p.id = p_promotion_id
          AND p.status = 'active'
          AND NOW() BETWEEN p.start_date AND p.end_date
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Promotion is not active');
    END IF;

    INSERT INTO public.promotion_events (promotion_id, event_type, viewer_key, user_id)
    VALUES (p_promotion_id, p_event_type, p_viewer_key, COALESCE(auth.uid(), p_user_id));

    IF p_event_type = 'view' THEN
        UPDATE public.promotions
        SET views_count = views_count + 1, updated_at = NOW()
        WHERE id = p_promotion_id;
    ELSE
        UPDATE public.promotions
        SET clicks_count = clicks_count + 1, updated_at = NOW()
        WHERE id = p_promotion_id;
    END IF;

    INSERT INTO public.promotion_reach (promotion_id, viewer_key)
    VALUES (p_promotion_id, p_viewer_key)
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_reach_inserted = ROW_COUNT;

    IF v_reach_inserted > 0 THEN
        UPDATE public.promotions
        SET reach_count = reach_count + 1, updated_at = NOW()
        WHERE id = p_promotion_id;
    END IF;

    SELECT views_count, clicks_count, reach_count
    INTO v_views, v_clicks, v_reach
    FROM public.promotions
    WHERE id = p_promotion_id;

    IF v_views > 0 THEN
        v_ctr := ROUND((v_clicks::NUMERIC / v_views::NUMERIC) * 100, 2);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'views', v_views,
        'clicks', v_clicks,
        'reach', v_reach,
        'ctr', v_ctr
    );
END;
$$;

-- 6) Cancellation RPC for vendors and admins
CREATE OR REPLACE FUNCTION public.cancel_promotion(
    p_promotion_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_promo public.promotions%ROWTYPE;
    v_is_admin BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_promo FROM public.promotions WHERE id = p_promotion_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Promotion not found');
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        IF v_promo.vendor_type = 'restaurant' THEN
            IF NOT EXISTS (
                SELECT 1
                FROM public.restaurants
                WHERE id = v_promo.vendor_id
                  AND owner_id = auth.uid()
            ) THEN
                RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
            END IF;
        ELSIF v_promo.vendor_type = 'store' THEN
            IF NOT EXISTS (
                SELECT 1
                FROM public.stores
                WHERE id = v_promo.vendor_id
                  AND owner_id = auth.uid()
            ) THEN
                RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
            END IF;
        ELSE
            RETURN jsonb_build_object('success', false, 'message', 'Invalid vendor type');
        END IF;
    END IF;

    IF v_promo.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Promotion already cancelled');
    END IF;

    IF v_promo.status IN ('expired', 'rejected') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Only pending or active promotions can be cancelled');
    END IF;

    UPDATE public.promotions
    SET
        status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = auth.uid(),
        cancel_reason = COALESCE(NULLIF(BTRIM(p_reason), ''), cancel_reason),
        updated_at = NOW()
    WHERE id = p_promotion_id;

    RETURN jsonb_build_object('success', true, 'message', 'Promotion cancelled successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_promotion_event(UUID, TEXT, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_promotion(UUID, TEXT) TO authenticated;
