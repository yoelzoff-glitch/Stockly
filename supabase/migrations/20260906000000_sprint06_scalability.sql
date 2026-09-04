-- =====================================================================
-- SPRINT 6: SCALABILITY, DISTRIBUTED LEASES & RATE LIMITING
-- Migration: 20260906000000_sprint06_scalability.sql
-- =====================================================================

BEGIN;

-- Backend-only distributed operation leases.
CREATE TABLE IF NOT EXISTS public.operation_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  operation_type text NOT NULL,
  lease_owner text NOT NULL,
  acquired_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  heartbeat_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT operation_leases_tenant_op_key UNIQUE (tenant_id, operation_type),
  CONSTRAINT operation_leases_type_not_empty
    CHECK (length(btrim(operation_type)) BETWEEN 1 AND 100),
  CONSTRAINT operation_leases_owner_not_empty
    CHECK (length(btrim(lease_owner)) BETWEEN 1 AND 200),
  CONSTRAINT operation_leases_valid_expiration
    CHECK (expires_at > acquired_at)
);

-- The UNIQUE constraint already indexes (tenant_id, operation_type).
CREATE INDEX IF NOT EXISTS idx_operation_leases_expires
  ON public.operation_leases (expires_at);

ALTER TABLE public.operation_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_leases FORCE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.operation_leases FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.operation_leases FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.operation_leases FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.operation_leases TO service_role;

CREATE OR REPLACE FUNCTION public.acquire_operation_lease(
  p_tenant_id uuid,
  p_operation_type text,
  p_lease_owner text,
  p_ttl_seconds integer DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamp with time zone := now();
  v_expires timestamp with time zone;
  v_current_owner text;
  v_current_expires timestamp with time zone;
BEGIN
  IF p_tenant_id IS NULL
     OR p_operation_type IS NULL
     OR length(btrim(p_operation_type)) NOT BETWEEN 1 AND 100
     OR p_lease_owner IS NULL
     OR length(btrim(p_lease_owner)) NOT BETWEEN 1 AND 200
     OR p_ttl_seconds IS NULL
     OR p_ttl_seconds NOT BETWEEN 30 AND 3600 THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'invalid_parameters');
  END IF;

  PERFORM 1 FROM public.tenants WHERE id = p_tenant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'tenant_not_found');
  END IF;

  v_expires := v_now + make_interval(secs => p_ttl_seconds);

  -- Safe for the missing-row race: conflicting inserts wait and DO NOTHING.
  INSERT INTO public.operation_leases (
    tenant_id, operation_type, lease_owner, acquired_at, expires_at, heartbeat_at
  )
  VALUES (
    p_tenant_id, btrim(p_operation_type), p_lease_owner, v_now, v_expires, v_now
  )
  ON CONFLICT (tenant_id, operation_type) DO NOTHING;

  SELECT lease_owner, expires_at
    INTO v_current_owner, v_current_expires
  FROM public.operation_leases
  WHERE tenant_id = p_tenant_id
    AND operation_type = btrim(p_operation_type)
  FOR UPDATE;

  IF v_current_owner = p_lease_owner OR v_current_expires <= v_now THEN
    UPDATE public.operation_leases
    SET lease_owner = p_lease_owner,
        acquired_at = v_now,
        expires_at = v_expires,
        heartbeat_at = v_now
    WHERE tenant_id = p_tenant_id
      AND operation_type = btrim(p_operation_type);

    RETURN jsonb_build_object(
      'acquired', true,
      'tenant_id', p_tenant_id,
      'operation_type', btrim(p_operation_type),
      'lease_owner', p_lease_owner,
      'expires_at', v_expires
    );
  END IF;

  RETURN jsonb_build_object(
    'acquired', false,
    'reason', 'lease_held_by_other',
    'expires_at', v_current_expires
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_operation_lease(
  p_tenant_id uuid,
  p_operation_type text,
  p_lease_owner text,
  p_ttl_seconds integer DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamp with time zone := now();
  v_expires timestamp with time zone;
BEGIN
  IF p_tenant_id IS NULL
     OR p_operation_type IS NULL
     OR length(btrim(p_operation_type)) NOT BETWEEN 1 AND 100
     OR p_lease_owner IS NULL
     OR length(btrim(p_lease_owner)) NOT BETWEEN 1 AND 200
     OR p_ttl_seconds IS NULL
     OR p_ttl_seconds NOT BETWEEN 30 AND 3600 THEN
    RETURN jsonb_build_object('renewed', false, 'reason', 'invalid_parameters');
  END IF;

  v_expires := v_now + make_interval(secs => p_ttl_seconds);

  UPDATE public.operation_leases
  SET expires_at = v_expires,
      heartbeat_at = v_now
  WHERE tenant_id = p_tenant_id
    AND operation_type = btrim(p_operation_type)
    AND lease_owner = p_lease_owner;

  IF FOUND THEN
    RETURN jsonb_build_object('renewed', true, 'expires_at', v_expires);
  END IF;

  RETURN jsonb_build_object('renewed', false, 'reason', 'lease_not_found_or_lost');
END;
$$;

CREATE OR REPLACE FUNCTION public.release_operation_lease(
  p_tenant_id uuid,
  p_operation_type text,
  p_lease_owner text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_tenant_id IS NULL
     OR p_operation_type IS NULL
     OR length(btrim(p_operation_type)) NOT BETWEEN 1 AND 100
     OR p_lease_owner IS NULL
     OR length(btrim(p_lease_owner)) NOT BETWEEN 1 AND 200 THEN
    RETURN jsonb_build_object('released', false, 'reason', 'invalid_parameters');
  END IF;

  DELETE FROM public.operation_leases
  WHERE tenant_id = p_tenant_id
    AND operation_type = btrim(p_operation_type)
    AND lease_owner = p_lease_owner;

  IF FOUND THEN
    RETURN jsonb_build_object('released', true);
  END IF;

  RETURN jsonb_build_object('released', false, 'reason', 'lease_not_found_or_not_owner');
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_operation_lease(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_operation_lease(uuid, text, text, integer) TO service_role;
REVOKE ALL ON FUNCTION public.renew_operation_lease(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_operation_lease(uuid, text, text, integer) TO service_role;
REVOKE ALL ON FUNCTION public.release_operation_lease(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_operation_lease(uuid, text, text) TO service_role;

-- Backend-only distributed fixed-window rate limit buckets.
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bucket_key text NOT NULL,
  window_start timestamp with time zone NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rate_limit_buckets_tenant_key_window
    UNIQUE (tenant_id, bucket_key, window_start),
  CONSTRAINT rate_limit_request_count_nonnegative CHECK (request_count >= 0),
  CONSTRAINT rate_limit_bucket_key_not_empty
    CHECK (length(btrim(bucket_key)) BETWEEN 1 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_window
  ON public.rate_limit_buckets (window_start);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_buckets FORCE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.rate_limit_buckets FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.rate_limit_buckets FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.rate_limit_buckets FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_limit_buckets TO service_role;

CREATE OR REPLACE FUNCTION public.check_rate_limit_bucket(
  p_tenant_id uuid,
  p_bucket_key text,
  p_max_requests integer,
  p_window_seconds integer DEFAULT 60,
  p_cost integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamp with time zone := now();
  v_window_start timestamp with time zone;
  v_current_count integer;
  v_reset_seconds integer;
BEGIN
  IF p_tenant_id IS NULL
     OR p_bucket_key IS NULL
     OR length(btrim(p_bucket_key)) NOT BETWEEN 1 AND 100
     OR p_max_requests IS NULL
     OR p_max_requests NOT BETWEEN 1 AND 1000000
     OR p_window_seconds IS NULL
     OR p_window_seconds NOT BETWEEN 1 AND 86400
     OR p_cost IS NULL
     OR p_cost <= 0
     OR p_cost > p_max_requests THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'current', 0,
      'limit', COALESCE(p_max_requests, 0),
      'remaining', 0,
      'retry_after', 60,
      'reset_in_seconds', 60,
      'reason', 'invalid_parameters'
    );
  END IF;

  PERFORM 1 FROM public.tenants WHERE id = p_tenant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'current', 0,
      'limit', p_max_requests,
      'remaining', 0,
      'retry_after', 60,
      'reset_in_seconds', 60,
      'reason', 'tenant_not_found'
    );
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM v_now) / p_window_seconds) * p_window_seconds
  );
  v_reset_seconds := p_window_seconds -
    (extract(epoch FROM v_now)::integer % p_window_seconds);

  INSERT INTO public.rate_limit_buckets (
    tenant_id, bucket_key, window_start, request_count
  )
  VALUES (p_tenant_id, btrim(p_bucket_key), v_window_start, 0)
  ON CONFLICT (tenant_id, bucket_key, window_start) DO NOTHING;

  SELECT request_count
    INTO v_current_count
  FROM public.rate_limit_buckets
  WHERE tenant_id = p_tenant_id
    AND bucket_key = btrim(p_bucket_key)
    AND window_start = v_window_start
  FOR UPDATE;

  v_current_count := COALESCE(v_current_count, 0);

  IF (v_current_count + p_cost) > p_max_requests THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'current', v_current_count,
      'limit', p_max_requests,
      'remaining', GREATEST(0, p_max_requests - v_current_count),
      'retry_after', v_reset_seconds,
      'reset_in_seconds', v_reset_seconds
    );
  END IF;

  UPDATE public.rate_limit_buckets
  SET request_count = v_current_count + p_cost
  WHERE tenant_id = p_tenant_id
    AND bucket_key = btrim(p_bucket_key)
    AND window_start = v_window_start;

  RETURN jsonb_build_object(
    'allowed', true,
    'current', v_current_count + p_cost,
    'limit', p_max_requests,
    'remaining', GREATEST(0, p_max_requests - (v_current_count + p_cost)),
    'retry_after', 0,
    'reset_in_seconds', v_reset_seconds
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit_bucket(uuid, text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit_bucket(uuid, text, integer, integer, integer) TO service_role;

-- Bounded cleanup for expired leases and old fixed-window buckets.
CREATE OR REPLACE FUNCTION public.cleanup_scalability_state(
  p_rate_limit_before timestamp with time zone DEFAULT (now() - interval '2 days'),
  p_batch_size integer DEFAULT 1000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted_leases integer := 0;
  v_deleted_buckets integer := 0;
BEGIN
  IF p_rate_limit_before IS NULL
     OR p_batch_size IS NULL
     OR p_batch_size NOT BETWEEN 1 AND 10000 THEN
    RETURN jsonb_build_object('cleaned', false, 'reason', 'invalid_parameters');
  END IF;

  WITH targets AS (
    SELECT id
    FROM public.operation_leases
    WHERE expires_at <= now()
    ORDER BY expires_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.operation_leases AS leases
  USING targets
  WHERE leases.id = targets.id;
  GET DIAGNOSTICS v_deleted_leases = ROW_COUNT;

  WITH targets AS (
    SELECT id
    FROM public.rate_limit_buckets
    WHERE window_start < p_rate_limit_before
    ORDER BY window_start
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.rate_limit_buckets AS buckets
  USING targets
  WHERE buckets.id = targets.id;
  GET DIAGNOSTICS v_deleted_buckets = ROW_COUNT;

  RETURN jsonb_build_object(
    'cleaned', true,
    'deleted_leases', v_deleted_leases,
    'deleted_buckets', v_deleted_buckets
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_scalability_state(timestamp with time zone, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_scalability_state(timestamp with time zone, integer) TO service_role;

-- Indexes retained only when they are not equivalent to an existing index.
-- Sprint 3 already created idx_orders_tenant_date (tenant_id, date_created DESC).
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status_date_created
  ON public.orders (tenant_id, status, date_created DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant_meli_item
  ON public.order_items (tenant_id, meli_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_created
  ON public.stock_movements (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_tenant_status_updated
  ON public.products (tenant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant_unread_created
  ON public.alerts (tenant_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_runs_tenant_op_started
  ON public.operation_runs (tenant_id, operation_type, started_at DESC);

COMMIT;
