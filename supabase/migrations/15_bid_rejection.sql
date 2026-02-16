-- Add status column to delivery_bids to allow rejection
ALTER TABLE public.delivery_bids 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'; 
-- 'pending', 'accepted', 'rejected'

-- Allow request owners (Users) to update bids (to reject them)
CREATE POLICY "Request owners can update bids" ON public.delivery_bids
    FOR UPDATE USING (
        request_id IN (SELECT id FROM public.delivery_requests WHERE user_id = auth.uid())
    );
