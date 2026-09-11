-- ==============================================================================
-- SPRINT 33: SUPER ADMIN REAL DATA INTEGRATION & ACTIVITY TRACKING
-- Migration: 20260917000000_sprint33_tenant_activity_state.sql
-- ==============================================================================

-- 1. TENANT ACTIVITY STATE TABLE
CREATE TABLE IF NOT EXISTS public.tenant_activity_state (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  last_user_activity_at timestamp with time zone,
  last_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_login_at timestamp with time zone,
  last_ml_sync_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_activity_state_last_activity 
  ON public.tenant_activity_state (last_user_activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_activity_state_last_sync 
  ON public.tenant_activity_state (last_ml_sync_at DESC);

-- 2. ROW LEVEL SECURITY
ALTER TABLE public.tenant_activity_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own tenant activity state" ON public.tenant_activity_state;
CREATE POLICY "Users can read own tenant activity state"
  ON public.tenant_activity_state
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

GRANT ALL ON public.tenant_activity_state TO service_role;
GRANT SELECT ON public.tenant_activity_state TO authenticated;

-- 3. INITIAL BACKFILL FOR EXISTING TENANTS
-- Seed activity state using real verified data from auth and meli_accounts
INSERT INTO public.tenant_activity_state (
  tenant_id,
  last_user_activity_at,
  last_user_id,
  last_login_at,
  last_ml_sync_at,
  updated_at
)
SELECT 
  t.id AS tenant_id,
  u.last_sign_in_at AS last_user_activity_at,
  p.id AS last_user_id,
  u.last_sign_in_at AS last_login_at,
  (SELECT max(ma.updated_at) FROM public.meli_accounts ma WHERE ma.tenant_id = t.id) AS last_ml_sync_at,
  now() AS updated_at
FROM public.tenants t
LEFT JOIN public.profiles p ON p.tenant_id = t.id AND p.role = 'owner'
LEFT JOIN auth.users u ON u.id = p.id
ON CONFLICT (tenant_id) DO UPDATE SET
  last_login_at = COALESCE(EXCLUDED.last_login_at, tenant_activity_state.last_login_at),
  last_ml_sync_at = COALESCE(EXCLUDED.last_ml_sync_at, tenant_activity_state.last_ml_sync_at),
  updated_at = now();
