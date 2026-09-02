-- =====================================================================
-- MIGRATION: 20260902000000_add_tenant_feature_flags.sql
-- Description: Creates tenant_feature_flags table for progressive rollout
-- Author: Senior Full Stack Engineer (Sprint 1/8 Safety Baseline)
-- Safe: Additive only, IF NOT EXISTS, RLS enabled, restricted to service_role
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.tenant_feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    flag_key TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT tenant_feature_flags_tenant_id_flag_key_key UNIQUE (tenant_id, flag_key)
);

-- Index for fast lookup by tenant and flag
CREATE INDEX IF NOT EXISTS idx_tenant_feature_flags_lookup 
ON public.tenant_feature_flags (tenant_id, flag_key);

-- Security: Enable RLS
ALTER TABLE public.tenant_feature_flags ENABLE ROW LEVEL SECURITY;

-- Explicit Grants: Revoke public/client access, allow only authorized backend service_role
REVOKE ALL ON public.tenant_feature_flags FROM PUBLIC;
REVOKE ALL ON public.tenant_feature_flags FROM anon, authenticated;
GRANT ALL ON public.tenant_feature_flags TO service_role;

-- =====================================================================
-- ROLLBACK INSTRUCTIONS (DO NOT RUN AUTOMATICALLY):
-- DROP TABLE IF EXISTS public.tenant_feature_flags CASCADE;
-- =====================================================================
