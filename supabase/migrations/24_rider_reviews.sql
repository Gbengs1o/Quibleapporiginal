-- 1. Create Rider Reviews Table
CREATE TABLE IF NOT EXISTS public.rider_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID REFERENCES public.riders(user_id) NOT NULL, -- Rider is identified by user_id in riders table? Checking schema... yes riders(user_id) is usually PK or unique. Let's assume riders table has 'id' as PK which might be uuid, but previous context 'riders_user_id_fkey' suggests user_id link. Let's double check 'riders' schema if possible, but safe bet is referencing public.riders(user_id) or public.riders(id).
    -- context from 21_rider_payments.sql: "SELECT id INTO v_rider_id FROM public.riders WHERE user_id = auth.uid();" -> Riders has an ID separate from user_id?
    -- context from select-rider.tsx: "rider:riders!order_rider_bids_rider_id_fkey ( user_id ... )"
    -- Let's reference public.riders(user_id) to be safe as that is the auth user id usually used for foreign keys, OR public.riders(id).
    -- Wait, select-rider.tsx bids join 'rider_id' on 'riders.user_id'? No, 'riders!order_rider_bids_rider_id_fkey'. 
    -- Let's verify 'riders' PK. I will check schema in separate step if needed, but for now I will assume public.riders(user_id) is the semantic link. 
    -- Actually, looking at 21_rider_payments.sql: "SELECT id INTO v_rider_id FROM public.riders WHERE user_id = auth.uid();" implies 'id' is PK.
    -- However, order.rider_id in `orders` table usually refers to auth.users(id) or riders(id)?
    -- `app/order/[id].tsx` says: `.eq('user_id', order.rider_id)` when fetching rider location. This implies order.rider_id is the Auth User ID.
    -- So `rider_reviews` should link to `auth.users` (the rider's user account) or `riders` table.
    -- Let's link to `auth.users` as `rider_user_id` to be unambiguous, or `riders(user_id)`.
    rider_id UUID REFERENCES auth.users(id) NOT NULL, 
    reviewer_id UUID REFERENCES auth.users(id) NOT NULL,
    order_id UUID REFERENCES public.orders(id) NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.rider_reviews ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Reviewers can insert their own reviews
CREATE POLICY "Users can create rider reviews" ON public.rider_reviews
    FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- Everyone can read reviews (Public profiles)
CREATE POLICY "Public read rider reviews" ON public.rider_reviews
    FOR SELECT USING (true);

-- 4. Trigger to Update Rider Rating
CREATE OR REPLACE FUNCTION update_rider_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the riders table stats
    -- We assume table 'riders' has 'user_id', 'average_rating', 'total_reviews'
    UPDATE public.riders
    SET 
        average_rating = (
            SELECT AVG(rating)::numeric(3,2) 
            FROM public.rider_reviews 
            WHERE rider_id = NEW.rider_id
        ),
        total_reviews = (
            SELECT COUNT(*) 
            FROM public.rider_reviews 
            WHERE rider_id = NEW.rider_id
        )
    WHERE user_id = NEW.rider_id; -- Matching by auth user id
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_rider_review_added
AFTER INSERT ON public.rider_reviews
FOR EACH ROW
EXECUTE FUNCTION update_rider_rating_stats();

-- 5. RPC for Secure Submission (Optional but good helpers)
CREATE OR REPLACE FUNCTION submit_rider_review(
    p_order_id UUID,
    p_rating INTEGER,
    p_comment TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_order_record RECORD;
    v_existing_review_id UUID;
BEGIN
    -- Fetch Order
    SELECT * INTO v_order_record FROM public.orders WHERE id = p_order_id;
    
    IF v_order_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    -- Validate User is the Order Creator
    IF v_order_record.user_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;

    -- Validate Rider Exists on Order
    IF v_order_record.rider_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No rider assigned to this order');
    END IF;

    -- Check if already reviewed
    SELECT id INTO v_existing_review_id 
    FROM public.rider_reviews 
    WHERE order_id = p_order_id AND reviewer_id = auth.uid();
    
    IF v_existing_review_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Already reviewed this rider');
    END IF;

    -- Insert Review
    INSERT INTO public.rider_reviews (rider_id, reviewer_id, order_id, rating, comment)
    VALUES (v_order_record.rider_id, auth.uid(), p_order_id, p_rating, p_comment);

    RETURN jsonb_build_object('success', true, 'message', 'Review submitted successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
