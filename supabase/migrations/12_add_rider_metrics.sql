ALTER TABLE riders
ADD COLUMN IF NOT EXISTS average_rating numeric DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS total_jobs integer DEFAULT 0;
