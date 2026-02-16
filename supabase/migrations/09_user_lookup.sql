-- 9. User Lookup RPC
-- Allows resolving a recipient's name by email for transfer verification
CREATE OR REPLACE FUNCTION get_recipient_name(
    recipient_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    found_user_id UUID;
    user_meta JSONB;
    first_name TEXT;
    last_name TEXT;
    full_name TEXT;
BEGIN
    -- 1. Find User by Email
    SELECT id, raw_user_meta_data INTO found_user_id, user_meta
    FROM auth.users
    WHERE email = recipient_email
    LIMIT 1;

    IF found_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'User not found');
    END IF;

    -- 2. Extract Name from Metadata
    -- Adjust keys based on your auth setup (e.g., 'full_name', 'name', or 'first_name'/'last_name')
    first_name := user_meta->>'first_name';
    last_name := user_meta->>'last_name';
    
    IF first_name IS NOT NULL OR last_name IS NOT NULL THEN
        full_name := TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''));
    ELSE
        -- Fallback if no specific name fields
        full_name := user_meta->>'full_name';
        IF full_name IS NULL THEN
             full_name := 'Valued User'; -- Fallback privacy-safe name or just show part of email
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'data', jsonb_build_object(
            'name', full_name,
            'id', found_user_id
        )
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
