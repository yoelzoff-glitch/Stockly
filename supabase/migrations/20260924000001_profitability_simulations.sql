-- ==============================================================================
-- SPRINT: SIMULADOR DE RENTABILIDAD Y PRECIOS
-- Migration: 20260924000001_profitability_simulations.sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.profitability_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  scenario_mode text NOT NULL DEFAULT 'profit',
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for tenant isolation and sorting
CREATE INDEX IF NOT EXISTS idx_profitability_simulations_tenant_created 
  ON public.profitability_simulations (tenant_id, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profitability_simulations ENABLE ROW LEVEL SECURITY;

-- Idempotent Tenant RLS Policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "profitability_simulations_tenant_select" ON public.profitability_simulations;
  DROP POLICY IF EXISTS "profitability_simulations_tenant_insert" ON public.profitability_simulations;
  DROP POLICY IF EXISTS "profitability_simulations_tenant_update" ON public.profitability_simulations;
  DROP POLICY IF EXISTS "profitability_simulations_tenant_delete" ON public.profitability_simulations;

  CREATE POLICY "profitability_simulations_tenant_select"
    ON public.profitability_simulations
    FOR SELECT
    TO authenticated
    USING (
      tenant_id = private.current_tenant_id()
      AND private.current_profile_is_active()
    );

  CREATE POLICY "profitability_simulations_tenant_insert"
    ON public.profitability_simulations
    FOR INSERT
    TO authenticated
    WITH CHECK (
      tenant_id = private.current_tenant_id()
      AND private.current_profile_is_active()
    );

  CREATE POLICY "profitability_simulations_tenant_update"
    ON public.profitability_simulations
    FOR UPDATE
    TO authenticated
    USING (
      tenant_id = private.current_tenant_id()
      AND private.current_profile_is_active()
    )
    WITH CHECK (
      tenant_id = private.current_tenant_id()
      AND private.current_profile_is_active()
    );

  CREATE POLICY "profitability_simulations_tenant_delete"
    ON public.profitability_simulations
    FOR DELETE
    TO authenticated
    USING (
      tenant_id = private.current_tenant_id()
      AND private.current_profile_is_active()
    );
END $$;
