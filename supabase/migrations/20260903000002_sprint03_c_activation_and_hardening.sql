-- SPRINT 3 — MIGRACIÓN C: ACTIVACIÓN DE RLS Y PRIVILEGIOS DE COLUMNAS POR LOTES
-- PREFLIGHT: Requiere haber ejecutado 20260903000000_sprint03_a_foundations.sql y 20260903000001_sprint03_b_policies.sql

DO $$
DECLARE
  tbl text;
BEGIN

  --------------------------------------------------------------------------------
  -- LOTE 1: CONFIGURACIÓN, CUENTAS Y BILLING (5 Tablas)
  --------------------------------------------------------------------------------
  FOREACH tbl IN ARRAY ARRAY['profiles', 'tenants', 'subscriptions', 'subscription_usage', 'plans_config']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;

  --------------------------------------------------------------------------------
  -- LOTE 2: OPERACIONES, VENTAS Y CATÁLOGO (10 Tablas)
  --------------------------------------------------------------------------------
  FOREACH tbl IN ARRAY ARRAY['products', 'orders', 'order_items', 'shipments', 'order_cancellations', 'monthly_expenses', 'inventory_items', 'inventory_movements', 'purchase_orders', 'purchase_order_items']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;

  --------------------------------------------------------------------------------
  -- LOTE 3: AUTOMATIZACIONES, ALERTAS Y DOMINIO SECUNDARIO (21 Tablas)
  --------------------------------------------------------------------------------
  FOREACH tbl IN ARRAY ARRAY['messages', 'alert_rules', 'alerts', 'ai_actions', 'action_workflows', 'workflow_steps', 'price_adjustment_workflows', 'price_adjustment_details', 'product_components', 'product_sku_components', 'product_extra_costs', 'product_price_history', 'stock_movements', 'promotions', 'promotion_items', 'coupons', 'tenant_progress', 'tenant_preferences', 'competition_snapshots', 'conversation_sessions', 'audit_logs']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;

  --------------------------------------------------------------------------------
  -- LOTE 4: INTEGRACIONES Y HARDENING DE SECRETOS (2 Tablas)
  --------------------------------------------------------------------------------
  FOREACH tbl IN ARRAY ARRAY['meli_accounts', 'whatsapp_numbers']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;

  --------------------------------------------------------------------------------
  -- 5. HARDENING DE PROFILES: BLOQUEO DE ESCALADA DE PRIVILEGIOS
  --------------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    REVOKE UPDATE ON public.profiles FROM authenticated, anon;
    GRANT UPDATE (full_name, avatar_url, updated_at) ON public.profiles TO authenticated;
  END IF;

  --------------------------------------------------------------------------------
  -- 6. HARDENING DE TENANTS: BLOQUEO DE CAMPOS ADMINISTRATIVOS Y METADATA
  --------------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants') THEN
    REVOKE UPDATE ON public.tenants FROM authenticated, anon;
    GRANT UPDATE (name, currency, timezone, updated_at) ON public.tenants TO authenticated;
  END IF;

  --------------------------------------------------------------------------------
  -- 7. HARDENING DE TOKENS Y SECRETOS EN INTEGRACIONES
  --------------------------------------------------------------------------------
  -- Mercado Libre: Revocar SELECT general y conceder únicamente columnas canónicas seguras
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meli_accounts') THEN
    REVOKE SELECT ON public.meli_accounts FROM authenticated, anon;
    GRANT SELECT (id, tenant_id, meli_user_id, nickname, site_id, status, token_expires_at, sync_error, last_success_refresh, last_sync_at, metadata, created_at, updated_at) ON public.meli_accounts TO authenticated;
  END IF;

  -- WhatsApp: Revocar SELECT general y conceder únicamente columnas canónicas seguras
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_numbers') THEN
    REVOKE SELECT ON public.whatsapp_numbers FROM authenticated, anon;
    GRANT SELECT (id, tenant_id, phone_number, provider, provider_phone_id, status, metadata, created_at, updated_at) ON public.whatsapp_numbers TO authenticated;
  END IF;

  --------------------------------------------------------------------------------
  -- 8. TABLAS BACKEND-ONLY / INFRAESTRUCTURA (2 Tablas)
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
