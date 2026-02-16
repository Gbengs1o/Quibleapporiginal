-- Enable public read access to riders table (so customers can see profiles and location)
DROP POLICY IF EXISTS "Riders can view own profile" ON riders;

CREATE POLICY "Riders are viewable by everyone" 
ON riders FOR SELECT 
USING (true);

-- Ensure we don't break the update policy
-- (Previous update policy was: "Riders can update own profile" USING (auth.uid() = user_id))
-- That one is still valid and should remain.
