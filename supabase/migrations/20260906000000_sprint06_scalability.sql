-- =====================================================================
-- SPRINT 6: SCALABILITY, PERFORMANCE, DISTRIBUTED LEASES & AGGREGATES
-- Migration: 20260906000000_sprint06_scalability.sql
-- =====================================================================

BEGIN;

-- 1. Create backend-only operation_leases table for distributed locking
CREATE TABLE IF NOT EXISTS public.operation_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  operation_type text NOT NULL, -- 'sync_products' | 'sync_orders' | 'sync_shipments' | 'refresh_tokens' | 'recalculate_profitability'
  lease_owner text NOT NULL, -- worker_id / instance_id / run_id
  acquired_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  heartbeat_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT operation_leases_tenant_op_key UNIQUE (tenant_id, operation_type)
);

CREATE INDEX IF NOT EXISTS idx_operation_leases_tenant_op
  ON public.operation_leases (tenant_id, operation_type);

CREATE INDEX IF NOT EXISTS idx_operation_leases_expires
  ON public.operation_leases (expires_at);

ALTER TABLE public.operation_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_leases FORCE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.operation_leases FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.operation_leases FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.operation_leases FROM authenticated;

-- 2. Atomic Lease Acquisition RPC
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
  v_now timestamp with time zone;
  v_expires timestamp with time zone;
  v_current_lease record;
BEGIN
  v_now := timezone('utc', now());
  v_expires := v_now + (p_ttl_seconds || ' seconds')::interval;

  -- 1. Ensure a row exists atomically
  INSERT INTO public.operation_leases (tenant_id, operation_type, lease_owner, acquired_at, expires_at, heartbeat_at)
  VALUES (p_tenant_id, p_operation_type, p_lease_owner, v_now, v_expires, v_now)
  ON CONFLICT (tenant_id, operation_type) DO NOTHING;

  -- 2. Lock the row exclusively
  SELECT * INTO v_current_lease
  FROM public.operation_leases
  WHERE tenant_id = p_tenant_id AND operation_type = p_operation_type
  FOR UPDATE;

  -- 3. Check if we own it or if it is expired
  IF v_current_lease.lease_owner = p_lease_owner OR v_current_lease.expires_at <= v_now THEN
    UPDATE public.operation_leases
    SET lease_owner = p_lease_owner,
        acquired_at = v_now,
        expires_at = v_expires,
        heartbeat_at = v_now
    WHERE tenant_id = p_tenant_id AND operation_type = p_operation_type;

    RETURN jsonb_build_object(
      'acquired', true,
      'tenant_id', p_tenant_id,
      'operation_type', p_operation_type,
      'lease_owner', p_lease_owner,
      'expires_at', v_expires
    );
  ELSE
    -- Active lease held by another worker
    RETURN jsonb_build_object(
      'acquired', false,
      'reason', 'lease_held_by_other',
      'current_owner', v_current_lease.lease_owner,
      'expires_at', v_current_lease.expires_at
    );
  END IF;
END;
$$;

-- 3. Lease Renewal RPC
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
  v_now timestamp with time zone;
  v_expires timestamp with time zone;
BEGIN
  v_now := timezone('utc', now());
  v_expires := v_now + (p_ttl_seconds || ' seconds')::interval;

  UPDATE public.operation_leases
  SET expires_at = v_expires,
      heartbeat_at = v_now
  WHERE tenant_id = p_tenant_id
    AND operation_type = p_operation_type
    AND lease_owner = p_lease_owner;

  IF FOUND THEN
    RETURN jsonb_build_object('renewed', true, 'expires_at', v_expires);
  ELSE
    RETURN jsonb_build_object('renewed', false, 'reason', 'lease_not_found_or_lost');
  END IF;
END;
$$;

-- 4. Lease Release RPC
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
  DELETE FROM public.operation_leases
  WHERE tenant_id = p_tenant_id
    AND operation_type = p_operation_type
    AND lease_owner = p_lease_owner;

  IF FOUND THEN
    RETURN jsonb_build_object('released', true);
  ELSE
    RETURN jsonb_build_object('released', false, 'reason', 'lease_not_found_or_not_owner');
  END IF;
END;
$$;

-- Permissions for Lease Functions
REVOKE ALL ON FUNCTION public.acquire_operation_lease(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_operation_lease(uuid, text, text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.renew_operation_lease(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_operation_lease(uuid, text, text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.release_operation_lease(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_operation_lease(uuid, text, text) TO service_role;

-- 5. Distributed Rate Limit Buckets Table
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bucket_key text NOT NULL, -- e.g. 'ai_chat', 'sales_export', 'sync_manual'
  window_start timestamp with time zone NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rate_limit_buckets_tenant_key_window UNIQUE (tenant_id, bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_window
  ON public.rate_limit_buckets (window_start);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_buckets FORCE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.rate_limit_buckets FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.rate_limit_buckets FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.rate_limit_buckets FROM authenticated;

-- 6. Atomic Distributed Rate Limiter RPC
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
  v_now timestamp with time zone;
  v_window_start timestamp with time zone;
  v_current_count integer;
  v_reset_seconds integer;
BEGIN
  -- Strict validation of input parameters: reject cost <= 0, window_seconds <= 0, max_requests <= 0, empty bucket_key or null tenant
  IF p_tenant_id IS NULL OR p_bucket_key IS NULL OR length(trim(p_bucket_key)) = 0 OR p_max_requests <= 0 OR p_window_seconds <= 0 OR p_cost <= 0 THEN
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

  v_now := timezone('utc', now());
  -- Calculate fixed window start based on window_seconds
  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );
  v_reset_seconds := p_window_seconds - (extract(epoch from v_now)::integer % p_window_seconds);

  -- Upsert window row
  INSERT INTO public.rate_limit_buckets (tenant_id, bucket_key, window_start, request_count)
  VALUES (p_tenant_id, p_bucket_key, v_window_start, 0)
  ON CONFLICT (tenant_id, bucket_key, window_start) DO NOTHING;

  -- Lock row FOR UPDATE to increment atomically
  SELECT request_count INTO v_current_count
  FROM public.rate_limit_buckets
  WHERE tenant_id = p_tenant_id
    AND bucket_key = p_bucket_key
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
    AND bucket_key = p_bucket_key
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

-- 7. Composite Performance Indexes (Validated for Real Multi-Tenant Queries)
-- Note: idx_orders_tenant_date on (tenant_id, date_created DESC) was already created in sprint 3d.
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
