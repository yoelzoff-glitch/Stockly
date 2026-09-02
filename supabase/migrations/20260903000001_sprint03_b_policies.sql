-- SPRINT 3 — MIGRACIÓN B: DECLARACIÓN DE POLÍTICAS RLS IDEMPOTENTES POR TABLA
-- PREFLIGHT:
-- Requiere haber ejecutado la Migración A (funciones en schema private).

DO $$
BEGIN

  --------------------------------------------------------------------------------
  -- 0. REEMPLAZO EXPLÍCITO DE POLÍTICAS ANTIGUAS INSEGURAS
  --------------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'monthly_expenses' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "Users can read their tenant's monthly expenses" ON public.monthly_expenses;
    DROP POLICY IF EXISTS "Users can insert their tenant's monthly expenses" ON public.monthly_expenses;
    DROP POLICY IF EXISTS "Users can update their tenant's monthly expenses" ON public.monthly_expenses;
    DROP POLICY IF EXISTS "Users can delete their tenant's monthly expenses" ON public.monthly_expenses;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plans_config' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "Anyone can read plans_config" ON public.plans_config;
  END IF;

  --------------------------------------------------------------------------------
  -- 1. TABLA: PROFILES (Aislamiento y no-escalada)
  --------------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "profiles_select_own_tenant" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_update_own_row" ON public.profiles;

    CREATE POLICY "profiles_select_own_tenant" ON public.profiles
      FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());

    CREATE POLICY "profiles_update_own_row" ON public.profiles
      FOR UPDATE TO authenticated
      USING (id = auth.uid() AND private.current_profile_is_active())
      WITH CHECK (id = auth.uid() AND private.current_profile_is_active());
  END IF;

  --------------------------------------------------------------------------------
  -- 2. TABLA: TENANTS
  --------------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "tenants_select_own" ON public.tenants;
    DROP POLICY IF EXISTS "tenants_update_own" ON public.tenants;

    CREATE POLICY "tenants_select_own" ON public.tenants
      FOR SELECT TO authenticated
      USING (id = private.current_tenant_id() AND private.current_profile_is_active());

    CREATE POLICY "tenants_update_own" ON public.tenants
      FOR UPDATE TO authenticated
      USING (id = private.current_tenant_id() AND private.current_profile_is_active())
      WITH CHECK (id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  --------------------------------------------------------------------------------
  -- 3. TABLAS DE CONSULTA EXCLUSIVA PARA AUTHENTICATED (READ-ONLY)
  --------------------------------------------------------------------------------
  -- Subscriptions (Solo lectura authenticated, escrituras vía webhook service_role)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "subscriptions_tenant_select" ON public.subscriptions;
    CREATE POLICY "subscriptions_tenant_select" ON public.subscriptions
      FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Subscription Usage (Solo lectura authenticated)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_usage' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "subscription_usage_tenant_select" ON public.subscription_usage;
    CREATE POLICY "subscription_usage_tenant_select" ON public.subscription_usage
      FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Meli Accounts (Solo lectura de columnas seguras authenticated, sin escrituras directas)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meli_accounts' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "meli_accounts_tenant_select" ON public.meli_accounts;
    CREATE POLICY "meli_accounts_tenant_select" ON public.meli_accounts
      FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- WhatsApp Numbers (Solo lectura de columnas seguras authenticated)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_numbers' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "whatsapp_numbers_tenant_select" ON public.whatsapp_numbers;
    CREATE POLICY "whatsapp_numbers_tenant_select" ON public.whatsapp_numbers
      FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Orders & Order Items (Lectura para UI authenticated, escrituras reservadas al backend)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "orders_tenant_select" ON public.orders;
    CREATE POLICY "orders_tenant_select" ON public.orders
      FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_items' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "order_items_tenant_select" ON public.order_items;
    CREATE POLICY "order_items_tenant_select" ON public.order_items
      FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Shipments (Lectura para UI authenticated vía padre order)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipments' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "shipments_tenant_select" ON public.shipments;
    CREATE POLICY "shipments_tenant_select" ON public.shipments
      FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.orders o 
        WHERE o.id = shipments.order_id AND o.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ));
  END IF;

  -- Order Cancellations (Lectura authenticated)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_cancellations' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "order_cancellations_tenant_select" ON public.order_cancellations;
    CREATE POLICY "order_cancellations_tenant_select" ON public.order_cancellations
      FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Audit Logs (SELECT & INSERT authenticated, sin UPDATE ni DELETE)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "audit_logs_tenant_select" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_tenant_insert" ON public.audit_logs;

    CREATE POLICY "audit_logs_tenant_select" ON public.audit_logs
      FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());

    CREATE POLICY "audit_logs_tenant_insert" ON public.audit_logs
      FOR INSERT TO authenticated
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  --------------------------------------------------------------------------------
  -- 4. TABLAS OPERATIVAS CON CRUD CONTROLADO
  --------------------------------------------------------------------------------
  -- Products
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "products_tenant_select" ON public.products;
    DROP POLICY IF EXISTS "products_tenant_insert" ON public.products;
    DROP POLICY IF EXISTS "products_tenant_update" ON public.products;
    DROP POLICY IF EXISTS "products_tenant_delete" ON public.products;

    CREATE POLICY "products_tenant_select" ON public.products FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "products_tenant_insert" ON public.products FOR INSERT TO authenticated
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "products_tenant_update" ON public.products FOR UPDATE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "products_tenant_delete" ON public.products FOR DELETE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Inventory Items
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_items' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "inventory_items_tenant_select" ON public.inventory_items;
    DROP POLICY IF EXISTS "inventory_items_tenant_insert" ON public.inventory_items;
    DROP POLICY IF EXISTS "inventory_items_tenant_update" ON public.inventory_items;
    DROP POLICY IF EXISTS "inventory_items_tenant_delete" ON public.inventory_items;

    CREATE POLICY "inventory_items_tenant_select" ON public.inventory_items FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "inventory_items_tenant_insert" ON public.inventory_items FOR INSERT TO authenticated
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "inventory_items_tenant_update" ON public.inventory_items FOR UPDATE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "inventory_items_tenant_delete" ON public.inventory_items FOR DELETE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Monthly Expenses
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'monthly_expenses' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "monthly_expenses_tenant_select" ON public.monthly_expenses;
    DROP POLICY IF EXISTS "monthly_expenses_tenant_insert" ON public.monthly_expenses;
    DROP POLICY IF EXISTS "monthly_expenses_tenant_update" ON public.monthly_expenses;
    DROP POLICY IF EXISTS "monthly_expenses_tenant_delete" ON public.monthly_expenses;

    CREATE POLICY "monthly_expenses_tenant_select" ON public.monthly_expenses FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "monthly_expenses_tenant_insert" ON public.monthly_expenses FOR INSERT TO authenticated
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "monthly_expenses_tenant_update" ON public.monthly_expenses FOR UPDATE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "monthly_expenses_tenant_delete" ON public.monthly_expenses FOR DELETE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Purchase Orders & Items
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "purchase_orders_tenant_select" ON public.purchase_orders;
    DROP POLICY IF EXISTS "purchase_orders_tenant_insert" ON public.purchase_orders;
    DROP POLICY IF EXISTS "purchase_orders_tenant_update" ON public.purchase_orders;
    DROP POLICY IF EXISTS "purchase_orders_tenant_delete" ON public.purchase_orders;

    CREATE POLICY "purchase_orders_tenant_select" ON public.purchase_orders FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "purchase_orders_tenant_insert" ON public.purchase_orders FOR INSERT TO authenticated
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "purchase_orders_tenant_update" ON public.purchase_orders FOR UPDATE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "purchase_orders_tenant_delete" ON public.purchase_orders FOR DELETE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_order_items' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "purchase_order_items_tenant_all" ON public.purchase_order_items;

    CREATE POLICY "purchase_order_items_tenant_all" ON public.purchase_order_items
      FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.purchase_orders po
        WHERE po.id = purchase_order_items.purchase_order_id AND po.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.purchase_orders po
        WHERE po.id = purchase_order_items.purchase_order_id AND po.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ));
  END IF;

  -- Alerts & AI Actions (SELECT & UPDATE)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alerts' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "alerts_tenant_select" ON public.alerts;
    DROP POLICY IF EXISTS "alerts_tenant_update" ON public.alerts;

    CREATE POLICY "alerts_tenant_select" ON public.alerts FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "alerts_tenant_update" ON public.alerts FOR UPDATE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_actions' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "ai_actions_tenant_select" ON public.ai_actions;
    DROP POLICY IF EXISTS "ai_actions_tenant_update" ON public.ai_actions;

    CREATE POLICY "ai_actions_tenant_select" ON public.ai_actions FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "ai_actions_tenant_update" ON public.ai_actions FOR UPDATE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Plans config (Pública intencional)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plans_config' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "plans_config_public_read" ON public.plans_config;
    CREATE POLICY "plans_config_public_read" ON public.plans_config
      FOR SELECT TO public
      USING (true);
  END IF;

END $$;
