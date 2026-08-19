-- =====================================================================
-- ⚡ SUPABASE RLS PERFORMANCE OPTIMIZATION SCRIPT
-- Resolves slow query execution by caching tenant_id per statement
-- =====================================================================

-- 1. Helper function with STABLE volatility to cache auth tenant_id per query
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = (SELECT auth.uid()) LIMIT 1;
$$;

-- 2. Optimize RLS Policies using cached function

DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
CREATE POLICY "tenants_select" ON public.tenants FOR SELECT
  USING ( id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING ( id = (SELECT auth.uid()) );

DROP POLICY IF EXISTS "profiles_all" ON public.profiles;
CREATE POLICY "profiles_all" ON public.profiles FOR ALL
  USING ( id = (SELECT auth.uid()) );

DROP POLICY IF EXISTS "tenant_preferences_select" ON public.tenant_preferences;
CREATE POLICY "tenant_preferences_select" ON public.tenant_preferences FOR SELECT
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "tenant_preferences_all" ON public.tenant_preferences;
CREATE POLICY "tenant_preferences_all" ON public.tenant_preferences FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "tenant_progress_all" ON public.tenant_progress;
CREATE POLICY "tenant_progress_all" ON public.tenant_progress FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "plans_config_select" ON public.plans_config;
CREATE POLICY "plans_config_select" ON public.plans_config FOR SELECT USING ( true );

DROP POLICY IF EXISTS "subscriptions_select" ON public.subscriptions;
CREATE POLICY "subscriptions_select" ON public.subscriptions FOR SELECT
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "subscription_usage_select" ON public.subscription_usage;
CREATE POLICY "subscription_usage_select" ON public.subscription_usage FOR SELECT
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "monthly_expenses_all" ON public.monthly_expenses;
CREATE POLICY "monthly_expenses_all" ON public.monthly_expenses FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "meli_accounts_all" ON public.meli_accounts;
CREATE POLICY "meli_accounts_all" ON public.meli_accounts FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "products_all" ON public.products;
CREATE POLICY "products_all" ON public.products FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "product_price_history_all" ON public.product_price_history;
CREATE POLICY "product_price_history_all" ON public.product_price_history FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "stock_movements_all" ON public.stock_movements;
CREATE POLICY "stock_movements_all" ON public.stock_movements FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "orders_all" ON public.orders;
CREATE POLICY "orders_all" ON public.orders FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "order_items_all" ON public.order_items;
CREATE POLICY "order_items_all" ON public.order_items FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "shipments_all" ON public.shipments;
CREATE POLICY "shipments_all" ON public.shipments FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "order_cancellations_all" ON public.order_cancellations;
CREATE POLICY "order_cancellations_all" ON public.order_cancellations FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "whatsapp_numbers_all" ON public.whatsapp_numbers;
CREATE POLICY "whatsapp_numbers_all" ON public.whatsapp_numbers FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "conversation_sessions_all" ON public.conversation_sessions;
CREATE POLICY "conversation_sessions_all" ON public.conversation_sessions FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "messages_all" ON public.messages;
CREATE POLICY "messages_all" ON public.messages FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "competition_snapshots_all" ON public.competition_snapshots;
CREATE POLICY "competition_snapshots_all" ON public.competition_snapshots FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "promotions_all" ON public.promotions;
CREATE POLICY "promotions_all" ON public.promotions FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "promotion_items_all" ON public.promotion_items;
CREATE POLICY "promotion_items_all" ON public.promotion_items FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "coupons_all" ON public.coupons;
CREATE POLICY "coupons_all" ON public.coupons FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "action_workflows_all" ON public.action_workflows;
CREATE POLICY "action_workflows_all" ON public.action_workflows FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "ai_actions_all" ON public.ai_actions;
CREATE POLICY "ai_actions_all" ON public.ai_actions FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "workflow_steps_all" ON public.workflow_steps;
CREATE POLICY "workflow_steps_all" ON public.workflow_steps FOR ALL
  USING ( workflow_id IN (SELECT id FROM public.action_workflows WHERE tenant_id = public.get_auth_tenant_id()) );

DROP POLICY IF EXISTS "price_adjustment_workflows_all" ON public.price_adjustment_workflows;
CREATE POLICY "price_adjustment_workflows_all" ON public.price_adjustment_workflows FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "price_adjustment_details_all" ON public.price_adjustment_details;
CREATE POLICY "price_adjustment_details_all" ON public.price_adjustment_details FOR ALL
  USING ( workflow_id IN (SELECT id FROM public.price_adjustment_workflows WHERE tenant_id = public.get_auth_tenant_id()) );

DROP POLICY IF EXISTS "alerts_all" ON public.alerts;
CREATE POLICY "alerts_all" ON public.alerts FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "audit_logs_all" ON public.audit_logs;
CREATE POLICY "audit_logs_all" ON public.audit_logs FOR ALL
  USING ( tenant_id = public.get_auth_tenant_id() );

-- 3. Essential Database Performance Indexes

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_meli_accounts_tenant_id ON public.meli_accounts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON public.products (tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products (sku);
CREATE INDEX IF NOT EXISTS idx_products_meli_item_id ON public.products (meli_item_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON public.orders (tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_meli_order_id ON public.orders (meli_order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant_id ON public.order_items (tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON public.product_price_history (product_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant ON public.messages (tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_product_id ON public.messages (product_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_numbers_tenant ON public.whatsapp_numbers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON public.alerts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant ON public.inventory_items (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON public.inventory_items (sku_normalized);
CREATE INDEX IF NOT EXISTS idx_product_components_tenant ON public.product_components (tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_components_product ON public.product_components (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant ON public.inventory_movements (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON public.inventory_movements (inventory_item_id);
