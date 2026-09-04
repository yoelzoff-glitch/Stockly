-- SPRINT 3.5: CANONICAL PRODUCTION SCHEMA FIXTURE FOR TESTING
-- Exact 1:1 match with production database schema definition.

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS public;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER ROLE service_role WITH BYPASSRLS;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Mock custom types to match production exactly
DO $$ BEGIN
  CREATE TYPE public.tenant_plan AS ENUM ('free', 'starter', 'pro', 'ultra');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.tenant_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('owner', 'admin', 'user', 'guest');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.integration_status AS ENUM ('connected', 'disconnected', 'error', 'pending');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.message_channel AS ENUM ('whatsapp', 'web', 'email');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_action_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 1. Mock auth.users & auth.uid() function
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- 2. 40 Canonical Production Tables
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan public.tenant_plan NOT NULL DEFAULT 'free'::public.tenant_plan,
  status public.tenant_status NOT NULL DEFAULT 'trialing'::public.tenant_status,
  timezone text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires'::text,
  currency text NOT NULL DEFAULT 'ARS'::text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tenants_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  tenant_id uuid,
  full_name text,
  email text,
  role public.user_role NOT NULL DEFAULT 'owner'::public.user_role,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE IF NOT EXISTS public.meli_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  meli_user_id text NOT NULL,
  nickname text,
  site_id text DEFAULT 'MLA'::text,
  access_token text,
  refresh_token text,
  token_expires_at timestamp with time zone,
  status public.integration_status NOT NULL DEFAULT 'connected'::public.integration_status,
  last_sync_at timestamp with time zone,
  sync_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_success_refresh timestamp with time zone,
  CONSTRAINT meli_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT meli_accounts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  meli_account_id uuid,
  meli_item_id text NOT NULL,
  title text NOT NULL,
  sku text,
  permalink text,
  thumbnail_url text,
  status text,
  listing_type_id text,
  category_id text,
  price numeric NOT NULL DEFAULT 0,
  base_price numeric,
  original_price numeric,
  available_quantity integer NOT NULL DEFAULT 0,
  sold_quantity integer NOT NULL DEFAULT 0,
  cost numeric,
  estimated_fee numeric,
  estimated_shipping_cost numeric,
  estimated_tax numeric,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  profitability_status text DEFAULT 'unknown'::text,
  profit_last_calculated_at timestamp with time zone,
  profit_raw_data jsonb DEFAULT '{}'::jsonb,
  margin_amount numeric,
  margin_percent numeric,
  campaign_data jsonb DEFAULT '{}'::jsonb,
  promotion_data jsonb DEFAULT '{}'::jsonb,
  extra_fee_amount numeric DEFAULT 0,
  promotion_discount_amount numeric DEFAULT 0,
  promotion_discount_percent numeric DEFAULT 0,
  profit_adjustments jsonb DEFAULT '{}'::jsonb,
  profit_real_estimated numeric,
  profit_real_margin numeric,
  last_seen_at timestamp with time zone DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT products_meli_account_id_fkey FOREIGN KEY (meli_account_id) REFERENCES public.meli_accounts(id)
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  meli_account_id uuid,
  meli_order_id text NOT NULL,
  status text,
  buyer_nickname text,
  buyer_id text,
  total_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric,
  currency_id text DEFAULT 'ARS'::text,
  date_created timestamp with time zone,
  date_closed timestamp with time zone,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  meli_shipment_id text,
  last_seen_at timestamp with time zone DEFAULT now(),
  internal_stock_processed boolean DEFAULT false,
  internal_stock_processed_at timestamp with time zone,
  internal_stock_reverted boolean DEFAULT false,
  internal_stock_reverted_at timestamp with time zone,
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT orders_meli_account_id_fkey FOREIGN KEY (meli_account_id) REFERENCES public.meli_accounts(id)
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL,
  product_id uuid,
  meli_item_id text,
  title text NOT NULL,
  sku text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric
    GENERATED ALWAYS AS (((quantity)::numeric * unit_price)) STORED,
  unit_cost numeric,
  estimated_fee numeric,
  estimated_shipping_cost numeric,
  estimated_tax numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_numbers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE,
  phone_number text NOT NULL,
  provider text NOT NULL DEFAULT 'meta'::text,
  provider_phone_id text,
  access_token text,
  status public.integration_status NOT NULL DEFAULT 'connected'::public.integration_status,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_numbers_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_numbers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  channel public.message_channel NOT NULL DEFAULT 'whatsapp'::public.message_channel,
  direction text NOT NULL,
  from_phone text,
  to_phone text,
  text text,
  audio_url text,
  transcription text,
  intent text,
  confidence numeric,
  ai_response text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  product_id uuid,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT messages_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

CREATE TABLE IF NOT EXISTS public.ai_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  message_id uuid,
  action_type text NOT NULL,
  status public.ai_action_status NOT NULL DEFAULT 'pending'::public.ai_action_status,
  title text NOT NULL,
  description text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  requested_by uuid,
  confirmed_by uuid,
  confirmed_at timestamp with time zone,
  executed_at timestamp with time zone,
  failed_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_actions_pkey PRIMARY KEY (id),
  CONSTRAINT ai_actions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT ai_actions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id),
  CONSTRAINT ai_actions_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id),
  CONSTRAINT ai_actions_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.product_price_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL,
  old_price numeric,
  new_price numeric NOT NULL,
  changed_by uuid,
  source text NOT NULL DEFAULT 'manual'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_price_history_pkey PRIMARY KEY (id),
  CONSTRAINT product_price_history_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT product_price_history_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT product_price_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL,
  movement_type text NOT NULL,
  quantity_delta integer NOT NULL,
  previous_quantity integer,
  new_quantity integer,
  reason text,
  source text NOT NULL DEFAULT 'manual'::text,
  changed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stock_movements_pkey PRIMARY KEY (id),
  CONSTRAINT stock_movements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT stock_movements_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.alert_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  rule_type text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT alert_rules_pkey PRIMARY KEY (id),
  CONSTRAINT alert_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  alert_rule_id uuid,
  product_id uuid,
  title text NOT NULL,
  body text,
  severity text NOT NULL DEFAULT 'info'::text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT alerts_pkey PRIMARY KEY (id),
  CONSTRAINT alerts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT alerts_alert_rule_id_fkey FOREIGN KEY (alert_rule_id) REFERENCES public.alert_rules(id),
  CONSTRAINT alerts_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid,
  actor_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  description text,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.tenant_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE,
  minimum_margin numeric DEFAULT 15.0,
  never_pause_products boolean DEFAULT false,
  auto_respond_questions boolean DEFAULT false,
  preferred_price_strategy text DEFAULT 'match_competitor'::text,
  automation_rules jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tenant_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT tenant_preferences_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE IF NOT EXISTS public.tenant_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  step text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  CONSTRAINT tenant_progress_pkey PRIMARY KEY (id),
  CONSTRAINT tenant_progress_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE IF NOT EXISTS public.shipments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL,
  meli_shipment_id text,
  status text,
  substatus text,
  logistic_type text,
  mode text,
  tracking_number text,
  tracking_method text,
  shipping_cost numeric DEFAULT 0,
  receiver_city text,
  receiver_state text,
  date_created timestamp with time zone,
  last_updated timestamp with time zone,
  raw_data jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT shipments_pkey PRIMARY KEY (id),
  CONSTRAINT shipments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT shipments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);

CREATE TABLE IF NOT EXISTS public.order_cancellations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL,
  meli_order_id text,
  reason text,
  cancelled_by text,
  refund_amount numeric DEFAULT 0,
  date_cancelled timestamp with time zone,
  raw_data jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT order_cancellations_pkey PRIMARY KEY (id),
  CONSTRAINT order_cancellations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT order_cancellations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);

CREATE TABLE IF NOT EXISTS public.product_sku_components (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL,
  component_sku text NOT NULL,
  component_normalized text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_sku_components_pkey PRIMARY KEY (id),
  CONSTRAINT product_sku_components_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT product_sku_components_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  meli_promotion_id text,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text,
  title text,
  description text,
  discount_type text,
  discount_value numeric,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  target_audience text,
  raw_payload jsonb DEFAULT '{}'::jsonb,
  raw_response jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT promotions_pkey PRIMARY KEY (id),
  CONSTRAINT promotions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE IF NOT EXISTS public.promotion_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  promotion_id uuid NOT NULL,
  product_id uuid NOT NULL,
  meli_item_id text,
  current_price numeric,
  discount_price numeric,
  discount_percent numeric,
  expected_margin numeric,
  status text DEFAULT 'pending'::text,
  raw_response jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT promotion_items_pkey PRIMARY KEY (id),
  CONSTRAINT promotion_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT promotion_items_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id),
  CONSTRAINT promotion_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  meli_coupon_id text,
  title text,
  code text,
  coupon_type text,
  discount_type text,
  discount_value numeric,
  min_purchase_amount numeric,
  max_uses integer,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  target_audience text,
  status text DEFAULT 'draft'::text,
  raw_payload jsonb DEFAULT '{}'::jsonb,
  raw_response jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coupons_pkey PRIMARY KEY (id),
  CONSTRAINT coupons_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE IF NOT EXISTS public.conversation_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid,
  channel text NOT NULL DEFAULT 'web'::text,
  phone_number text,
  status text NOT NULL DEFAULT 'active'::text,
  current_workflow_id uuid,
  current_action_id uuid,
  current_action_type text,
  missing_fields jsonb DEFAULT '[]'::jsonb,
  context jsonb DEFAULT '{}'::jsonb,
  last_activity_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT conversation_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT conversation_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT conversation_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.subscription_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  month date NOT NULL,
  ai_credits_used integer DEFAULT 0,
  whatsapp_messages_used integer DEFAULT 0,
  automation_actions_used integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT subscription_usage_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_usage_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  sku text NOT NULL,
  sku_normalized text NOT NULL,
  name text,
  category text,
  unit_cost numeric,
  average_cost numeric,
  last_purchase_cost numeric,
  current_stock integer NOT NULL DEFAULT 0,
  minimum_stock integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT inventory_items_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  supplier_name text,
  purchase_date timestamp with time zone DEFAULT now(),
  total_amount numeric,
  extra_costs numeric DEFAULT 0,
  status text DEFAULT 'completed'::text,
  source text DEFAULT 'ai'::text,
  raw_input text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT purchase_orders_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  purchase_order_id uuid NOT NULL,
  inventory_item_id uuid,
  sku text NOT NULL,
  sku_normalized text NOT NULL,
  quantity integer NOT NULL,
  unit_cost numeric,
  total_cost numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_order_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id),
  CONSTRAINT purchase_order_items_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id)
);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  inventory_item_id uuid,
  movement_type text NOT NULL,
  quantity_delta integer NOT NULL,
  previous_stock integer,
  new_stock integer,
  unit_cost numeric,
  total_cost numeric,
  source text,
  reference_id uuid,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT inventory_movements_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_movements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT inventory_movements_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id)
);

CREATE TABLE IF NOT EXISTS public.product_components (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL,
  inventory_item_id uuid,
  component_sku text NOT NULL,
  component_normalized text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_cost numeric,
  total_component_cost numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT product_components_pkey PRIMARY KEY (id),
  CONSTRAINT product_components_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT product_components_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT product_components_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id)
);

CREATE TABLE IF NOT EXISTS public.product_extra_costs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  product_id uuid,
  name text NOT NULL,
  amount numeric NOT NULL,
  cost_type text NOT NULL DEFAULT 'fixed'::text,
  applies_to text NOT NULL DEFAULT 'product'::text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT product_extra_costs_pkey PRIMARY KEY (id),
  CONSTRAINT product_extra_costs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT product_extra_costs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE,
  plan text NOT NULL,
  status text NOT NULL DEFAULT 'active'::text,
  mercadopago_subscription_id text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  pending_plan text,
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE IF NOT EXISTS public.monthly_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name character varying NOT NULL,
  type text NOT NULL,
  amount numeric DEFAULT 0.00,
  percentage numeric DEFAULT 0.00,
  target_month date,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  start_month date DEFAULT date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone),
  end_month date,
  is_daily boolean DEFAULT false,
  has_iva boolean DEFAULT false,
  CONSTRAINT monthly_expenses_pkey PRIMARY KEY (id),
  CONSTRAINT monthly_expenses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE IF NOT EXISTS public.plans_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  ai_credits_limit integer NOT NULL DEFAULT 500,
  automation_limit integer NOT NULL DEFAULT 250,
  whatsapp_limit integer NOT NULL DEFAULT 300,
  sku_limit integer NOT NULL DEFAULT 100,
  price_monthly numeric,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT plans_config_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.competition_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL,
  query text NOT NULL,
  own_price numeric NOT NULL,
  avg_price numeric,
  min_price numeric,
  max_price numeric,
  median_price numeric,
  competitors_count integer DEFAULT 0,
  free_shipping_count integer DEFAULT 0,
  raw_results jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT competition_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT competition_snapshots_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT competition_snapshots_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

CREATE TABLE IF NOT EXISTS public.action_workflows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  title text NOT NULL,
  summary text,
  risk_score text NOT NULL CHECK (risk_score = ANY (ARRAY['LOW'::text, 'MEDIUM'::text, 'HIGH'::text])),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'executing'::text, 'completed'::text, 'failed'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT action_workflows_pkey PRIMARY KEY (id),
  CONSTRAINT action_workflows_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE IF NOT EXISTS public.workflow_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL,
  action_id uuid NOT NULL,
  step_order integer NOT NULL,
  CONSTRAINT workflow_steps_pkey PRIMARY KEY (id),
  CONSTRAINT workflow_steps_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.action_workflows(id),
  CONSTRAINT workflow_steps_action_id_fkey FOREIGN KEY (action_id) REFERENCES public.ai_actions(id)
);

CREATE TABLE IF NOT EXISTS public.price_adjustment_workflows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  target_margin_percent numeric,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT price_adjustment_workflows_pkey PRIMARY KEY (id),
  CONSTRAINT price_adjustment_workflows_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE IF NOT EXISTS public.price_adjustment_details (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL,
  product_id uuid NOT NULL,
  target_price numeric NOT NULL,
  CONSTRAINT price_adjustment_details_pkey PRIMARY KEY (id),
  CONSTRAINT price_adjustment_details_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.price_adjustment_workflows(id),
  CONSTRAINT price_adjustment_details_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

CREATE TABLE IF NOT EXISTS public.tenant_feature_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  flag_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tenant_feature_flags_pkey PRIMARY KEY (id),
  CONSTRAINT tenant_feature_flags_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE IF NOT EXISTS public.operation_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid,
  operation_type text NOT NULL,
  source text NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['started'::text, 'completed'::text, 'partial'::text, 'failed'::text, 'skipped'::text])),
  correlation_id text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone,
  duration_ms integer,
  items_processed integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  error_code text,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT operation_runs_pkey PRIMARY KEY (id),
  CONSTRAINT operation_runs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_key text NOT NULL,
  tenant_id uuid,
  topic text NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (
    status = ANY (ARRAY['received'::text, 'queued'::text, 'processing'::text, 'completed'::text, 'retrying'::text, 'dead_letter'::text, 'ignored'::text])
  ),
  attempts integer NOT NULL DEFAULT 0,
  payload_hash text NOT NULL,
  correlation_id text,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  last_error_code text,
  last_error_message text,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT webhook_events_pkey PRIMARY KEY (id),
  CONSTRAINT webhook_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT webhook_events_provider_event_key_key UNIQUE (provider, event_key)
);

