-- SPRINT 3 — MIGRACIÓN C: ACTIVACIÓN DE RLS, PRIVILEGIOS DE COLUMNAS Y HARDENING
-- PREFLIGHT:
-- Requiere haber ejecutado las migraciones A y B.

DO $$
DECLARE
  tbl text;
  all_tables text[] := ARRAY[
    'profiles', 'tenants', 'products', 'orders', 'order_items', 'shipments',
    'order_cancellations', 'meli_accounts', 'whatsapp_numbers', 'messages',
    'alerts', 'ai_actions', 'action_workflows', 'workflow_steps',
    'price_adjustment_workflows', 'price_adjustment_details', 'audit_logs',
    'product_components', 'product_sku_components', 'product_extra_costs',
    'product_price_history', 'stock_movements', 'inventory_items', 'inventory_movements',
    'purchase_orders', 'purchase_order_items', 'promotions', 'promotion_items',
    'coupons', 'monthly_expenses', 'subscriptions', 'subscription_usage',
    'tenant_progress', 'tenant_preferences', 'plans_config'
  ];
BEGIN

  --------------------------------------------------------------------------------
  -- 1. ACTIVACIÓN DE RLS EN TODAS LAS TABLAS DEL ESQUEMA
  --------------------------------------------------------------------------------
  FOREACH tbl IN ARRAY all_tables
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
    -- Conceder UPDATE únicamente en campos operativos seguros (sin metadata ni flags administrativos)
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
