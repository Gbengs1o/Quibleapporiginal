-- Fix: Add min_order_amount check to process_referral_reward
-- Also adds a null/disabled guard for settings

CREATE OR REPLACE FUNCTION process_referral_reward(
    p_user_id UUID,
    p_amount DECIMAL,
    p_order_id UUID DEFAULT NULL,
    p_delivery_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_referrer_id UUID;
    v_settings JSONB;
    v_reward DECIMAL;
    v_min_order DECIMAL;
BEGIN
    -- Check if user was referred
    SELECT referred_by_id INTO v_referrer_id FROM public.profiles WHERE id = p_user_id;
    
    IF v_referrer_id IS NOT NULL THEN
        -- Get settings
        SELECT value INTO v_settings FROM public.platform_settings WHERE key = 'referral_system';
        
        -- Guard: settings must exist and be enabled
        IF v_settings IS NULL OR NOT (v_settings->>'enabled')::boolean THEN
            RETURN;
        END IF;

        -- Check minimum order amount
        v_min_order := COALESCE((v_settings->>'min_order_amount')::decimal, 0);
        IF p_amount < v_min_order THEN
            RETURN;
        END IF;

        -- Check if reward already given and duration is 'once'
        IF v_settings->>'duration' = 'once' THEN
            IF EXISTS (SELECT 1 FROM public.referral_earnings WHERE referrer_id = v_referrer_id AND referred_user_id = p_user_id) THEN
                RETURN;
            END IF;
        END IF;

        -- Calculate reward
        IF v_settings->>'reward_type' = 'fixed' THEN
            v_reward := (v_settings->>'reward_value')::decimal;
        ELSE -- percentage
            v_reward := p_amount * ((v_settings->>'reward_value')::decimal / 100);
        END IF;

        -- Insert pending earning
        -- matures_at is set to the first day of next month
        INSERT INTO public.referral_earnings (referrer_id, referred_user_id, order_id, delivery_request_id, amount, status, matures_at)
        VALUES (v_referrer_id, p_user_id, p_order_id, p_delivery_id, v_reward, 'pending', date_trunc('month', now()) + interval '1 month');
    END IF;
END;
$$;
