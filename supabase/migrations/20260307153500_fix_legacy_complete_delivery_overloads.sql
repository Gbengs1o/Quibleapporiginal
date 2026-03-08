-- Align legacy complete_delivery_job_v2 overloads with the safe implementation.
-- Some old overloads still referenced wallets.rider_id (removed from schema).

CREATE OR REPLACE FUNCTION public.complete_delivery_job_v2(
    p_request_id uuid,
    p_lat double precision DEFAULT NULL,
    p_lng double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.complete_delivery_job_v2(
        p_request_id,
        NULL::text,
        p_lat,
        p_lng
    );
END;
$$;


CREATE OR REPLACE FUNCTION public.complete_delivery_job_v2(
    p_request_id uuid,
    p_lat double precision DEFAULT NULL,
    p_lng double precision DEFAULT NULL,
    p_delivery_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.complete_delivery_job_v2(
        p_request_id,
        p_delivery_code,
        p_lat,
        p_lng
    );
END;
$$;
