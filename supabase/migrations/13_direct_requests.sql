-- Create enum for request status
CREATE TYPE request_status AS ENUM ('pending', 'accepted', 'rejected', 'bid', 'cancelled');

-- Create rider_requests table
CREATE TABLE IF NOT EXISTS rider_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rider_id UUID NOT NULL REFERENCES riders(user_id) ON DELETE CASCADE, -- Assuming riders.user_id is the PK or unique
    status request_status DEFAULT 'pending',
    pickup_location JSONB NOT NULL,
    dropoff_location JSONB NOT NULL,
    offered_price NUMERIC NOT NULL,
    bid_price NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE rider_requests ENABLE ROW LEVEL SECURITY;

-- Policies
-- Users can see their own requests
CREATE POLICY "Users can view their own requests" ON rider_requests
    FOR SELECT USING (auth.uid() = user_id);

-- Riders can see requests assigned to them
CREATE POLICY "Riders can view requests assigned to them" ON rider_requests
    FOR SELECT USING (auth.uid() = rider_id);

-- Users can insert requests
CREATE POLICY "Users can create requests" ON rider_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Riders and Users can update requests (for status changes)
CREATE POLICY "Users and Riders can update requests" ON rider_requests
    FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = rider_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE rider_requests;
