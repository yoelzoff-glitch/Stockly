-- SPRINT 3 — MIGRACIÓN D: ROLLBACK DE EMERGENCIA DOCUMENTADO
-- OBJETIVO: Revertir las políticas y esquemas de Sprint 3 al estado documentado previo en caso de incidente.

DO $$
DECLARE
  tbl text;
  direct_tables text[] := ARRAY[
    'products', 'orders', 'order_items', 'order_cancellations', 'meli_accounts',
    'whatsapp_numbers', 'messages', 'alerts', 'ai_actions', 'action_workflows',
    'price_adjustment_workflows', 'audit_logs', 'product_components', 'product_sku_components',
    'product_extra_costs', 'inventory_items', 'inventory_movements', 'purchase_orders',
    'promotions', 'monthly_expenses', 'subscriptions', 'subscription_usage',
    'tenant_progress', 'tenant_preferences'
  ];
BEGIN

  --------------------------------------------------------------------------------
  -- 1. ELIMINAR POLÍTICAS DECLARADAS EN MIGRACIÓN B
  --------------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    DROP POLICY IF EXISTS "profiles_select_own_tenant" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_update_own_row" ON public.profiles;
    GRANT UPDATE ON public.profiles TO authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants') THEN
    DROP POLICY IF EXISTS "tenants_select_own" ON public.tenants;
    DROP POLICY IF EXISTS "tenants_update_own" ON public.tenants;
    GRANT UPDATE ON public.tenants TO authenticated;
  END IF;

  FOREACH tbl IN ARRAY direct_tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS "%I_tenant_select" ON public.%I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "%I_tenant_insert" ON public.%I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "%I_tenant_update" ON public.%I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "%I_tenant_delete" ON public.%I', tbl, tbl);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipments') THEN
    DROP POLICY IF EXISTS "shipments_tenant_select" ON public.shipments;
    DROP POLICY IF EXISTS "shipments_tenant_modify" ON public.shipments;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'price_adjustment_details') THEN
    DROP POLICY IF EXISTS "price_adjustment_details_tenant_all" ON public.price_adjustment_details;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_price_history') THEN
    DROP POLICY IF EXISTS "product_price_history_tenant_all" ON public.product_price_history;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_movements') THEN
    DROP POLICY IF EXISTS "stock_movements_tenant_all" ON public.stock_movements;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_order_items') THEN
    DROP POLICY IF EXISTS "purchase_order_items_tenant_all" ON public.purchase_order_items;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'promotion_items') THEN
    DROP POLICY IF EXISTS "promotion_items_tenant_all" ON public.promotion_items;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'coupons') THEN
    DROP POLICY IF EXISTS "coupons_tenant_all" ON public.coupons;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plans_config') THEN
    DROP POLICY IF EXISTS "plans_config_public_read" ON public.plans_config;
  END IF;

  --------------------------------------------------------------------------------
  -- 2. RESTAURAR PRIVILEGIOS DE SELECT EN INTEGRACIONES
  --------------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meli_accounts') THEN
    GRANT SELECT ON public.meli_accounts TO authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_numbers') THEN
    GRANT SELECT ON public.whatsapp_numbers TO authenticated;
  END IF;

  --------------------------------------------------------------------------------
  -- 3. ELIMINAR FUNCIONES Y SCHEMA PRIVATE
  --------------------------------------------------------------------------------
  DROP FUNCTION IF EXISTS private.has_tenant_role(text[]);
  DROP FUNCTION IF EXISTS private.belongs_to_tenant(uuid);
  DROP FUNCTION IF EXISTS private.current_profile_is_active();
  DROP FUNCTION IF EXISTS private.current_tenant_role();
  DROP FUNCTION IF EXISTS private.current_tenant_id();
  DROP SCHEMA IF EXISTS private CASCADE;

END $$;
