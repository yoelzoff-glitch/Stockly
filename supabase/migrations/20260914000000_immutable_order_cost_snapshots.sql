-- ==============================================================================
-- SPRINT 31: Cost Snapshotting e Inmutabilidad Financiera Histórica
-- ==============================================================================

-- 1. Agregar columnas de snapshot operativo a la tabla public.orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS packaging_cost_snapshot NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS flex_cost_snapshot NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS operational_cost_snapshot_version TEXT DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS cost_snapshot_frozen_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS cost_snapshot_source TEXT NULL,
  ADD COLUMN IF NOT EXISTS cost_snapshot_status TEXT NULL;

-- 2. Agregar columnas de snapshot de costos a la tabla public.order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS line_key TEXT NULL,
  ADD COLUMN IF NOT EXISTS unit_cost_snapshot NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS cost_snapshot_frozen_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS cost_snapshot_source TEXT NULL,
  ADD COLUMN IF NOT EXISTS cost_snapshot_version TEXT DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS estimated_fee_snapshot NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS estimated_shipping_cost_snapshot NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS extra_fee_amount_snapshot NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS promotion_discount_amount_snapshot NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS estimated_tax_snapshot NUMERIC NULL;

-- 3. Generar line_key determinístico para registros históricos de order_items
UPDATE public.order_items
SET line_key = COALESCE(meli_item_id, 'item') || '_' || COALESCE(sku, 'nosku') || '_' || id::text
WHERE line_key IS NULL;

-- 4. Índice único para garantizar idempotencia en order_items (tenant_id, order_id, line_key)
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_tenant_order_line_key
  ON public.order_items (tenant_id, order_id, line_key);

-- 5. Backfill histórico respetuoso (NO backfill mentiroso):
-- Para items existentes: si ya existía unit_cost, se preserva como legacy_preserved.
-- Si no existía, queda explícitamente en legacy_missing (sin inventar datos con products.cost actual).
UPDATE public.order_items
SET
  unit_cost_snapshot = unit_cost,
  cost_snapshot_source = CASE 
    WHEN unit_cost IS NOT NULL AND unit_cost > 0 THEN 'legacy_preserved'
    ELSE 'legacy_missing'
  END,
  cost_snapshot_frozen_at = CASE 
    WHEN unit_cost IS NOT NULL AND unit_cost > 0 THEN created_at
    ELSE NULL
  END,
  cost_snapshot_version = 'v1'
WHERE cost_snapshot_source IS NULL;

-- Para orders existentes: preservar packaging y flex si estaban en raw_data
UPDATE public.orders
SET
  packaging_cost_snapshot = CASE
    WHEN (raw_data->'libretax_operational_costs'->>'packaging_cost') IS NOT NULL
      THEN (raw_data->'libretax_operational_costs'->>'packaging_cost')::numeric
    WHEN (raw_data->'klyvo_operational_costs'->>'packaging_cost') IS NOT NULL
      THEN (raw_data->'klyvo_operational_costs'->>'packaging_cost')::numeric
    ELSE NULL
  END,
  flex_cost_snapshot = CASE
    WHEN (raw_data->'libretax_operational_costs'->>'flex_cost') IS NOT NULL
      THEN (raw_data->'libretax_operational_costs'->>'flex_cost')::numeric
    WHEN (raw_data->'klyvo_operational_costs'->>'flex_cost') IS NOT NULL
      THEN (raw_data->'klyvo_operational_costs'->>'flex_cost')::numeric
    ELSE NULL
  END,
  cost_snapshot_source = CASE
    WHEN (raw_data->'libretax_operational_costs'->>'packaging_cost') IS NOT NULL 
      OR (raw_data->'klyvo_operational_costs'->>'packaging_cost') IS NOT NULL
      THEN 'legacy_preserved'
    ELSE 'legacy_missing'
  END,
  cost_snapshot_frozen_at = CASE
    WHEN (raw_data->'libretax_operational_costs'->>'packaging_cost') IS NOT NULL 
      OR (raw_data->'klyvo_operational_costs'->>'packaging_cost') IS NOT NULL
      THEN created_at
    ELSE NULL
  END,
  operational_cost_snapshot_version = 'v1',
  cost_snapshot_status = CASE
    WHEN (raw_data->'libretax_operational_costs'->>'packaging_cost') IS NOT NULL 
      OR (raw_data->'klyvo_operational_costs'->>'packaging_cost') IS NOT NULL
      THEN 'complete'
    ELSE 'legacy_missing'
  END
WHERE cost_snapshot_source IS NULL;

-- 6. Trigger PostgreSQL de Inmutabilidad de Cost Snapshot en order_items
CREATE OR REPLACE FUNCTION public.protect_frozen_order_items_cost_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Si el registro ya fue congelado (cost_snapshot_frozen_at no es nulo)
  IF TG_OP = 'UPDATE' THEN
    IF OLD.cost_snapshot_frozen_at IS NOT NULL THEN
      -- Prohibir cualquier alteración del costo unitario congelado
      IF NEW.unit_cost_snapshot IS DISTINCT FROM OLD.unit_cost_snapshot THEN
        RAISE EXCEPTION 'VIOLATION_COST_SNAPSHOT_FROZEN: unit_cost_snapshot ya esta congelado para el item % y no puede modificarse.', OLD.id;
      END IF;
      -- Prohibir alterar el timestamp o versión de congelamiento
      IF NEW.cost_snapshot_frozen_at IS DISTINCT FROM OLD.cost_snapshot_frozen_at THEN
        RAISE EXCEPTION 'VIOLATION_COST_SNAPSHOT_FROZEN: cost_snapshot_frozen_at ya esta congelado para el item %.', OLD.id;
      END IF;
      IF NEW.cost_snapshot_version IS DISTINCT FROM OLD.cost_snapshot_version THEN
        RAISE EXCEPTION 'VIOLATION_COST_SNAPSHOT_FROZEN: cost_snapshot_version no puede alterarse.';
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.cost_snapshot_frozen_at IS NOT NULL THEN
      -- Comprobar si hay bypass administrativo explícito
      IF current_setting('app.allow_frozen_item_delete', true) = 'true' THEN
        RETURN OLD;
      END IF;
      RAISE EXCEPTION 'VIOLATION_COST_SNAPSHOT_DELETE: Prohibido eliminar order_item % con snapshot de costo congelado.', OLD.id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_order_items_cost_snapshot ON public.order_items;
CREATE TRIGGER trg_protect_order_items_cost_snapshot
  BEFORE UPDATE OR DELETE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_frozen_order_items_cost_snapshot();

-- 7. Trigger PostgreSQL de Inmutabilidad de Cost Snapshot en orders
CREATE OR REPLACE FUNCTION public.protect_frozen_orders_cost_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.cost_snapshot_frozen_at IS NOT NULL THEN
      IF NEW.packaging_cost_snapshot IS DISTINCT FROM OLD.packaging_cost_snapshot THEN
        RAISE EXCEPTION 'VIOLATION_COST_SNAPSHOT_FROZEN: packaging_cost_snapshot ya esta congelado para la orden % y no puede modificarse.', OLD.id;
      END IF;
      IF NEW.flex_cost_snapshot IS DISTINCT FROM OLD.flex_cost_snapshot THEN
        RAISE EXCEPTION 'VIOLATION_COST_SNAPSHOT_FROZEN: flex_cost_snapshot ya esta congelado para la orden %.', OLD.id;
      END IF;
      IF NEW.cost_snapshot_frozen_at IS DISTINCT FROM OLD.cost_snapshot_frozen_at THEN
        RAISE EXCEPTION 'VIOLATION_COST_SNAPSHOT_FROZEN: cost_snapshot_frozen_at ya esta congelado para la orden %.', OLD.id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_orders_cost_snapshot ON public.orders;
CREATE TRIGGER trg_protect_orders_cost_snapshot
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_frozen_orders_cost_snapshot();
