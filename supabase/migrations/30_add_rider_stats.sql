-- Add stats columns to riders table
ALTER TABLE riders 
ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3, 2) DEFAULT 5.00,
ADD COLUMN IF NOT EXISTS total_jobs INTEGER DEFAULT 0;

-- Update existing riders to have default values (optional, but good for cleanliness)
UPDATE riders SET average_rating = 5.00 WHERE average_rating IS NULL;
UPDATE riders SET total_jobs = 0 WHERE total_jobs IS NULL;
