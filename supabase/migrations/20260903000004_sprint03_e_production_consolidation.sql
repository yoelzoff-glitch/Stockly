-- SPRINT 3 — MIGRACIÓN E: CONSOLIDACIÓN DEL ESTADO REAL DE PRODUCCIÓN
--
-- Esta migración se basa en el snapshot real entregado el 2026-09-03.
-- Debe ejecutarse DESPUÉS de A/B/C/D. No ejecuta FORCE RLS ni modifica datos.
-- PostgreSQL ejecuta cada archivo de migración dentro de una transacción.

--------------------------------------------------------------------------------
-- 1. PREFLIGHT: las 40 tablas canónicas deben existir y tener RLS habilitado.
--------------------------------------------------------------------------------
DO $$
DECLARE
  expected_tables constant text[] := ARRAY[
    'tenants', 'profiles', 'meli_accounts', 'products', 'orders', 'order_items',
    'whatsapp_numbers', 'messages', 'ai_actions', 'product_price_history',
    'stock_movements', 'alert_rules', 'alerts', 'audit_logs', 'tenant_preferences',
    'tenant_progress', 'shipments', 'order_cancellations', 'product_sku_components',
    'promotions', 'promotion_items', 'coupons', 'conversation_sessions',
    'subscription_usage', 'inventory_items', 'purchase_orders', 'purchase_order_items',
    'inventory_movements', 'product_components', 'product_extra_costs', 'subscriptions',
    'monthly_expenses', 'plans_config', 'competition_snapshots', 'action_workflows',
    'workflow_steps', 'price_adjustment_workflows', 'price_adjustment_details',
    'tenant_feature_flags', 'operation_runs'
  ];
  missing_tables text[];
  rls_disabled_tables text[];
BEGIN
  SELECT array_agg(t ORDER BY t)
  INTO missing_tables
  FROM unnest(expected_tables) AS t
  WHERE to_regclass(format('public.%I', t)) IS NULL;

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Sprint 3 preflight: missing canonical tables: %', missing_tables;
  END IF;

  SELECT array_agg(c.relname ORDER BY c.relname)
  INTO rls_disabled_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = ANY(expected_tables)
    AND c.relkind = 'r'
    AND NOT c.relrowsecurity;

  IF rls_disabled_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Sprint 3 preflight: RLS disabled on: %', rls_disabled_tables;
  END IF;
END $$;

--------------------------------------------------------------------------------
-- 2. ELIMINAR LAS 88 POLÍTICAS LEGACY OBSERVADAS EN PRODUCCIÓN.
-- Son DROP exactos e idempotentes; no se eliminan políticas desconocidas.
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "action_workflows_all" ON public."action_workflows";
DROP POLICY IF EXISTS "Tenant select ai_actions" ON public."ai_actions";
DROP POLICY IF EXISTS "Tenant write ai_actions" ON public."ai_actions";
DROP POLICY IF EXISTS "ai_actions_all" ON public."ai_actions";
DROP POLICY IF EXISTS "Tenant select alert rules" ON public."alert_rules";
DROP POLICY IF EXISTS "Tenant write alert rules" ON public."alert_rules";
DROP POLICY IF EXISTS "Tenant select alerts" ON public."alerts";
DROP POLICY IF EXISTS "Tenant write alerts" ON public."alerts";
DROP POLICY IF EXISTS "alerts_all" ON public."alerts";
DROP POLICY IF EXISTS "Tenant select audit logs" ON public."audit_logs";
DROP POLICY IF EXISTS "audit_logs_all" ON public."audit_logs";
DROP POLICY IF EXISTS "competition_snapshots_all" ON public."competition_snapshots";
DROP POLICY IF EXISTS "conversation_sessions_all" ON public."conversation_sessions";
DROP POLICY IF EXISTS "coupons_all" ON public."coupons";
DROP POLICY IF EXISTS "Users can manage their tenant's inventory_items" ON public."inventory_items";
DROP POLICY IF EXISTS "Users can manage their tenant's inventory_movements" ON public."inventory_movements";
DROP POLICY IF EXISTS "Tenant select meli_accounts" ON public."meli_accounts";
DROP POLICY IF EXISTS "Tenant write meli_accounts" ON public."meli_accounts";
DROP POLICY IF EXISTS "meli_accounts_all" ON public."meli_accounts";
DROP POLICY IF EXISTS "Tenant select messages" ON public."messages";
DROP POLICY IF EXISTS "Tenant write messages" ON public."messages";
DROP POLICY IF EXISTS "Users can insert messages to their tenant" ON public."messages";
DROP POLICY IF EXISTS "Users can view messages of their tenant" ON public."messages";
DROP POLICY IF EXISTS "messages_all" ON public."messages";
DROP POLICY IF EXISTS "Users can delete their tenant's monthly expenses" ON public."monthly_expenses";
DROP POLICY IF EXISTS "Users can insert their tenant's monthly expenses" ON public."monthly_expenses";
DROP POLICY IF EXISTS "Users can read their tenant's monthly expenses" ON public."monthly_expenses";
DROP POLICY IF EXISTS "Users can update their tenant's monthly expenses" ON public."monthly_expenses";
DROP POLICY IF EXISTS "monthly_expenses_all" ON public."monthly_expenses";
DROP POLICY IF EXISTS "Users can delete their own order_cancellations" ON public."order_cancellations";
DROP POLICY IF EXISTS "Users can insert their own order_cancellations" ON public."order_cancellations";
DROP POLICY IF EXISTS "Users can update their own order_cancellations" ON public."order_cancellations";
DROP POLICY IF EXISTS "Users can view their own order_cancellations" ON public."order_cancellations";
DROP POLICY IF EXISTS "order_cancellations_all" ON public."order_cancellations";
DROP POLICY IF EXISTS "Tenant select order_items" ON public."order_items";
DROP POLICY IF EXISTS "Tenant write order_items" ON public."order_items";
DROP POLICY IF EXISTS "order_items_all" ON public."order_items";
DROP POLICY IF EXISTS "Tenant select orders" ON public."orders";
DROP POLICY IF EXISTS "Tenant write orders" ON public."orders";
DROP POLICY IF EXISTS "orders_all" ON public."orders";
DROP POLICY IF EXISTS "Anyone can read plans_config" ON public."plans_config";
DROP POLICY IF EXISTS "plans_config_select" ON public."plans_config";
DROP POLICY IF EXISTS "price_adjustment_details_all" ON public."price_adjustment_details";
DROP POLICY IF EXISTS "price_adjustment_workflows_all" ON public."price_adjustment_workflows";
DROP POLICY IF EXISTS "Users can manage their tenant's product_components" ON public."product_components";
DROP POLICY IF EXISTS "Users can manage their tenant's product_extra_costs" ON public."product_extra_costs";
DROP POLICY IF EXISTS "Tenant select price history" ON public."product_price_history";
DROP POLICY IF EXISTS "Tenant write price history" ON public."product_price_history";
DROP POLICY IF EXISTS "product_price_history_all" ON public."product_price_history";
DROP POLICY IF EXISTS "Los usuarios pueden ver los componentes de SKU de su tenant" ON public."product_sku_components";
DROP POLICY IF EXISTS "Solo los servicios de sistema pueden insertar/actualizar/borrar" ON public."product_sku_components";
DROP POLICY IF EXISTS "Tenant select products" ON public."products";
DROP POLICY IF EXISTS "Tenant write products" ON public."products";
DROP POLICY IF EXISTS "products_all" ON public."products";
DROP POLICY IF EXISTS "Admins can update users from own tenant" ON public."profiles";
DROP POLICY IF EXISTS "Users can update own profile" ON public."profiles";
DROP POLICY IF EXISTS "Users can view profiles from own tenant" ON public."profiles";
DROP POLICY IF EXISTS "profiles_all" ON public."profiles";
DROP POLICY IF EXISTS "profiles_select" ON public."profiles";
DROP POLICY IF EXISTS "promotion_items_all" ON public."promotion_items";
DROP POLICY IF EXISTS "promotions_all" ON public."promotions";
DROP POLICY IF EXISTS "Users can manage their tenant's purchase_order_items" ON public."purchase_order_items";
DROP POLICY IF EXISTS "Users can manage their tenant's purchase_orders" ON public."purchase_orders";
DROP POLICY IF EXISTS "Users can delete their own shipments" ON public."shipments";
DROP POLICY IF EXISTS "Users can insert their own shipments" ON public."shipments";
DROP POLICY IF EXISTS "Users can update their own shipments" ON public."shipments";
DROP POLICY IF EXISTS "Users can view their own shipments" ON public."shipments";
DROP POLICY IF EXISTS "shipments_all" ON public."shipments";
DROP POLICY IF EXISTS "Tenant select stock movements" ON public."stock_movements";
DROP POLICY IF EXISTS "Tenant write stock movements" ON public."stock_movements";
DROP POLICY IF EXISTS "stock_movements_all" ON public."stock_movements";
DROP POLICY IF EXISTS "Users can read their tenant's usage" ON public."subscription_usage";
DROP POLICY IF EXISTS "subscription_usage_select" ON public."subscription_usage";
DROP POLICY IF EXISTS "Users can read their tenant's subscription" ON public."subscriptions";
DROP POLICY IF EXISTS "subscriptions_select" ON public."subscriptions";
DROP POLICY IF EXISTS "tenant_preferences_all" ON public."tenant_preferences";
DROP POLICY IF EXISTS "tenant_preferences_select" ON public."tenant_preferences";
DROP POLICY IF EXISTS "Users can insert progress for their tenant" ON public."tenant_progress";
DROP POLICY IF EXISTS "Users can update progress for their tenant" ON public."tenant_progress";
DROP POLICY IF EXISTS "Users can view progress for their tenant" ON public."tenant_progress";
DROP POLICY IF EXISTS "tenant_progress_all" ON public."tenant_progress";
DROP POLICY IF EXISTS "Owners can update own tenant" ON public."tenants";
DROP POLICY IF EXISTS "Users can view own tenant" ON public."tenants";
DROP POLICY IF EXISTS "tenants_select" ON public."tenants";
DROP POLICY IF EXISTS "Tenant select whatsapp_numbers" ON public."whatsapp_numbers";
DROP POLICY IF EXISTS "Tenant write whatsapp_numbers" ON public."whatsapp_numbers";
DROP POLICY IF EXISTS "whatsapp_numbers_all" ON public."whatsapp_numbers";
DROP POLICY IF EXISTS "workflow_steps_all" ON public."workflow_steps";

--------------------------------------------------------------------------------
-- 3. CORREGIR DOS POLÍTICAS CANÓNICAS DE B.
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_tenant_select" ON public.profiles;
CREATE POLICY "profiles_tenant_select"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    private.current_profile_is_active()
    AND tenant_id = private.current_tenant_id()
  );

DROP POLICY IF EXISTS "plans_config_select_authenticated" ON public.plans_config;
DROP POLICY IF EXISTS "plans_config_public_read" ON public.plans_config;
CREATE POLICY "plans_config_public_read"
  ON public.plans_config FOR SELECT TO anon, authenticated
  USING (true);

--------------------------------------------------------------------------------
-- 4. RESET DE PRIVILEGIOS Y MATRIZ MÍNIMA.
-- Esto elimina DELETE/INSERT/REFERENCES/TRIGGER/TRUNCATE/UPDATE heredados.
--------------------------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE
  public.tenants, public.profiles, public.meli_accounts, public.products,
  public.orders, public.order_items, public.whatsapp_numbers, public.messages,
  public.ai_actions, public.product_price_history, public.stock_movements,
  public.alert_rules, public.alerts, public.audit_logs, public.tenant_preferences,
  public.tenant_progress, public.shipments, public.order_cancellations,
  public.product_sku_components, public.promotions, public.promotion_items,
  public.coupons, public.conversation_sessions, public.subscription_usage,
  public.inventory_items, public.purchase_orders, public.purchase_order_items,
  public.inventory_movements, public.product_components, public.product_extra_costs,
  public.subscriptions, public.monthly_expenses, public.plans_config,
  public.competition_snapshots, public.action_workflows, public.workflow_steps,
  public.price_adjustment_workflows, public.price_adjustment_details,
  public.tenant_feature_flags, public.operation_runs
FROM anon, authenticated, PUBLIC;

-- Lectura normal; las políticas RLS de B siguen filtrando por tenant activo.
GRANT SELECT ON TABLE
  public.tenants, public.profiles, public.products, public.orders,
  public.order_items, public.messages, public.ai_actions,
  public.product_price_history, public.stock_movements, public.alert_rules,
  public.alerts, public.audit_logs, public.tenant_preferences,
  public.tenant_progress, public.shipments, public.order_cancellations,
  public.product_sku_components, public.promotions, public.promotion_items,
  public.coupons, public.conversation_sessions, public.subscription_usage,
  public.inventory_items, public.purchase_orders, public.purchase_order_items,
  public.inventory_movements, public.product_components, public.product_extra_costs,
  public.subscriptions, public.monthly_expenses, public.plans_config,
  public.competition_snapshots, public.action_workflows, public.workflow_steps,
  public.price_adjustment_workflows, public.price_adjustment_details
TO authenticated;

-- Única tabla legible por anon.
GRANT SELECT ON TABLE public.plans_config TO anon;

-- Integraciones: solo columnas operativas; tokens y metadata quedan inaccesibles.
GRANT SELECT (
  id, tenant_id, meli_user_id, nickname, site_id, status,
  token_expires_at, sync_error, last_success_refresh, last_sync_at,
  created_at, updated_at
) ON public.meli_accounts TO authenticated;

GRANT SELECT (
  id, tenant_id, phone_number, provider, provider_phone_id, status,
  created_at, updated_at
) ON public.whatsapp_numbers TO authenticated;

-- Columnas editables sin permitir escalada de rol/tenant/plan/status/metadata.
GRANT UPDATE (full_name, avatar_url, updated_at)
  ON public.profiles TO authenticated;
GRANT UPDATE (name, currency, timezone, updated_at)
  ON public.tenants TO authenticated;

-- CRUD que ya utiliza la aplicación con cliente autenticado.
GRANT INSERT, UPDATE, DELETE ON TABLE
  public.products, public.messages, public.ai_actions, public.alert_rules,
  public.alerts, public.product_sku_components, public.promotions,
  public.promotion_items, public.coupons, public.conversation_sessions,
  public.inventory_items, public.purchase_orders, public.purchase_order_items,
  public.inventory_movements, public.product_components,
  public.product_extra_costs, public.monthly_expenses,
  public.competition_snapshots, public.action_workflows, public.workflow_steps,
  public.price_adjustment_workflows, public.price_adjustment_details,
  public.product_price_history, public.stock_movements
TO authenticated;

GRANT INSERT, UPDATE ON TABLE
  public.tenant_preferences, public.tenant_progress
TO authenticated;

GRANT INSERT ON TABLE public.audit_logs TO authenticated;

-- Backend-only: service_role conserva acceso explícito.
GRANT ALL PRIVILEGES ON TABLE
  public.tenant_feature_flags, public.operation_runs
TO service_role;

--------------------------------------------------------------------------------
-- 5. VISTAS NO UTILIZADAS POR LA APP: sin acceso directo público/autenticado.
--------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.dashboard_sales_daily') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.dashboard_sales_daily FROM anon, authenticated, PUBLIC';
  END IF;

  IF to_regclass('public.dashboard_top_products') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.dashboard_top_products FROM anon, authenticated, PUBLIC';
  END IF;
END $$;

--------------------------------------------------------------------------------
-- POSTCONDICIÓN: ninguna política debe seguir asignada a PUBLIC.
--------------------------------------------------------------------------------
DO $$
DECLARE
  public_policies text[];
BEGIN
  SELECT array_agg(format('%I.%I:%I', schemaname, tablename, policyname))
  INTO public_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND 'public' = ANY(roles)
    AND tablename <> 'plans_config';

  IF public_policies IS NOT NULL THEN
    RAISE EXCEPTION 'Sprint 3 postcondition: PUBLIC policies remain: %', public_policies;
  END IF;
END $$;
