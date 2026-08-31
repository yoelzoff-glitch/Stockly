-- =====================================================================
-- KLYVO (STOCKLY) - CONSOLIDATED DATABASE SCHEMA SETUP
-- This script sets up the complete database schema from scratch.
-- Run this in the SQL Editor of your development Supabase project.
-- =====================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- 1. CORE SaaS TABLES
-- =====================================================================

-- Table: public.tenants
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL DEFAULT 'starter',
    status TEXT NOT NULL DEFAULT 'active',
    timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    currency TEXT NOT NULL DEFAULT 'ARS',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: public.profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY, -- References auth.users(id)
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'user')),
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: public.tenant_preferences (Sprint 13)
CREATE TABLE IF NOT EXISTS public.tenant_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    minimum_margin NUMERIC DEFAULT 15.0,
    never_pause_products BOOLEAN DEFAULT false,
    auto_respond_questions BOOLEAN DEFAULT false,
    preferred_price_strategy TEXT DEFAULT 'match_competitor',
    automation_rules JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT tenant_preferences_tenant_id_key UNIQUE (tenant_id)
);

-- Table: public.tenant_progress (Sprint 16)
CREATE TABLE IF NOT EXISTS public.tenant_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    step TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    CONSTRAINT tenant_progress_tenant_id_step_key UNIQUE (tenant_id, step)
);

-- =====================================================================
-- 2. SUBSCRIPTION & BILLING
-- =====================================================================

-- Table: public.plans_config
CREATE TABLE IF NOT EXISTS public.plans_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_key TEXT NOT NULL UNIQUE, -- 'starter', 'pro', 'ultra'
    display_name TEXT NOT NULL,
    ai_credits_limit INTEGER NOT NULL DEFAULT 500,
    automation_limit INTEGER NOT NULL DEFAULT 250,
    whatsapp_limit INTEGER NOT NULL DEFAULT 300,
    sku_limit INTEGER NOT NULL DEFAULT 100,
    price_monthly NUMERIC,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: public.subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    mercadopago_subscription_id TEXT,
    expires_at TIMESTAMPTZ,
    pending_plan TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: public.subscription_usage
CREATE TABLE IF NOT EXISTS public.subscription_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    month DATE NOT NULL,
    ai_credits_used INTEGER DEFAULT 0,
    whatsapp_messages_used INTEGER DEFAULT 0,
    automation_actions_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, month)
);

-- Table: public.monthly_expenses
CREATE TABLE IF NOT EXISTS public.monthly_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('fixed_recurring', 'fixed_one_off', 'percent_variable')),
    amount NUMERIC,
    percentage NUMERIC,
    target_month TEXT,
    start_month DATE DEFAULT date_trunc('month', CURRENT_DATE),
    end_month DATE,
    is_active BOOLEAN DEFAULT true,
    is_daily BOOLEAN DEFAULT false,
    has_iva BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 3. INTEGRATIONS & CHANNELS
-- =====================================================================

-- Table: public.meli_accounts
CREATE TABLE IF NOT EXISTS public.meli_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    meli_user_id TEXT NOT NULL,
    nickname TEXT,
    site_id TEXT DEFAULT 'MLA',
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error', 'syncing')),
    last_sync_at TIMESTAMPTZ,
    sync_error TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tenant_meli_user UNIQUE (tenant_id, meli_user_id)
);


-- =====================================================================
-- 4. PRODUCTS & LISTINGS
-- =====================================================================

-- Table: public.products
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    meli_account_id UUID REFERENCES public.meli_accounts(id) ON DELETE SET NULL,
    meli_item_id TEXT NOT NULL,
    title TEXT NOT NULL,
    sku TEXT,
    permalink TEXT,
    thumbnail_url TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    listing_type_id TEXT,
    category_id TEXT,
    price NUMERIC NOT NULL DEFAULT 0.00,
    base_price NUMERIC,
    original_price NUMERIC,
    available_quantity INTEGER NOT NULL DEFAULT 0,
    sold_quantity INTEGER NOT NULL DEFAULT 0,
    cost NUMERIC,
    estimated_fee NUMERIC,
    estimated_shipping_cost NUMERIC DEFAULT 0,
    estimated_tax NUMERIC DEFAULT 0,
    margin_amount NUMERIC,
    margin_percent NUMERIC,
    raw_data JSONB DEFAULT '{}'::jsonb,
    last_synced_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Rentabilidad adicional (Sprint 22/31)
    extra_fee_amount NUMERIC DEFAULT 0,
    promotion_discount_amount NUMERIC DEFAULT 0,
    profit_last_calculated_at TIMESTAMPTZ,
    profit_real_estimated NUMERIC,
    profit_real_margin NUMERIC,
    profitability_status TEXT,
    campaign_data JSONB DEFAULT '[]'::jsonb,
    promotion_data JSONB DEFAULT '[]'::jsonb,
    
    CONSTRAINT unique_tenant_meli_item UNIQUE (tenant_id, meli_item_id)
);


-- Table: public.product_price_history
CREATE TABLE IF NOT EXISTS public.product_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    old_price NUMERIC,
    new_price NUMERIC NOT NULL,
    changed_by TEXT,
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: public.stock_movements (Legacy listings stock)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL,
    quantity_delta INTEGER NOT NULL,
    previous_quantity INTEGER,
    new_quantity INTEGER,
    reason TEXT,
    source TEXT NOT NULL,
    changed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 5. ORDERS & SHIPMENTS
-- =====================================================================

-- Table: public.orders
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    meli_account_id UUID REFERENCES public.meli_accounts(id) ON DELETE SET NULL,
    meli_order_id TEXT NOT NULL,
    status TEXT,
    buyer_nickname TEXT,
    buyer_id TEXT,
    total_amount NUMERIC NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC,
    currency_id TEXT DEFAULT 'ARS',
    date_created TIMESTAMPTZ,
    date_closed TIMESTAMPTZ,
    raw_data JSONB DEFAULT '{}'::jsonb,
    internal_stock_processed BOOLEAN DEFAULT false,
    internal_stock_processed_at TIMESTAMPTZ,
    meli_shipment_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tenant_meli_order UNIQUE (tenant_id, meli_order_id)
);

-- Table: public.order_items
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    meli_item_id TEXT,
    title TEXT NOT NULL,
    sku TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0.00,
    total_price NUMERIC,
    unit_cost NUMERIC,
    estimated_fee NUMERIC,
    estimated_shipping_cost NUMERIC,
    estimated_tax NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index order items uniqueness (prevent duplicates Sprint 12)
CREATE UNIQUE INDEX IF NOT EXISTS order_items_order_id_meli_item_id_sku_unique_idx 
ON public.order_items (order_id, meli_item_id, COALESCE(sku, ''));

-- Table: public.shipments (Sprint 22)
CREATE TABLE IF NOT EXISTS public.shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    meli_shipment_id TEXT,
    status TEXT,
    substatus TEXT,
    logistic_type TEXT,
    mode TEXT,
    tracking_number TEXT,
    tracking_method TEXT,
    shipping_cost NUMERIC DEFAULT 0,
    receiver_city TEXT,
    receiver_state TEXT,
    date_created TIMESTAMPTZ,
    last_updated TIMESTAMPTZ,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: public.order_cancellations (Sprint 22)
CREATE TABLE IF NOT EXISTS public.order_cancellations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    meli_order_id TEXT,
    reason TEXT,
    cancelled_by TEXT,
    refund_amount NUMERIC DEFAULT 0,
    date_cancelled TIMESTAMPTZ,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS order_cancellations_order_id_unique_idx
ON public.order_cancellations (order_id);

-- =====================================================================
-- 6. BOM (BILL OF MATERIALS) & INVENTORY SYSTEM
-- =====================================================================

-- Table: public.inventory_items (Sprint 34)
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    sku_normalized TEXT NOT NULL,
    name TEXT,
    category TEXT,
    unit_cost NUMERIC,
    average_cost NUMERIC,
    last_purchase_cost NUMERIC,
    current_stock INTEGER NOT NULL DEFAULT 0,
    minimum_stock INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tenant_sku_normalized UNIQUE (tenant_id, sku_normalized)
);

-- Table: public.purchase_orders (Sprint 34)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    supplier_name TEXT,
    purchase_date TIMESTAMPTZ DEFAULT NOW(),
    total_amount NUMERIC,
    extra_costs NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'completed',
    source TEXT DEFAULT 'ai',
    raw_input TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: public.purchase_order_items (Sprint 34)
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
    sku TEXT NOT NULL,
    sku_normalized TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_cost NUMERIC,
    total_cost NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: public.inventory_movements (Sprint 34)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL, -- 'purchase', 'adjustment', 'sale_reserved', 'sale_confirmed', 'return', 'manual', 'void_purchase'
    quantity_delta INTEGER NOT NULL,
    previous_stock INTEGER,
    new_stock INTEGER,
    unit_cost NUMERIC,
    total_cost NUMERIC,
    source TEXT,
    reference_id UUID,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: public.product_components (Sprint 34 BOM)
CREATE TABLE IF NOT EXISTS public.product_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    component_sku TEXT NOT NULL,
    component_normalized TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_cost NUMERIC,
    total_component_cost NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tenant_product_component_normalized UNIQUE (tenant_id, product_id, component_normalized)
);

-- Table: public.product_sku_components (Legacy BOM table)
CREATE TABLE IF NOT EXISTS public.product_sku_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    component_sku TEXT NOT NULL,
    component_normalized TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_tenant_product_component UNIQUE (tenant_id, product_id, component_normalized)
);

-- Table: public.product_extra_costs
CREATE TABLE IF NOT EXISTS public.product_extra_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    cost_type TEXT NOT NULL DEFAULT 'fixed',
    applies_to TEXT NOT NULL DEFAULT 'product',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 7. CONVERSATIONS & MESSAGING (WhatsApp & Web AI Chat)
-- =====================================================================

-- Table: public.whatsapp_numbers
CREATE TABLE IF NOT EXISTS public.whatsapp_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
    phone_number TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'meta',
    provider_phone_id TEXT,
    access_token TEXT,
    status TEXT NOT NULL DEFAULT 'disconnected',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: public.conversation_sessions
CREATE TABLE IF NOT EXISTS public.conversation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID,
    channel TEXT NOT NULL DEFAULT 'web',
    phone_number TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    current_workflow_id UUID,
    current_action_id UUID,
    current_action_type TEXT,
    missing_fields JSONB DEFAULT '[]'::jsonb,
    context JSONB DEFAULT '{}'::jsonb,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: public.messages
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    channel TEXT NOT NULL DEFAULT 'web',
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    from_phone TEXT,
    to_phone TEXT,
    text TEXT,
    audio_url TEXT,
    transcription TEXT,
    intent TEXT,
    confidence NUMERIC,
    ai_response TEXT,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 8. ANALYTICS, PROMOTIONS & SYSTEM ENGINE
-- =====================================================================

-- Table: public.competition_snapshots (Sprint 14)
CREATE TABLE IF NOT EXISTS public.competition_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  own_price NUMERIC NOT NULL,
  avg_price NUMERIC,
  min_price NUMERIC,
  max_price NUMERIC,
  median_price NUMERIC,
  competitors_count INTEGER DEFAULT 0,
  free_shipping_count INTEGER DEFAULT 0,
  raw_results JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: public.promotions (Sprint 31)
CREATE TABLE IF NOT EXISTS public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    meli_promotion_id TEXT,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    title TEXT,
    description TEXT,
    discount_type TEXT,
    discount_value NUMERIC,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    target_audience TEXT,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    raw_response JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: public.promotion_items (Sprint 31)
CREATE TABLE IF NOT EXISTS public.promotion_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    meli_item_id TEXT,
    current_price NUMERIC,
    discount_price NUMERIC,
    discount_percent NUMERIC,
    expected_margin NUMERIC,
    status TEXT DEFAULT 'pending',
    raw_response JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: public.coupons (Sprint 31)
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    meli_coupon_id TEXT,
    title TEXT,
    code TEXT,
    coupon_type TEXT,
    discount_type TEXT,
    discount_value NUMERIC,
    min_purchase_amount NUMERIC,
    max_uses INTEGER,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    target_audience TEXT,
    status TEXT DEFAULT 'draft',
    raw_payload JSONB DEFAULT '{}'::jsonb,
    raw_response JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: public.action_workflows (AI Workflows Engine)
CREATE TABLE IF NOT EXISTS public.action_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    summary TEXT,
    risk_score TEXT NOT NULL CHECK (risk_score IN ('LOW', 'MEDIUM', 'HIGH')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: public.ai_actions (AI Safe Guardrails confirmations)
CREATE TABLE IF NOT EXISTS public.ai_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    title TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    workflow_id UUID REFERENCES public.action_workflows(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Table: public.workflow_steps
CREATE TABLE IF NOT EXISTS public.workflow_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES public.action_workflows(id) ON DELETE CASCADE,
    action_id UUID NOT NULL REFERENCES public.ai_actions(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL
);

-- Table: public.price_adjustment_workflows
CREATE TABLE IF NOT EXISTS public.price_adjustment_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    target_margin_percent NUMERIC,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: public.price_adjustment_details
CREATE TABLE IF NOT EXISTS public.price_adjustment_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES public.price_adjustment_workflows(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    target_price NUMERIC NOT NULL
);

-- Table: public.alerts
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    alert_rule_id UUID,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    body TEXT,
    severity TEXT NOT NULL DEFAULT 'info',
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: public.audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    actor_id UUID,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    description TEXT,
    old_data JSONB,
    new_data JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meli_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_adjustment_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_adjustment_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function with STABLE volatility to cache auth tenant_id per query statement
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = (SELECT auth.uid()) LIMIT 1;
$$;

DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
CREATE POLICY "tenants_select" ON public.tenants FOR SELECT
  USING ( id = public.get_auth_tenant_id() );

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING ( id = (SELECT auth.uid()) );

DROP POLICY IF EXISTS "profiles_all" ON public.profiles;
CREATE POLICY "profiles_all" ON public.profiles FOR ALL
  USING ( id = (SELECT auth.uid()) );

-- Standard Select policy pattern for all tenant tables
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


-- =====================================================================
-- 10. INDEXES FOR PERFORMANCE
-- =====================================================================

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


-- =====================================================================
-- 11. INITIAL SEED DATA
-- =====================================================================

INSERT INTO public.plans_config (plan_key, display_name, ai_credits_limit, automation_limit, whatsapp_limit, sku_limit)
VALUES 
  ('starter', 'Plan Starter', 500, 250, 300, 100),
  ('pro', 'Plan Pro', 1500, 800, 1500, 400),
  ('ultra', 'Plan Ultra', 5000, 1500, 5000, 1000)
ON CONFLICT (plan_key) DO NOTHING;

