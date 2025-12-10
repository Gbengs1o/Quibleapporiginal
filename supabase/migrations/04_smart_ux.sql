-- 1. RPC: Get Recipient Details
-- Securely fetch partial user info by email for P2P confirmation
CREATE OR REPLACE FUNCTION get_recipient_details(
    p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_first_name TEXT;
    v_last_name TEXT;
    v_avatar_url TEXT;
BEGIN
    -- 1. Find User ID by Email (using auth.users)
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('found', false);
    END IF;

    -- 2. Fetch Profile Details
    -- Assuming public.profiles exists and is linked. 
    -- If profiles table is empty for some reason, we fallback to just email confirmation or generic name.
    SELECT first_name, last_name, profile_picture_url 
    INTO v_first_name, v_last_name, v_avatar_url
    FROM public.profiles
    WHERE id = v_user_id;

    -- Return safe public info
    RETURN jsonb_build_object(
        'found', true,
        'email', p_email,
        'first_name', COALESCE(v_first_name, 'Quible'),
        'last_name', COALESCE(v_last_name, 'User'),
        'profile_picture_url', v_avatar_url
    );
END;
$$;
