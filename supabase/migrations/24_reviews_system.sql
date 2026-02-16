-- 24_reviews_system.sql

CREATE TYPE review_role AS ENUM ('rider', 'user');

CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.delivery_requests(id) NOT NULL,
    reviewer_id UUID REFERENCES auth.users(id) NOT NULL,
    reviewee_id UUID REFERENCES auth.users(id) NOT NULL, -- The person being reviewed
    role review_role NOT NULL, -- Role of the REVIEWER (e.g., 'rider' means rider reviewed user)
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read reviews" ON public.reviews
    FOR SELECT USING (true);

CREATE POLICY "Users can create reviews" ON public.reviews
    FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- Helper to get average rating
CREATE OR REPLACE FUNCTION public.get_user_rating(p_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    v_avg DECIMAL;
BEGIN
    SELECT AVG(rating) INTO v_avg
    FROM public.reviews
    WHERE reviewee_id = p_user_id;
    
    RETURN COALESCE(ROUND(v_avg, 1), 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
