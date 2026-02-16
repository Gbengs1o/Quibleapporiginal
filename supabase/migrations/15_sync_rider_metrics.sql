-- Function to update rider rating
CREATE OR REPLACE FUNCTION update_rider_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE riders
  SET average_rating = (
    SELECT COALESCE(AVG(rating), 5.0)
    FROM reviews
    WHERE reviewee_id = NEW.reviewee_id
  )
  WHERE user_id = NEW.reviewee_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for reviews
DROP TRIGGER IF EXISTS on_review_change ON reviews;
CREATE TRIGGER on_review_change
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_rider_rating();

-- Function to update rider total jobs
CREATE OR REPLACE FUNCTION update_rider_jobs()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if status changed to 'delivered' or if it was already 'delivered' (for corrections)
  IF (NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered')) OR
     (TG_OP = 'DELETE' AND OLD.status = 'delivered') THEN
     
    UPDATE riders
    SET total_jobs = (
      SELECT COUNT(*)
      FROM delivery_requests
      WHERE rider_id = (CASE WHEN TG_OP = 'DELETE' THEN OLD.rider_id ELSE NEW.rider_id END)
      AND status = 'delivered'
    )
    WHERE user_id = (CASE WHEN TG_OP = 'DELETE' THEN OLD.rider_id ELSE NEW.rider_id END);
    
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for delivery requests
DROP TRIGGER IF EXISTS on_job_complete ON delivery_requests;
CREATE TRIGGER on_job_complete
AFTER INSERT OR UPDATE OR DELETE ON delivery_requests
FOR EACH ROW
EXECUTE FUNCTION update_rider_jobs();

-- Recalculate existing data
UPDATE riders r
SET 
    average_rating = (SELECT COALESCE(AVG(rating), 5.0) FROM reviews WHERE reviewee_id = r.user_id),
    total_jobs = (SELECT COUNT(*) FROM delivery_requests WHERE rider_id = r.user_id AND status = 'delivered');
