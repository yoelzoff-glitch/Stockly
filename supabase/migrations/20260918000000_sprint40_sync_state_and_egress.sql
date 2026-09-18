-- =====================================================================
-- SPRINT 40: EVENT-DRIVEN EGRESS REDUCTION & PERSISTENT TELEMETRY
-- Migration: 20260918000000_sprint40_sync_state_and_egress.sql
-- Description: Creates meli_sync_state for incremental watermarks &
--              coalescing, and egress_hourly_metrics for real telemetry.
-- Safe: Additive only, IF NOT EXISTS, RLS enabled, restricted to service_role
-- =====================================================================

-- 1. MELI SYNC STATE TABLE
CREATE TABLE IF NOT EXISTS public.meli_sync_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL, -- 'orders' | 'products' | 'shipments' | 'cancellations'
    last_successful_sync_at TIMESTAMPTZ,
    products_dirty BOOLEAN NOT NULL DEFAULT false,
    sync_in_progress BOOLEAN NOT NULL DEFAULT false,
    last_item_event_at TIMESTAMPTZ,
    last_full_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT meli_sync_state_tenant_resource_key UNIQUE (tenant_id, resource_type)
);

CREATE INDEX IF NOT EXISTS idx_meli_sync_state_lookup 
ON public.meli_sync_state (tenant_id, resource_type);

ALTER TABLE public.meli_sync_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meli_sync_state FROM PUBLIC;
REVOKE ALL ON public.meli_sync_state FROM anon, authenticated;
GRANT ALL ON public.meli_sync_state TO service_role;

-- 2. EGRESS HOURLY METRICS TABLE
CREATE TABLE IF NOT EXISTS public.egress_hourly_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bucket_hour TIMESTAMPTZ NOT NULL,
    operation TEXT NOT NULL,
    table_name TEXT NOT NULL,
    query_count INTEGER NOT NULL DEFAULT 1,
    rows_count INTEGER NOT NULL DEFAULT 0,
    estimated_bytes BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT egress_hourly_metrics_unique UNIQUE (tenant_id, bucket_hour, operation, table_name)
);

CREATE INDEX IF NOT EXISTS idx_egress_hourly_metrics_tenant_hour 
ON public.egress_hourly_metrics (tenant_id, bucket_hour DESC);

CREATE INDEX IF NOT EXISTS idx_egress_hourly_metrics_operation_hour 
ON public.egress_hourly_metrics (operation, bucket_hour DESC);

ALTER TABLE public.egress_hourly_metrics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.egress_hourly_metrics FROM PUBLIC;
REVOKE ALL ON public.egress_hourly_metrics FROM anon, authenticated;
GRANT ALL ON public.egress_hourly_metrics TO service_role;

-- 3. ATOMIC INCREMENTAL UPSERT RPC FUNCTION
CREATE OR REPLACE FUNCTION public.record_egress_metrics(
    p_tenant_id UUID,
    p_bucket_hour TIMESTAMPTZ,
    p_operation TEXT,
    p_table_name TEXT,
    p_query_count INTEGER,
    p_rows_count INTEGER,
    p_estimated_bytes BIGINT
) RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.egress_hourly_metrics (
        tenant_id,
        bucket_hour,
        operation,
        table_name,
        query_count,
        rows_count,
        estimated_bytes,
        updated_at
    ) VALUES (
        p_tenant_id,
        p_bucket_hour,
        p_operation,
        p_table_name,
        p_query_count,
        p_rows_count,
        p_estimated_bytes,
        NOW()
    )
    ON CONFLICT (tenant_id, bucket_hour, operation, table_name)
    DO UPDATE SET
        query_count = public.egress_hourly_metrics.query_count + EXCLUDED.query_count,
        rows_count = public.egress_hourly_metrics.rows_count + EXCLUDED.rows_count,
        estimated_bytes = public.egress_hourly_metrics.estimated_bytes + EXCLUDED.estimated_bytes,
        updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_egress_metrics(UUID, TIMESTAMPTZ, TEXT, TEXT, INTEGER, INTEGER, BIGINT) TO service_role;
