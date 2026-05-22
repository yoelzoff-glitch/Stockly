-- Script de Migración: Sprint 13

-- 1. Ampliación de meli_accounts
ALTER TABLE public.meli_accounts
ADD COLUMN IF NOT EXISTS refresh_token text,
ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;

-- 2. Tabla de Preferencias por Tenant (Memoria Empresarial)
CREATE TABLE IF NOT EXISTS public.tenant_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  minimum_margin numeric DEFAULT 15.0,
  never_pause_products boolean DEFAULT false,
  auto_respond_questions boolean DEFAULT false,
  preferred_price_strategy text DEFAULT 'match_competitor',
  automation_rules jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT tenant_preferences_tenant_id_key UNIQUE (tenant_id)
);

-- RLS para tenant_preferences
ALTER TABLE public.tenant_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_preferences_select" ON public.tenant_preferences
FOR SELECT USING (tenant_id IN (
  SELECT tenant_id FROM public.profiles WHERE profiles.id = auth.uid()
));

CREATE POLICY "tenant_preferences_all" ON public.tenant_preferences
FOR ALL USING (tenant_id IN (
  SELECT tenant_id FROM public.profiles WHERE profiles.id = auth.uid()
));
