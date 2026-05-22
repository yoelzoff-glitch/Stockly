-- Script de Migración: Sprint 14 (Análisis de Competencia)

CREATE TABLE IF NOT EXISTS public.competition_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  query text NOT NULL,
  own_price numeric NOT NULL,
  avg_price numeric,
  min_price numeric,
  max_price numeric,
  median_price numeric,
  competitors_count integer DEFAULT 0,
  free_shipping_count integer DEFAULT 0,
  raw_results jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.competition_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "competition_snapshots_select" ON public.competition_snapshots
FOR SELECT USING (tenant_id IN (
  SELECT tenant_id FROM public.profiles WHERE profiles.id = auth.uid()
));

CREATE POLICY "competition_snapshots_all" ON public.competition_snapshots
FOR ALL USING (tenant_id IN (
  SELECT tenant_id FROM public.profiles WHERE profiles.id = auth.uid()
));

-- Index para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_comp_snapshots_tenant_product ON public.competition_snapshots (tenant_id, product_id);
