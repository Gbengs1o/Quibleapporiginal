-- 1. Create Delivery Requests Table (For Bidding, Point A -> Point B)
CREATE TYPE request_status AS ENUM (
  'pending',    -- Created by user, waiting for bids
  'accepted',   -- Rider accepted (bid or offer)
  'picked_up',  -- Rider has the package
  'delivered',  -- Completed
  'cancelled'   -- Cancelled by user or system
);

CREATE TABLE IF NOT EXISTS public.delivery_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    rider_id UUID REFERENCES public.riders(user_id), -- Assigned rider
    
    -- Locations
    pickup_address TEXT NOT NULL,
    pickup_latitude FLOAT NOT NULL,
    pickup_longitude FLOAT NOT NULL,
    
    dropoff_address TEXT NOT NULL,
    dropoff_latitude FLOAT NOT NULL,
    dropoff_longitude FLOAT NOT NULL,
    
    -- Item Details
    item_description TEXT NOT NULL,
    item_image_url TEXT,
    item_type TEXT DEFAULT 'parcel', -- document, parcel, fragile, etc.
    
    -- Pricing (Bidding Logic)
    offered_price DECIMAL(10,2) NOT NULL, -- User's initial offer
    final_price DECIMAL(10,2),            -- Agreed price
    
    status request_status DEFAULT 'pending',
    payment_method TEXT DEFAULT 'wallet', -- active choice for now
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Delivery Bids Table (Riders bidding on requests)
CREATE TABLE IF NOT EXISTS public.delivery_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.delivery_requests(id) ON DELETE CASCADE NOT NULL,
    rider_id UUID REFERENCES public.riders(user_id) NOT NULL,
    amount DECIMAL(10,2) NOT NULL, -- The bid amount
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Update Orders Table (For Food/Grocery - Fixed Price)
-- Adding columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_fee') THEN
        ALTER TABLE public.orders ADD COLUMN delivery_fee DECIMAL(10,2) DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'rider_id') THEN
        ALTER TABLE public.orders ADD COLUMN rider_id UUID REFERENCES public.riders(user_id);
    END IF;
END $$;

-- 4. Enable RLS
ALTER TABLE public.delivery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_bids ENABLE ROW LEVEL SECURITY;

-- 5. Policies

-- Delivery Requests Policies
CREATE POLICY "Users can insert own requests" ON public.delivery_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own requests" ON public.delivery_requests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Riders can view pending requests" ON public.delivery_requests
    FOR SELECT USING (status = 'pending' OR rider_id = auth.uid()); 
    -- Riders need to see pending requests to bid, and their own accepted jobs

CREATE POLICY "Riders can update assigned requests" ON public.delivery_requests
    FOR UPDATE USING (rider_id = auth.uid()); 
    -- To update status to picked_up/delivered

CREATE POLICY "Users can update own requests" ON public.delivery_requests
    FOR UPDATE USING (user_id = auth.uid());
    -- To update status (cancel) or assign rider

-- Delivery Bids Policies
CREATE POLICY "Riders can insert bids" ON public.delivery_bids
    FOR INSERT WITH CHECK (auth.uid() = rider_id);

CREATE POLICY "Users can view bids for their requests" ON public.delivery_bids
    FOR SELECT USING (
        request_id IN (SELECT id FROM public.delivery_requests WHERE user_id = auth.uid())
    );

CREATE POLICY "Riders can view own bids" ON public.delivery_bids
    FOR SELECT USING (auth.uid() = rider_id);

-- 6. Helper RPCs

-- Calculate Food Delivery Fee (Fixed Price Logic)
-- Returns fee based on distance (Basic Haversine approximation or just flat logic for now)
CREATE OR REPLACE FUNCTION calculate_delivery_fee(
    lat1 FLOAT, lng1 FLOAT, 
    lat2 FLOAT, lng2 FLOAT
)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $$
DECLARE
    dist_km FLOAT;
    base_fee DECIMAL := 500.00; -- NGN
    per_km_fee DECIMAL := 100.00; -- NGN
BEGIN
    -- Simple distance calculation (Earth radius ~6371km)
    -- This is a rough estimation for SQL side. Ideally use Google Maps API on client/edge function for precise routing.
    -- However, for simple fee estimation:
    dist_km := 6371 * acos(
        cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1)) + 
        sin(radians(lat1)) * sin(radians(lat2))
    );
    
    RETURN base_fee + (GREATEST(dist_km, 1) * per_km_fee);
END;
$$;
