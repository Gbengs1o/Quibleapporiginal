-- Migration 50: Feedback Table

-- 1. Create the feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type TEXT CHECK (type IN ('bug', 'improvement', 'other')) DEFAULT 'other',
    message TEXT NOT NULL,
    status TEXT CHECK (status IN ('open', 'in_progress', 'closed')) DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- 3. Policies

-- Authenticated users can INSERT feedback
CREATE POLICY "Allow authenticated insert" ON public.feedback
FOR INSERTTO authenticated
WITH CHECK (true);

-- Users can VIEW their own feedback
CREATE POLICY "Allow individual view" ON public.feedback
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Admins can VIEW ALL feedback
CREATE POLICY "Allow admin view all" ON public.feedback
FOR SELECT TO authenticated
USING (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

-- Admins can UPDATE feedback (to close it)
CREATE POLICY "Allow admin update" ON public.feedback
FOR UPDATE TO authenticated
USING (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);
