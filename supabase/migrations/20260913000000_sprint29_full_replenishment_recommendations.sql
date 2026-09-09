-- =====================================================================
-- SPRINT 29: REPOSICIÓN INTELIGENTE FULL CON FORECAST + IA
-- Migration: 20260913000000_sprint29_full_replenishment_recommendations.sql
-- =====================================================================

BEGIN;

-- 1. Crear tabla para almacenar snapshots y recomendaciones de reposición FULL
CREATE TABLE IF NOT EXISTS public.full_replenishment_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  sku text NOT NULL,
  title text NOT NULL,
  thumbnail_url text,

  full_stock integer NOT NULL DEFAULT 0,
  internal_stock integer,

  sales_7d integer NOT NULL DEFAULT 0,
  sales_14d integer NOT NULL DEFAULT 0,
  sales_30d integer NOT NULL DEFAULT 0,
  sales_60d integer NOT NULL DEFAULT 0,

  velocity_7d numeric(10, 3) NOT NULL DEFAULT 0,
  velocity_14d numeric(10, 3) NOT NULL DEFAULT 0,
  velocity_30d numeric(10, 3) NOT NULL DEFAULT 0,

  weighted_velocity numeric(10, 3) NOT NULL DEFAULT 0,
  forecast_velocity numeric(10, 2) NOT NULL DEFAULT 0,

  coverage_days numeric(10, 1),
  target_coverage_days integer NOT NULL DEFAULT 21,
  safety_days integer NOT NULL DEFAULT 5,

  recommended_units integer NOT NULL DEFAULT 0,
  available_to_send integer,

  priority text NOT NULL DEFAULT 'ok' CHECK (
    priority IN ('critical', 'high', 'medium', 'ok')
  ),
  confidence text NOT NULL DEFAULT 'medium' CHECK (
    confidence IN ('high', 'medium', 'low')
  ),

  trend_percent numeric(10, 1),
  account_trend_percent numeric(10, 1),

  unit_cost numeric(14, 2),
  margin_percent numeric(10, 2),
  capital_required numeric(14, 2),

  ads_active boolean NOT NULL DEFAULT false,

  ai_explanation jsonb,
  dedupe_hash text,

  calculated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT full_replenishment_recommendations_tenant_sku_key UNIQUE (tenant_id, sku)
);

-- 2. Índices para acelerar consultas operativas del dashboard
CREATE INDEX IF NOT EXISTS idx_full_replenishment_tenant_priority
  ON public.full_replenishment_recommendations (tenant_id, priority);

CREATE INDEX IF NOT EXISTS idx_full_replenishment_tenant_coverage
  ON public.full_replenishment_recommendations (tenant_id, coverage_days);

CREATE INDEX IF NOT EXISTS idx_full_replenishment_tenant_updated
  ON public.full_replenishment_recommendations (tenant_id, updated_at DESC);

-- 3. Aislamiento estricto de seguridad RLS
ALTER TABLE public.full_replenishment_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.full_replenishment_recommendations FORCE ROW LEVEL SECURITY;

-- 4. Políticas de aislamiento por tenant
DROP POLICY IF EXISTS "full_replenishment_recommendations_tenant_isolation" ON public.full_replenishment_recommendations;

CREATE POLICY "full_replenishment_recommendations_tenant_isolation"
  ON public.full_replenishment_recommendations
  FOR ALL
  TO authenticated
  USING (
    tenant_id = private.current_tenant_id()
    AND private.current_profile_is_active()
  )
  WITH CHECK (
    tenant_id = private.current_tenant_id()
    AND private.current_profile_is_active()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.full_replenishment_recommendations TO authenticated;

COMMIT;
