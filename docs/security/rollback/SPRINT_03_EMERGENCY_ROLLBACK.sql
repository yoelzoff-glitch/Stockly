-- SPRINT 3 — MANUAL EMERGENCY ROLLBACK SCRIPT
-- LOCATION: docs/security/rollback/SPRINT_03_EMERGENCY_ROLLBACK.sql
-- PREFLIGHT CHECK & REVERSION:
-- Reverts exclusively Sprint 3 RLS policies and schema structures in case of rollback.

DO $$
BEGIN

  --------------------------------------------------------------------------------
  -- 0. PREFLIGHT VERIFICATION
  --------------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'private') THEN
    RAISE NOTICE 'Schema private does not exist. No Sprint 3 rollback required.';
    RETURN;
  END IF;

  --------------------------------------------------------------------------------
  -- 1. ELIMINAR POLÍTICAS ESPECÍFICAS DE SPRINT 3
  --------------------------------------------------------------------------------
  -- Profiles
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    DROP POLICY IF EXISTS "profiles_select_own_tenant" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_update_own_row" ON public.profiles;
  END IF;

  -- Tenants
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants') THEN
    DROP POLICY IF EXISTS "tenants_select_own" ON public.tenants;
    DROP POLICY IF EXISTS "tenants_update_own" ON public.tenants;
  END IF;

  -- Direct operational tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
    DROP POLICY IF EXISTS "products_tenant_select" ON public.products;
    DROP POLICY IF EXISTS "products_tenant_insert" ON public.products;
    DROP POLICY IF EXISTS "products_tenant_update" ON public.products;
    DROP POLICY IF EXISTS "products_tenant_delete" ON public.products;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    DROP POLICY IF EXISTS "orders_tenant_select" ON public.orders;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
    DROP POLICY IF EXISTS "order_items_tenant_select" ON public.order_items;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipments') THEN
    DROP POLICY IF EXISTS "shipments_tenant_select" ON public.shipments;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meli_accounts') THEN
    DROP POLICY IF EXISTS "meli_accounts_tenant_select" ON public.meli_accounts;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_numbers') THEN
    DROP POLICY IF EXISTS "whatsapp_numbers_tenant_select" ON public.whatsapp_numbers;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
    DROP POLICY IF EXISTS "subscriptions_tenant_select" ON public.subscriptions;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_usage') THEN
    DROP POLICY IF EXISTS "subscription_usage_tenant_select" ON public.subscription_usage;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    DROP POLICY IF EXISTS "audit_logs_tenant_select" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_tenant_insert" ON public.audit_logs;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plans_config') THEN
    DROP POLICY IF EXISTS "plans_config_public_read" ON public.plans_config;
  END IF;

  --------------------------------------------------------------------------------
  -- 2. RESTAURAR POLÍTICAS PREVIAS DE MONTHLY EXPENSES Y PLANS CONFIG
  --------------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'monthly_expenses') THEN
    CREATE POLICY "Users can read their tenant's monthly expenses"
      ON public.monthly_expenses FOR SELECT
      USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plans_config') THEN
    CREATE POLICY "Anyone can read plans_config"
      ON public.plans_config FOR SELECT
      USING (true);
  END IF;

  --------------------------------------------------------------------------------
  -- 3. ELIMINAR FUNCIONES EN SCHEMA PRIVATE
  --------------------------------------------------------------------------------
  DROP FUNCTION IF EXISTS private.has_tenant_role(text[]);
  DROP FUNCTION IF EXISTS private.belongs_to_tenant(uuid);
  DROP FUNCTION IF EXISTS private.current_profile_is_active();
  DROP FUNCTION IF EXISTS private.current_tenant_role();
  DROP FUNCTION IF EXISTS private.current_tenant_id();

END $$;
