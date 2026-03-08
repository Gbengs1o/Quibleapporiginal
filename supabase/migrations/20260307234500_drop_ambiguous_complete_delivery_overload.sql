-- Remove ambiguous complete_delivery_job_v2 overload that breaks RPC resolution
-- when calling with named parameters (p_request_id, p_delivery_code, p_lat, p_lng).

DROP FUNCTION IF EXISTS public.complete_delivery_job_v2(
    uuid,
    double precision,
    double precision,
    text
);
