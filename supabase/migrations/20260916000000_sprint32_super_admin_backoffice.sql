-- ==============================================================================
-- SPRINT 32: BACKOFFICE SUPER ADMIN DE LIBRETAX
-- Migration: 20260916000000_sprint32_super_admin_backoffice.sql
-- ==============================================================================

-- 1. PLATFORM ADMINS TABLE (Independent Global Platform Authorization)
CREATE TABLE IF NOT EXISTS public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'support', 'finance')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT platform_admins_user_role_key UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_platform_admins_user_id ON public.platform_admins (user_id);
CREATE INDEX IF NOT EXISTS idx_platform_admins_role_active ON public.platform_admins (role, is_active);

-- 2. PLANS TABLE
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  price_monthly numeric NOT NULL DEFAULT 0,
  price_yearly numeric NOT NULL DEFAULT 0,
  max_users integer NOT NULL DEFAULT 1,
  max_ml_accounts integer NOT NULL DEFAULT 1,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plans_code ON public.plans (code);
CREATE INDEX IF NOT EXISTS idx_plans_active_public ON public.plans (is_active, is_public);

-- 3. ENHANCE SUBSCRIPTIONS TABLE
ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS started_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS trial_started_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS current_period_start timestamp with time zone,
  ADD COLUMN IF NOT EXISTS current_period_end timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS ended_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS billing_interval text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS monthly_price_snapshot numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancellation_comment text;

-- Drop strict unique tenant_id constraint if present to allow historical subscriptions,
-- replacing with partial unique index ensuring max 1 active/trialing/past_due per tenant.
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tenant_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_active_per_tenant 
  ON public.subscriptions (tenant_id) 
  WHERE status IN ('trialing', 'active', 'past_due');

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON public.subscriptions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_current_period_end ON public.subscriptions (current_period_end);

-- 4. SUBSCRIPTION EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_tenant_sub_date 
  ON public.subscription_events (tenant_id, subscription_id, created_at DESC);

-- 5. BILLING TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.billing_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('payment', 'refund', 'adjustment')),
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'failed', 'refunded')),
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'ARS',
  provider text,
  provider_payment_id text,
  period_start timestamp with time zone,
  period_end timestamp with time zone,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_transactions_tenant_id ON public.billing_transactions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_status ON public.billing_transactions (status);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_paid_at ON public.billing_transactions (paid_at DESC);

-- 6. PLATFORM ACTIVITY EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.platform_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_activity_events_tenant_date 
  ON public.platform_activity_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_activity_events_event_name 
  ON public.platform_activity_events (event_name);

-- 7. PLATFORM ADMIN AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.platform_admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  target_subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_admin_audit_log_actor_date 
  ON public.platform_admin_audit_log (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_admin_audit_log_tenant 
  ON public.platform_admin_audit_log (target_tenant_id);

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Plans: anyone authenticated can read public active plans
DROP POLICY IF EXISTS "Anyone authenticated can read public plans" ON public.plans;
CREATE POLICY "Anyone authenticated can read public plans"
  ON public.plans
  FOR SELECT
  TO authenticated
  USING (is_active = true AND is_public = true);

-- Tenant Isolation Policies for tenant-owned tables
DROP POLICY IF EXISTS "Users can read own tenant subscription events" ON public.subscription_events;
CREATE POLICY "Users can read own tenant subscription events"
  ON public.subscription_events
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can read own tenant billing transactions" ON public.billing_transactions;
CREATE POLICY "Users can read own tenant billing transactions"
  ON public.billing_transactions
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can read own tenant platform activity" ON public.platform_activity_events;
CREATE POLICY "Users can read own tenant platform activity"
  ON public.platform_activity_events
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Strict revocation: platform_admins and platform_admin_audit_log cannot be read or modified by normal users
REVOKE ALL ON public.platform_admins FROM anon, authenticated;
REVOKE ALL ON public.platform_admin_audit_log FROM anon, authenticated;

-- Service role retains full access
GRANT ALL ON public.platform_admins TO service_role;
GRANT ALL ON public.plans TO service_role, authenticated;
GRANT ALL ON public.subscriptions TO service_role;
GRANT ALL ON public.subscription_events TO service_role;
GRANT ALL ON public.billing_transactions TO service_role;
GRANT ALL ON public.platform_activity_events TO service_role;
GRANT ALL ON public.platform_admin_audit_log TO service_role;

-- 9. INITIAL SEED DATA
-- Insert standard LibretaX plans if they don't exist
INSERT INTO public.plans (code, name, description, price_monthly, price_yearly, max_users, max_ml_accounts, features, is_active, is_public)
VALUES
  (
    'starter',
    'Starter',
    'Ideal para vendedores individuales o marcas iniciando en Mercado Libre',
    25000,
    250000,
    1,
    1,
    '{"ai_actions": 100, "sku_limit": 500, "whatsapp_alerts": false, "ads_management": false}'::jsonb,
    true,
    true
  ),
  (
    'pro',
    'Pro',
    'Para marcas y empresas en crecimiento con alto volumen de operaciones',
    45000,
    450000,
    3,
    2,
    '{"ai_actions": 500, "sku_limit": 2500, "whatsapp_alerts": true, "ads_management": true}'::jsonb,
    true,
    true
  ),
  (
    'ultra',
    'Ultra',
    'Potencia total para grandes operadores, equipos grandes y múltiples cuentas',
    90000,
    900000,
    10,
    5,
    '{"ai_actions": 2500, "sku_limit": 10000, "whatsapp_alerts": true, "ads_management": true, "priority_support": true}'::jsonb,
    true,
    true
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_users = EXCLUDED.max_users,
  max_ml_accounts = EXCLUDED.max_ml_accounts,
  features = EXCLUDED.features,
  updated_at = now();

-- Seed initial super_admin for admin@libretax.com.ar
INSERT INTO public.platform_admins (user_id, role, is_active)
SELECT id, 'super_admin', true
FROM auth.users
WHERE email = 'admin@libretax.com.ar'
ON CONFLICT (user_id, role) DO UPDATE SET is_active = true, updated_at = now();

-- Backfill existing subscriptions with plan_id and price snapshot
UPDATE public.subscriptions s
SET 
  plan_id = p.id,
  monthly_price_snapshot = p.price_monthly,
  started_at = COALESCE(s.started_at, s.created_at),
  current_period_start = COALESCE(s.current_period_start, s.created_at),
  current_period_end = COALESCE(s.current_period_end, s.expires_at, s.created_at + interval '30 days')
FROM public.plans p
WHERE (s.plan = p.code OR (s.plan IS NULL AND p.code = 'pro')) AND s.plan_id IS NULL;
