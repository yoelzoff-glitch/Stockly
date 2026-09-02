-- SPRINT 3 — MANUAL EMERGENCY ROLLBACK SCRIPT
-- LOCATION: docs/security/rollback/SPRINT_03_EMERGENCY_ROLLBACK.sql
-- WARNING: This script is intended for manual emergency execution only via Supabase SQL Editor.
-- It must NEVER be executed automatically via supabase db push or in migrations.

DO $$
BEGIN

  --------------------------------------------------------------------------------
  -- 1. ELIMINAR POLÍTICAS ESPECÍFICAS DECLARADAS EN SPRINT 3
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

  -- Products & Inventory
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
    DROP POLICY IF EXISTS "products_tenant_select" ON public.products;
    DROP POLICY IF EXISTS "products_tenant_insert" ON public.products;
    DROP POLICY IF EXISTS "products_tenant_update" ON public.products;
    DROP POLICY IF EXISTS "products_tenant_delete" ON public.products;
  END IF;

  -- Orders & Order items (Lectura)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    DROP POLICY IF EXISTS "orders_tenant_select" ON public.orders;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
    DROP POLICY IF EXISTS "order_items_tenant_select" ON public.order_items;
  END IF;

  -- Shipments
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipments') THEN
    DROP POLICY IF EXISTS "shipments_tenant_select" ON public.shipments;
  END IF;

  -- Meli accounts & WhatsApp (Safe SELECT)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meli_accounts') THEN
    DROP POLICY IF EXISTS "meli_accounts_tenant_select" ON public.meli_accounts;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_numbers') THEN
    DROP POLICY IF EXISTS "whatsapp_numbers_tenant_select" ON public.whatsapp_numbers;
  END IF;

  -- Subscriptions & Usage
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
    DROP POLICY IF EXISTS "subscriptions_tenant_select" ON public.subscriptions;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_usage') THEN
    DROP POLICY IF EXISTS "subscription_usage_tenant_select" ON public.subscription_usage;
  END IF;

  -- Audit logs (SELECT & INSERT only)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    DROP POLICY IF EXISTS "audit_logs_tenant_select" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_tenant_insert" ON public.audit_logs;
  END IF;

  -- Plans config
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plans_config') THEN
    DROP POLICY IF EXISTS "plans_config_public_read" ON public.plans_config;
  END IF;

  --------------------------------------------------------------------------------
  -- 2. ELIMINAR FUNCIONES EN SCHEMA PRIVATE
  --------------------------------------------------------------------------------
  DROP FUNCTION IF EXISTS private.has_tenant_role(text[]);
  DROP FUNCTION IF EXISTS private.belongs_to_tenant(uuid);
  DROP FUNCTION IF EXISTS private.current_profile_is_active();
  DROP FUNCTION IF EXISTS private.current_tenant_role();
  DROP FUNCTION IF EXISTS private.current_tenant_id();

END $$;
