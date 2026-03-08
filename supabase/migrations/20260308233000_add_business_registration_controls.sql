-- Business registration controls
-- Default behavior:
-- single_business_mode_enabled = true
-- meaning users who already have a business profile will not see the add-service (+) button.

INSERT INTO public.platform_settings (key, value, description, updated_at)
VALUES (
    'business_registration_controls',
    '{"single_business_mode_enabled": true}'::jsonb,
    'Controls whether users can create multiple business profiles from the app side menu',
    NOW()
)
ON CONFLICT (key) DO UPDATE
SET
    value = COALESCE(public.platform_settings.value, '{}'::jsonb) || EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW()
WHERE public.platform_settings.key = 'business_registration_controls';
