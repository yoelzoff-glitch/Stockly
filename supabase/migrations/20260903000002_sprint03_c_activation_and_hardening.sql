-- SPRINT 3 — MIGRACIÓN C: ACTIVACIÓN DE RLS, PRIVILEGIOS DE COLUMNAS Y HARDENING
-- PREFLIGHT:
-- Requiere haber ejecutado las migraciones A y B.

DO $$
DECLARE
  tbl text;
  all_tables text[] := ARRAY[
    'profiles', 'tenants', 'products', 'orders', 'order_items', 'shipments',
    'order_cancellations', 'meli_accounts', 'whatsapp_numbers', 'messages',
    'alerts', 'ai_actions', 'action_workflows', 'price_adjustment_workflows',
    'price_adjustment_details', 'audit_logs', 'product_components', 'product_sku_components',
    'product_extra_costs', 'product_price_history', 'stock_movements',
    'inventory_items', 'inventory_movements', 'purchase_orders', 'purchase_order_items',
    'promotions', 'promotion_items', 'coupons', 'monthly_expenses', 'subscriptions',
    'subscription_usage', 'tenant_progress', 'tenant_preferences', 'plans_config'
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
    -- Revocar UPDATE general en la tabla profiles
    REVOKE UPDATE ON public.profiles FROM authenticated, anon;
    -- Conceder UPDATE únicamente en columnas seguras para usuarios autenticados
    GRANT UPDATE (full_name, avatar_url, updated_at) ON public.profiles TO authenticated;
  END IF;

  --------------------------------------------------------------------------------
  -- 3. HARDENING DE TENANTS: BLOQUEO DE CAMPOS ADMINISTRATIVOS
  --------------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants') THEN
    REVOKE UPDATE ON public.tenants FROM authenticated, anon;
    GRANT UPDATE (name, currency, timezone, metadata, updated_at) ON public.tenants TO authenticated;
  END IF;

  --------------------------------------------------------------------------------
  -- 4. HARDENING DE TOKENS Y SECRETOS EN INTEGRACIONES
  --------------------------------------------------------------------------------
  -- Mercado Libre
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meli_accounts') THEN
    -- Revocar acceso a tokens crudos para clientes directos
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'meli_accounts' AND column_name = 'access_token') THEN
      REVOKE SELECT (access_token, refresh_token) ON public.meli_accounts FROM authenticated, anon;
    END IF;
  END IF;

  -- WhatsApp
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_numbers') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'whatsapp_numbers' AND column_name = 'verify_token') THEN
      REVOKE SELECT (verify_token, app_secret) ON public.whatsapp_numbers FROM authenticated, anon;
    END IF;
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
