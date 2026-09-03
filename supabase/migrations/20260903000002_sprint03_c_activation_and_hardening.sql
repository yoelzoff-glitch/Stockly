-- SPRINT 3 — MIGRACIÓN C: ACTIVACIÓN DE RLS, PRIVILEGIOS DE COLUMNAS Y HARDENING
-- PREFLIGHT:
-- Requiere haber ejecutado las migraciones A y B.

DO $$
DECLARE
  tbl text;
  -- LOTE 1: Configuración y Cuentas (Base del tenant)
  batch_1 text[] := ARRAY['profiles', 'tenants', 'subscriptions', 'subscription_usage', 'plans_config'];

  -- LOTE 2: Operaciones y Ventas Principales
  batch_2 text[] := ARRAY['products', 'orders', 'order_items', 'shipments', 'order_cancellations', 'monthly_expenses', 'inventory_items', 'inventory_movements', 'purchase_orders', 'purchase_order_items'];

  -- LOTE 3: Dominio Secundario y Automatizaciones
  batch_3 text[] := ARRAY['messages', 'alerts', 'ai_actions', 'action_workflows', 'workflow_steps', 'price_adjustment_workflows', 'price_adjustment_details', 'product_components', 'product_sku_components', 'product_extra_costs', 'product_price_history', 'stock_movements', 'promotions', 'promotion_items', 'coupons', 'tenant_progress', 'tenant_preferences', 'competition_snapshots', 'conversation_sessions', 'audit_logs'];

  -- LOTE 4: Integraciones
  batch_4 text[] := ARRAY['meli_accounts', 'whatsapp_numbers'];
BEGIN

  --------------------------------------------------------------------------------
  -- 1. ACTIVACIÓN DE RLS POR LOTES DE DOMINIO
  --------------------------------------------------------------------------------
  FOREACH tbl IN ARRAY (batch_1 || batch_2 || batch_3 || batch_4)
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;

  --------------------------------------------------------------------------------
  -- 2. HARDENING DE PROFILES: BLOQUEO DE ESCALADA DE PRIVILEGIOS
  --------------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    REVOKE UPDATE ON public.profiles FROM authenticated, anon;
    GRANT UPDATE (full_name, avatar_url, updated_at) ON public.profiles TO authenticated;
  END IF;

  --------------------------------------------------------------------------------
  -- 3. HARDENING DE TENANTS: BLOQUEO DE CAMPOS ADMINISTRATIVOS Y METADATA
  --------------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants') THEN
    REVOKE UPDATE ON public.tenants FROM authenticated, anon;
    GRANT UPDATE (name, currency, timezone, updated_at) ON public.tenants TO authenticated;
  END IF;

  --------------------------------------------------------------------------------
  -- 4. HARDENING DE TOKENS Y SECRETOS EN INTEGRACIONES
  --------------------------------------------------------------------------------
  -- Mercado Libre: Revocar SELECT general y conceder únicamente columnas seguras
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meli_accounts') THEN
    REVOKE SELECT ON public.meli_accounts FROM authenticated, anon;
    GRANT SELECT (id, tenant_id, meli_user_id, nickname, seller_id, status, token_expires_at, sync_error, last_success_refresh, created_at, updated_at) ON public.meli_accounts TO authenticated;
  END IF;

  -- WhatsApp: Revocar SELECT general y conceder únicamente columnas seguras (sin access_token ni secretos)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_numbers') THEN
    REVOKE SELECT ON public.whatsapp_numbers FROM authenticated, anon;
    GRANT SELECT (id, tenant_id, phone_number, status, display_name, created_at, updated_at) ON public.whatsapp_numbers TO authenticated;
  END IF;

  --------------------------------------------------------------------------------
  -- 5. TABLAS BACKEND-ONLY / INFRAESTRUCTURA (CATEGORÍA C)
  --------------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_feature_flags') THEN
    ALTER TABLE public.tenant_feature_flags ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.tenant_feature_flags FROM authenticated, anon, PUBLIC;
    GRANT ALL ON public.tenant_feature_flags TO service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'operation_runs') THEN
    ALTER TABLE public.operation_runs ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.operation_runs FROM authenticated, anon, PUBLIC;
    GRANT ALL ON public.operation_runs TO service_role;
  END IF;

END $$;
