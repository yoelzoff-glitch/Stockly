-- SPRINT 3 — MIGRACIÓN B: POLÍTICAS RLS IDEMPOTENTES BASADAS EN SCHEMA PRIVATE
-- PREFLIGHT: Requiere haber ejecutado 20260903000000_sprint03_a_foundations.sql

DO $$
BEGIN

  --------------------------------------------------------------------------------
  -- 1. CONFIGURACIÓN, PERFILES Y SUBSCRIPCIONES
  --------------------------------------------------------------------------------
  -- Profiles
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "profiles_tenant_select" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;

    CREATE POLICY "profiles_tenant_select" ON public.profiles FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() OR id = auth.uid());
    CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
      USING (id = auth.uid() AND private.current_profile_is_active())
      WITH CHECK (id = auth.uid() AND private.current_profile_is_active());
  END IF;

  -- Tenants
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "tenants_member_select" ON public.tenants;
    DROP POLICY IF EXISTS "tenants_owner_update" ON public.tenants;

    CREATE POLICY "tenants_member_select" ON public.tenants FOR SELECT TO authenticated
      USING (id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "tenants_owner_update" ON public.tenants FOR UPDATE TO authenticated
      USING (id = private.current_tenant_id() AND private.has_tenant_role(ARRAY['owner', 'admin']) AND private.current_profile_is_active())
      WITH CHECK (id = private.current_tenant_id() AND private.has_tenant_role(ARRAY['owner', 'admin']) AND private.current_profile_is_active());
  END IF;

  -- Subscriptions (Read-only para clientes)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "subscriptions_tenant_select" ON public.subscriptions;
    CREATE POLICY "subscriptions_tenant_select" ON public.subscriptions FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Subscription Usage (Read-only para clientes)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_usage' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "subscription_usage_tenant_select" ON public.subscription_usage;
    CREATE POLICY "subscription_usage_tenant_select" ON public.subscription_usage FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Plans Config (Public read)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plans_config' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "plans_config_select_authenticated" ON public.plans_config;
    CREATE POLICY "plans_config_select_authenticated" ON public.plans_config FOR SELECT TO authenticated
      USING (true);
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

  --------------------------------------------------------------------------------
  -- 2. INTEGRACIONES
  --------------------------------------------------------------------------------
  -- Mercado Libre Accounts (Read-only de columnas concedidas)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meli_accounts' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "meli_accounts_tenant_select" ON public.meli_accounts;
    CREATE POLICY "meli_accounts_tenant_select" ON public.meli_accounts FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- WhatsApp Numbers (Read-only de columnas concedidas)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_numbers' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "whatsapp_numbers_tenant_select" ON public.whatsapp_numbers;
    CREATE POLICY "whatsapp_numbers_tenant_select" ON public.whatsapp_numbers FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  --------------------------------------------------------------------------------
  -- 3. TABLAS OPERATIVAS Y VENTAS PRINCIPALES
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

  -- Orders (Read-only para authenticated)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "orders_tenant_select" ON public.orders;
    CREATE POLICY "orders_tenant_select" ON public.orders FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Order Cancellations (Read-only para authenticated con integridad de padre)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_cancellations' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "order_cancellations_tenant_select" ON public.order_cancellations;
    CREATE POLICY "order_cancellations_tenant_select" ON public.order_cancellations FOR SELECT TO authenticated
      USING (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = order_cancellations.order_id AND o.tenant_id = private.current_tenant_id()
        )
      );
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

  -- Purchase Orders
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

  -- Promotions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'promotions' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "promotions_tenant_select" ON public.promotions;
    DROP POLICY IF EXISTS "promotions_tenant_insert" ON public.promotions;
    DROP POLICY IF EXISTS "promotions_tenant_update" ON public.promotions;
    DROP POLICY IF EXISTS "promotions_tenant_delete" ON public.promotions;

    CREATE POLICY "promotions_tenant_select" ON public.promotions FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "promotions_tenant_insert" ON public.promotions FOR INSERT TO authenticated
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "promotions_tenant_update" ON public.promotions FOR UPDATE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "promotions_tenant_delete" ON public.promotions FOR DELETE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Coupons (Direct tenant isolation)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coupons' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "coupons_tenant_select" ON public.coupons;
    DROP POLICY IF EXISTS "coupons_tenant_insert" ON public.coupons;
    DROP POLICY IF EXISTS "coupons_tenant_update" ON public.coupons;
    DROP POLICY IF EXISTS "coupons_tenant_delete" ON public.coupons;

    CREATE POLICY "coupons_tenant_select" ON public.coupons FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "coupons_tenant_insert" ON public.coupons FOR INSERT TO authenticated
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "coupons_tenant_update" ON public.coupons FOR UPDATE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "coupons_tenant_delete" ON public.coupons FOR DELETE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  --------------------------------------------------------------------------------
  -- 4. AUTOMATIZACIONES, MENSAJES Y ALERTAS
  --------------------------------------------------------------------------------
  -- Messages
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "messages_tenant_select" ON public.messages;
    DROP POLICY IF EXISTS "messages_tenant_insert" ON public.messages;
    DROP POLICY IF EXISTS "messages_tenant_update" ON public.messages;
    DROP POLICY IF EXISTS "messages_tenant_delete" ON public.messages;

    CREATE POLICY "messages_tenant_select" ON public.messages FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "messages_tenant_insert" ON public.messages FOR INSERT TO authenticated
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "messages_tenant_update" ON public.messages FOR UPDATE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "messages_tenant_delete" ON public.messages FOR DELETE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Alert Rules
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alert_rules' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "alert_rules_tenant_select" ON public.alert_rules;
    DROP POLICY IF EXISTS "alert_rules_tenant_insert" ON public.alert_rules;
    DROP POLICY IF EXISTS "alert_rules_tenant_update" ON public.alert_rules;
    DROP POLICY IF EXISTS "alert_rules_tenant_delete" ON public.alert_rules;

    CREATE POLICY "alert_rules_tenant_select" ON public.alert_rules FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "alert_rules_tenant_insert" ON public.alert_rules FOR INSERT TO authenticated
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "alert_rules_tenant_update" ON public.alert_rules FOR UPDATE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "alert_rules_tenant_delete" ON public.alert_rules FOR DELETE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Alerts
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alerts' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "alerts_tenant_select" ON public.alerts;
    DROP POLICY IF EXISTS "alerts_tenant_insert" ON public.alerts;
    DROP POLICY IF EXISTS "alerts_tenant_update" ON public.alerts;
    DROP POLICY IF EXISTS "alerts_tenant_delete" ON public.alerts;

    CREATE POLICY "alerts_tenant_select" ON public.alerts FOR SELECT TO authenticated
      USING (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND (alert_rule_id IS NULL OR EXISTS (SELECT 1 FROM public.alert_rules ar WHERE ar.id = alerts.alert_rule_id AND ar.tenant_id = private.current_tenant_id()))
      );
    CREATE POLICY "alerts_tenant_insert" ON public.alerts FOR INSERT TO authenticated
      WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND (alert_rule_id IS NULL OR EXISTS (SELECT 1 FROM public.alert_rules ar WHERE ar.id = alerts.alert_rule_id AND ar.tenant_id = private.current_tenant_id()))
      );
    CREATE POLICY "alerts_tenant_update" ON public.alerts FOR UPDATE TO authenticated
      USING (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND (alert_rule_id IS NULL OR EXISTS (SELECT 1 FROM public.alert_rules ar WHERE ar.id = alerts.alert_rule_id AND ar.tenant_id = private.current_tenant_id()))
      )
      WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND (alert_rule_id IS NULL OR EXISTS (SELECT 1 FROM public.alert_rules ar WHERE ar.id = alerts.alert_rule_id AND ar.tenant_id = private.current_tenant_id()))
      );
    CREATE POLICY "alerts_tenant_delete" ON public.alerts FOR DELETE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- AI Actions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_actions' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "ai_actions_tenant_select" ON public.ai_actions;
    DROP POLICY IF EXISTS "ai_actions_tenant_insert" ON public.ai_actions;
    DROP POLICY IF EXISTS "ai_actions_tenant_update" ON public.ai_actions;
    DROP POLICY IF EXISTS "ai_actions_tenant_delete" ON public.ai_actions;

    CREATE POLICY "ai_actions_tenant_select" ON public.ai_actions FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "ai_actions_tenant_insert" ON public.ai_actions FOR INSERT TO authenticated
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "ai_actions_tenant_update" ON public.ai_actions FOR UPDATE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "ai_actions_tenant_delete" ON public.ai_actions FOR DELETE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Action Workflows
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'action_workflows' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "action_workflows_tenant_select" ON public.action_workflows;
    DROP POLICY IF EXISTS "action_workflows_tenant_insert" ON public.action_workflows;
    DROP POLICY IF EXISTS "action_workflows_tenant_update" ON public.action_workflows;
    DROP POLICY IF EXISTS "action_workflows_tenant_delete" ON public.action_workflows;

    CREATE POLICY "action_workflows_tenant_select" ON public.action_workflows FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "action_workflows_tenant_insert" ON public.action_workflows FOR INSERT TO authenticated
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "action_workflows_tenant_update" ON public.action_workflows FOR UPDATE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "action_workflows_tenant_delete" ON public.action_workflows FOR DELETE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Price Adjustment Workflows
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'price_adjustment_workflows' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "price_adjustment_workflows_tenant_select" ON public.price_adjustment_workflows;
    DROP POLICY IF EXISTS "price_adjustment_workflows_tenant_insert" ON public.price_adjustment_workflows;
    DROP POLICY IF EXISTS "price_adjustment_workflows_tenant_update" ON public.price_adjustment_workflows;
    DROP POLICY IF EXISTS "price_adjustment_workflows_tenant_delete" ON public.price_adjustment_workflows;

    CREATE POLICY "price_adjustment_workflows_tenant_select" ON public.price_adjustment_workflows FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "price_adjustment_workflows_tenant_insert" ON public.price_adjustment_workflows FOR INSERT TO authenticated
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "price_adjustment_workflows_tenant_update" ON public.price_adjustment_workflows FOR UPDATE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "price_adjustment_workflows_tenant_delete" ON public.price_adjustment_workflows FOR DELETE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Audit Logs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "audit_logs_tenant_select" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_tenant_insert" ON public.audit_logs;

    CREATE POLICY "audit_logs_tenant_select" ON public.audit_logs FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "audit_logs_tenant_insert" ON public.audit_logs FOR INSERT TO authenticated
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Tenant Progress
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_progress' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "tenant_progress_tenant_select" ON public.tenant_progress;
    DROP POLICY IF EXISTS "tenant_progress_tenant_insert" ON public.tenant_progress;
    DROP POLICY IF EXISTS "tenant_progress_tenant_update" ON public.tenant_progress;

    CREATE POLICY "tenant_progress_tenant_select" ON public.tenant_progress FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "tenant_progress_tenant_insert" ON public.tenant_progress FOR INSERT TO authenticated
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "tenant_progress_tenant_update" ON public.tenant_progress FOR UPDATE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Tenant Preferences
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_preferences' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "tenant_preferences_tenant_select" ON public.tenant_preferences;
    DROP POLICY IF EXISTS "tenant_preferences_tenant_insert" ON public.tenant_preferences;
    DROP POLICY IF EXISTS "tenant_preferences_tenant_update" ON public.tenant_preferences;

    CREATE POLICY "tenant_preferences_tenant_select" ON public.tenant_preferences FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "tenant_preferences_tenant_insert" ON public.tenant_preferences FOR INSERT TO authenticated
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "tenant_preferences_tenant_update" ON public.tenant_preferences FOR UPDATE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Competition Snapshots
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'competition_snapshots' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "competition_snapshots_tenant_select" ON public.competition_snapshots;
    DROP POLICY IF EXISTS "competition_snapshots_tenant_insert" ON public.competition_snapshots;
    DROP POLICY IF EXISTS "competition_snapshots_tenant_update" ON public.competition_snapshots;
    DROP POLICY IF EXISTS "competition_snapshots_tenant_delete" ON public.competition_snapshots;

    CREATE POLICY "competition_snapshots_tenant_select" ON public.competition_snapshots FOR SELECT TO authenticated
      USING (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = competition_snapshots.product_id AND p.tenant_id = private.current_tenant_id())
      );
    CREATE POLICY "competition_snapshots_tenant_insert" ON public.competition_snapshots FOR INSERT TO authenticated
      WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = competition_snapshots.product_id AND p.tenant_id = private.current_tenant_id())
      );
    CREATE POLICY "competition_snapshots_tenant_update" ON public.competition_snapshots FOR UPDATE TO authenticated
      USING (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = competition_snapshots.product_id AND p.tenant_id = private.current_tenant_id())
      )
      WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = competition_snapshots.product_id AND p.tenant_id = private.current_tenant_id())
      );
    CREATE POLICY "competition_snapshots_tenant_delete" ON public.competition_snapshots FOR DELETE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  -- Conversation Sessions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_sessions' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "conversation_sessions_tenant_select" ON public.conversation_sessions;
    DROP POLICY IF EXISTS "conversation_sessions_tenant_insert" ON public.conversation_sessions;
    DROP POLICY IF EXISTS "conversation_sessions_tenant_update" ON public.conversation_sessions;
    DROP POLICY IF EXISTS "conversation_sessions_tenant_delete" ON public.conversation_sessions;

    CREATE POLICY "conversation_sessions_tenant_select" ON public.conversation_sessions FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "conversation_sessions_tenant_insert" ON public.conversation_sessions FOR INSERT TO authenticated
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "conversation_sessions_tenant_update" ON public.conversation_sessions FOR UPDATE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())
      WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
    CREATE POLICY "conversation_sessions_tenant_delete" ON public.conversation_sessions FOR DELETE TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
  END IF;

  --------------------------------------------------------------------------------
  -- 5. TABLAS HIJAS CON INTEGRIDAD DE TENANT Y PADRE (SUBQUERY EXISTS)
  --------------------------------------------------------------------------------
  -- Order Items -> orders
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_items' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "order_items_tenant_select" ON public.order_items;
    CREATE POLICY "order_items_tenant_select" ON public.order_items FOR SELECT TO authenticated
      USING (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = order_items.order_id AND o.tenant_id = private.current_tenant_id()
        )
      );
  END IF;

  -- Shipments -> orders
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipments' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "shipments_tenant_select" ON public.shipments;
    CREATE POLICY "shipments_tenant_select" ON public.shipments FOR SELECT TO authenticated
      USING (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = shipments.order_id AND o.tenant_id = private.current_tenant_id()
        )
      );
  END IF;

  -- Purchase Order Items -> purchase_orders
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_order_items' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "purchase_order_items_tenant_all" ON public.purchase_order_items;
    CREATE POLICY "purchase_order_items_tenant_all" ON public.purchase_order_items
      FOR ALL TO authenticated
      USING (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND EXISTS (
          SELECT 1 FROM public.purchase_orders po
          WHERE po.id = purchase_order_items.purchase_order_id AND po.tenant_id = private.current_tenant_id()
        )
      )
      WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND EXISTS (
          SELECT 1 FROM public.purchase_orders po
          WHERE po.id = purchase_order_items.purchase_order_id AND po.tenant_id = private.current_tenant_id()
        )
      );
  END IF;

  -- Workflow Steps -> action_workflows (Sin tenant_id propio)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_steps' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "workflow_steps_tenant_all" ON public.workflow_steps;
    CREATE POLICY "workflow_steps_tenant_all" ON public.workflow_steps
      FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.action_workflows aw
        WHERE aw.id = workflow_steps.workflow_id AND aw.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.action_workflows aw
        WHERE aw.id = workflow_steps.workflow_id AND aw.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ));
  END IF;

  -- Price Adjustment Details -> price_adjustment_workflows (Sin tenant_id propio)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'price_adjustment_details' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "price_adjustment_details_tenant_all" ON public.price_adjustment_details;
    CREATE POLICY "price_adjustment_details_tenant_all" ON public.price_adjustment_details
      FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.price_adjustment_workflows paw
        WHERE paw.id = price_adjustment_details.workflow_id AND paw.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.price_adjustment_workflows paw
        WHERE paw.id = price_adjustment_details.workflow_id AND paw.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ));
  END IF;

  -- Product Price History -> products
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_price_history' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "product_price_history_tenant_all" ON public.product_price_history;
    CREATE POLICY "product_price_history_tenant_all" ON public.product_price_history
      FOR ALL TO authenticated
      USING (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND EXISTS (
          SELECT 1 FROM public.products p
          WHERE p.id = product_price_history.product_id AND p.tenant_id = private.current_tenant_id()
        )
      )
      WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND EXISTS (
          SELECT 1 FROM public.products p
          WHERE p.id = product_price_history.product_id AND p.tenant_id = private.current_tenant_id()
        )
      );
  END IF;

  -- Stock Movements -> products
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_movements' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "stock_movements_tenant_all" ON public.stock_movements;
    CREATE POLICY "stock_movements_tenant_all" ON public.stock_movements
      FOR ALL TO authenticated
      USING (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND EXISTS (
          SELECT 1 FROM public.products p
          WHERE p.id = stock_movements.product_id AND p.tenant_id = private.current_tenant_id()
        )
      )
      WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND EXISTS (
          SELECT 1 FROM public.products p
          WHERE p.id = stock_movements.product_id AND p.tenant_id = private.current_tenant_id()
        )
      );
  END IF;

  -- Promotion Items -> promotions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'promotion_items' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "promotion_items_tenant_all" ON public.promotion_items;
    CREATE POLICY "promotion_items_tenant_all" ON public.promotion_items
      FOR ALL TO authenticated
      USING (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND EXISTS (
          SELECT 1 FROM public.promotions p
          WHERE p.id = promotion_items.promotion_id AND p.tenant_id = private.current_tenant_id()
        )
      )
      WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND EXISTS (
          SELECT 1 FROM public.promotions p
          WHERE p.id = promotion_items.promotion_id AND p.tenant_id = private.current_tenant_id()
        )
      );
  END IF;

  -- Product Components -> products
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_components' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "product_components_tenant_all" ON public.product_components;
    CREATE POLICY "product_components_tenant_all" ON public.product_components
      FOR ALL TO authenticated
      USING (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND EXISTS (
          SELECT 1 FROM public.products p
          WHERE p.id = product_components.product_id AND p.tenant_id = private.current_tenant_id()
        )
      )
      WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND EXISTS (
          SELECT 1 FROM public.products p
          WHERE p.id = product_components.product_id AND p.tenant_id = private.current_tenant_id()
        )
      );
  END IF;

  -- Product SKU Components -> products
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_sku_components' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "product_sku_components_tenant_all" ON public.product_sku_components;
    CREATE POLICY "product_sku_components_tenant_all" ON public.product_sku_components
      FOR ALL TO authenticated
      USING (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND EXISTS (
          SELECT 1 FROM public.products p
          WHERE p.id = product_sku_components.product_id AND p.tenant_id = private.current_tenant_id()
        )
      )
      WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND EXISTS (
          SELECT 1 FROM public.products p
          WHERE p.id = product_sku_components.product_id AND p.tenant_id = private.current_tenant_id()
        )
      );
  END IF;

  -- Product Extra Costs -> products
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_extra_costs' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "product_extra_costs_tenant_all" ON public.product_extra_costs;
    CREATE POLICY "product_extra_costs_tenant_all" ON public.product_extra_costs
      FOR ALL TO authenticated
      USING (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND (product_id IS NULL OR EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_extra_costs.product_id AND p.tenant_id = private.current_tenant_id()))
      )
      WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND (product_id IS NULL OR EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_extra_costs.product_id AND p.tenant_id = private.current_tenant_id()))
      );
  END IF;

  -- Inventory Movements -> inventory_items
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_movements' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "inventory_movements_tenant_all" ON public.inventory_movements;
    CREATE POLICY "inventory_movements_tenant_all" ON public.inventory_movements
      FOR ALL TO authenticated
      USING (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND (inventory_item_id IS NULL OR EXISTS (SELECT 1 FROM public.inventory_items ii WHERE ii.id = inventory_movements.inventory_item_id AND ii.tenant_id = private.current_tenant_id()))
      )
      WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.current_profile_is_active()
        AND (inventory_item_id IS NULL OR EXISTS (SELECT 1 FROM public.inventory_items ii WHERE ii.id = inventory_movements.inventory_item_id AND ii.tenant_id = private.current_tenant_id()))
      );
  END IF;

END $$;
