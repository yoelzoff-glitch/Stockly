-- =====================================================================
-- SPRINT 12: CENTRO DE ALERTAS Y ACTIVIDAD OPERATIVA
-- Migración: Ampliación de alerts y watermark temporal en tenants
-- =====================================================================

-- 1. Watermark temporal de activación por tenant
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS notifications_watermark_at TIMESTAMPTZ DEFAULT NOW();

-- Actualizar tenants existentes que no tengan watermark
UPDATE public.tenants
SET notifications_watermark_at = NOW()
WHERE notifications_watermark_at IS NULL;

-- 2. Ampliación de columnas en public.alerts
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'attention',
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS action_url TEXT,
  ADD COLUMN IF NOT EXISTS action_label TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Constraints de integridad
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'alerts_category_check'
  ) THEN
    ALTER TABLE public.alerts
      ADD CONSTRAINT alerts_category_check CHECK (category IN ('attention', 'activity'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'alerts_source_check'
  ) THEN
    ALTER TABLE public.alerts
      ADD CONSTRAINT alerts_source_check CHECK (source IN ('system', 'platform_admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'alerts_status_check'
  ) THEN
    ALTER TABLE public.alerts
      ADD CONSTRAINT alerts_status_check CHECK (status IN ('open', 'resolved', 'archived'));
  END IF;
END $$;

-- 3. Unicidad atómica para dedupe_key (ignora nulls)
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_dedupe_key_unique
  ON public.alerts (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- Índice para consultas activas de la campana y la página de notificaciones
CREATE INDEX IF NOT EXISTS idx_alerts_tenant_active_feed
  ON public.alerts (tenant_id, status, is_read, created_at DESC);

-- Índice por entidad para búsquedas operativas
CREATE INDEX IF NOT EXISTS idx_alerts_entity_lookup
  ON public.alerts (tenant_id, entity_type, entity_id)
  WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;

-- 4. Archivar de forma segura los resúmenes diarios históricos (sin destruirlos)
UPDATE public.alerts
SET status = 'archived',
    is_read = true,
    category = 'activity',
    type = 'daily_summary_archived',
    updated_at = NOW()
WHERE title LIKE 'Resumen Diario%';

-- Clasificar alertas históricas existentes
UPDATE public.alerts
SET category = 'attention',
    type = 'legacy_alert'
WHERE type = 'custom' AND status = 'open';

-- 5. Hardening de permisos y RLS
-- Los usuarios autenticados solo pueden SELECT y UPDATE (is_read, read_at)
-- Las inserciones de sistema y resoluciones se realizan con service_role o server actions de backend
REVOKE INSERT, DELETE ON TABLE public.alerts FROM authenticated;

-- Permitir únicamente actualizar campos de lectura por el usuario autenticado
GRANT UPDATE (is_read, read_at) ON public.alerts TO authenticated;
