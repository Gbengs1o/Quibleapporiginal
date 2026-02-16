-- Migration 49: Support Configuration Table

-- 1. Create the table to store support settings
CREATE TABLE IF NOT EXISTS public.support_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_enabled BOOLEAN DEFAULT true,
    whatsapp_number TEXT DEFAULT '',
    email_enabled BOOLEAN DEFAULT true,
    email_address TEXT DEFAULT 'support@quible.com',
    call_center_enabled BOOLEAN DEFAULT false,
    call_center_number TEXT DEFAULT '',
    live_chat_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insert the single configuration row (ensure only one exists)
INSERT INTO public.support_config (id, whatsapp_number, email_address)
VALUES ('00000000-0000-0000-0000-000000000000', '+1234567890', 'support@quible.com')
ON CONFLICT (id) DO NOTHING;

-- 3. Enable RLS
ALTER TABLE public.support_config ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- Everyone (anon, authenticated) can READ the config
CREATE POLICY "Allow public read access" ON public.support_config
FOR SELECT USING (true);

-- Only Admins can UPDATE the config
CREATE POLICY "Allow admin update access" ON public.support_config
FOR UPDATE USING (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

-- Protect INSERT/DELETE (Fixed config row)
CREATE POLICY "Deny insert" ON public.support_config FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny delete" ON public.support_config FOR DELETE USING (false);
