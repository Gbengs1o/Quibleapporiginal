-- Create Reviews Table
CREATE TYPE review_role AS ENUM ('rider', 'user');

CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.delivery_requests(id) NOT NULL,
    reviewer_id UUID REFERENCES auth.users(id) NOT NULL,
    reviewee_id UUID REFERENCES auth.users(id) NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- Nullable for riders commenting on users
    comment TEXT,
    role review_role NOT NULL, -- 'rider' means a rider WROTE this review (about a user)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews (public profiles)
CREATE POLICY "Public reviews" ON public.reviews
    FOR SELECT USING (true);

-- Authenticated users can create reviews
CREATE POLICY "Users can create reviews" ON public.reviews
    FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- Helper to get rider average rating
CREATE OR REPLACE FUNCTION get_rider_rating(r_id UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(AVG(rating), 0)
        FROM public.reviews
        WHERE reviewee_id = r_id AND role = 'user' -- Reviews WRITTEN BY users ABOUT this rider
    );
END;
$$;

-- Helper to get total deliveries
CREATE OR REPLACE FUNCTION get_rider_delivery_count(r_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM public.delivery_requests
        WHERE rider_id = r_id AND status = 'delivered'
    );
END;
$$;
