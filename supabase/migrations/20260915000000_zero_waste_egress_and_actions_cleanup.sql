-- ==============================================================================
-- SPRINT 32: Zero-Waste Egress & Consumption Hardening
-- ==============================================================================

-- 0. GUARD: abortar si existe algún webhook legacy utilizado por un workflow.
DO $$
DECLARE
  referenced_count bigint;
BEGIN
  SELECT COUNT(*)
  INTO referenced_count
  FROM public.ai_actions aa
  INNER JOIN public.workflow_steps ws
    ON ws.action_id = aa.id
  WHERE aa.status = 'executed'
    AND aa.action_type LIKE 'webhook\_%' ESCAPE '\';

  IF referenced_count > 0 THEN
    RAISE EXCEPTION
      'SPRINT32_ABORT: existen % ai_actions webhook legacy referenciadas por workflow_steps',
      referenced_count;
  END IF;
END;
$$;

-- 1. Eliminar exclusivamente webhooks legacy ya ejecutados.
DELETE FROM public.ai_actions
WHERE status = 'executed'
  AND action_type LIKE 'webhook\_%' ESCAPE '\';

-- 2. Índice para listado/paginación por cursor.
CREATE INDEX IF NOT EXISTS idx_ai_actions_tenant_created_id
  ON public.ai_actions (
    tenant_id,
    created_at DESC,
    id DESC
  );

-- 3. Índice para filtros/contadores por estado.
CREATE INDEX IF NOT EXISTS idx_ai_actions_tenant_status_created
  ON public.ai_actions (
    tenant_id,
    status,
    created_at DESC
  );

-- 4. Refrescar estadísticas del planner.
ANALYZE public.ai_actions;