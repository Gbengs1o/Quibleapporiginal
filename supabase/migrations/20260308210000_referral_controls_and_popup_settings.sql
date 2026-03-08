-- Referral reliability and admin controls:
-- 1) Backfill missing referral codes
-- 2) Allow authenticated users to apply a referral code once (works for OAuth signups too)
-- 3) Ensure every user can generate/ensure their own referral code
-- 4) Allow admins to manage platform referral settings via dashboard
-- 5) Extend referral_system JSON with banner/popup/share-content controls

-- 1) Backfill missing referral codes for existing users
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT id
        FROM public.profiles
        WHERE referral_code IS NULL OR BTRIM(referral_code) = ''
    LOOP
        UPDATE public.profiles
        SET referral_code = public.generate_unique_referral_code()
        WHERE id = r.id;
    END LOOP;
END;
$$;

-- 2) Authenticated users can apply a referral code one-time
CREATE OR REPLACE FUNCTION public.apply_referral_code(
    p_referral_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_code TEXT;
    v_profile public.profiles%ROWTYPE;
    v_referrer_id UUID;
    v_referrer_name TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Authentication required');
    END IF;

    v_code := UPPER(BTRIM(COALESCE(p_referral_code, '')));
    IF v_code = '' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Referral code is required');
    END IF;

    SELECT *
    INTO v_profile
    FROM public.profiles
    WHERE id = v_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Profile not found');
    END IF;

    IF COALESCE(BTRIM(v_profile.referral_code), '') = '' THEN
        UPDATE public.profiles
        SET referral_code = public.generate_unique_referral_code()
        WHERE id = v_user_id;
    END IF;

    IF v_profile.referred_by_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Referral already linked');
    END IF;

    SELECT id, TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
    INTO v_referrer_id, v_referrer_name
    FROM public.profiles
    WHERE referral_code = v_code
    LIMIT 1;

    IF v_referrer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid referral code');
    END IF;

    IF v_referrer_id = v_user_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'You cannot use your own referral code');
    END IF;

    UPDATE public.profiles
    SET referred_by_id = v_referrer_id
    WHERE id = v_user_id
      AND referred_by_id IS NULL;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Referral already linked');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Referral code applied successfully',
        'referrer_id', v_referrer_id,
        'referrer_name', NULLIF(v_referrer_name, '')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_referral_code(TEXT) TO authenticated;

-- 3) Ensure current user always has a referral code (for old accounts)
CREATE OR REPLACE FUNCTION public.ensure_my_referral_code()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_code TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Authentication required');
    END IF;

    SELECT referral_code
    INTO v_code
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_code IS NULL OR BTRIM(v_code) = '' THEN
        v_code := public.generate_unique_referral_code();
        UPDATE public.profiles
        SET referral_code = v_code
        WHERE id = v_user_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'referral_code', v_code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_referral_code() TO authenticated;

-- 4) Admin write policies for platform_settings (dashboard management)
DROP POLICY IF EXISTS "Admins can insert platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Admins can update platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Admins can delete platform settings" ON public.platform_settings;

CREATE POLICY "Admins can insert platform settings"
    ON public.platform_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'
        )
    );

CREATE POLICY "Admins can update platform settings"
    ON public.platform_settings
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'
        )
    );

CREATE POLICY "Admins can delete platform settings"
    ON public.platform_settings
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'
        )
    );

-- 5) Extend referral settings payload with popup/banner/share controls
WITH defaults AS (
    SELECT '{
      "enabled": true,
      "reward_type": "fixed",
      "reward_value": 500,
      "duration": "once",
      "min_order_amount": 1000,
      "is_banner_visible": true,
      "banner_title": "INVITE FRIENDS, WIN CASH!",
      "banner_subtitle": "Refer a friend and earn rewards when they complete their first order.",
      "banner_cta_text": "Invite Friends Now",
      "is_popup_visible": true,
      "popup_show_once": true,
      "popup_title": "INVITE FRIENDS, WIN CASH!",
      "popup_subtitle": "Refer a friend and GET 500 into your Quible wallet.",
      "popup_reward_highlight": "Refer & Get 500",
      "popup_share_button_text": "Share link",
      "popup_code_label": "Your code",
      "allow_manual_referral_entry": true,
      "share_link_base": "https://quible.app/invite",
      "share_message_template": "Join me on Quible. Use my referral code {{code}} and sign up with this link: {{link}}"
    }'::jsonb AS value
)
INSERT INTO public.platform_settings (key, value, description, updated_at)
SELECT
    'referral_system',
    value,
    'Configuration for referral rewards, referral banner and first-open popup',
    NOW()
FROM defaults
ON CONFLICT (key) DO UPDATE
SET
    value = (SELECT defaults.value FROM defaults) || COALESCE(public.platform_settings.value, '{}'::jsonb),
    description = EXCLUDED.description,
    updated_at = NOW()
WHERE public.platform_settings.key = 'referral_system';
