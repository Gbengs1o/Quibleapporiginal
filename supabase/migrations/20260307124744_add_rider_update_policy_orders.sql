-- Allow riders to update statuses on orders assigned to them.
-- Needed for rider app transitions (ready -> with_rider -> out_for_delivery).

DROP POLICY IF EXISTS "Riders can update assigned orders" ON public.orders;

CREATE POLICY "Riders can update assigned orders"
ON public.orders
FOR UPDATE
TO public
USING (rider_id = auth.uid())
WITH CHECK (rider_id = auth.uid());
