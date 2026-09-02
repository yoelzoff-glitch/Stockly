-- =====================================================================
-- MIGRATION: 20260902000001_add_operation_runs.sql
-- Description: Creates operation_runs table for background job & sync execution tracking
-- Author: Senior Full Stack Engineer (Sprint 1/8 Safety Baseline)
-- Safe: Additive only, IF NOT EXISTS, RLS enabled, restricted to service_role
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.operation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    operation_type TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'partial', 'failed', 'skipped')),
    correlation_id TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration_ms INTEGER,
    items_processed INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    error_code TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance and diagnostics
CREATE INDEX IF NOT EXISTS idx_operation_runs_tenant_started ON public.operation_runs (tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_runs_type_started ON public.operation_runs (operation_type, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_runs_status_started ON public.operation_runs (status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_runs_correlation_id ON public.operation_runs (correlation_id);

-- Security: Enable RLS
ALTER TABLE public.operation_runs ENABLE ROW LEVEL SECURITY;

-- Explicit Grants: Revoke public/client access, allow only authorized backend service_role
REVOKE ALL ON public.operation_runs FROM anon, authenticated;
GRANT ALL ON public.operation_runs TO service_role;

-- =====================================================================
-- ROLLBACK INSTRUCTIONS (DO NOT RUN AUTOMATICALLY):
-- DROP TABLE IF EXISTS public.operation_runs CASCADE;
-- =====================================================================
