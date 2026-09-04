-- =====================================================================
-- SPRINT 5: BILLING INTEGRITY, ATOMIC QUOTAS & USAGE AUDIT LEDGER
-- Migration: 20260905000000_sprint05_billing_integrity.sql
-- =====================================================================

BEGIN;

-- 1. Create backend-only usage_events audit ledger
CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric text NOT NULL, -- 'ai_credits_used' | 'whatsapp_messages_used' | 'automation_actions_used'
  amount integer NOT NULL DEFAULT 1,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'rejected', 'duplicate')),
  source text,
  correlation_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT usage_events_tenant_metric_idempotency_key UNIQUE (tenant_id, metric, idempotency_key)
);

-- 2. Performance Indices
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_created
  ON public.usage_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_metric
  ON public.usage_events (tenant_id, metric, created_at);

-- Ensure unique constraint on subscription_usage (tenant_id, month)
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_usage_tenant_month
  ON public.subscription_usage (tenant_id, month);

-- 3. Strict Backend-Only RLS Isolation
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events FORCE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.usage_events FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.usage_events FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.usage_events FROM authenticated;

-- 4. Atomic Quota Consumption Function
CREATE OR REPLACE FUNCTION public.consume_tenant_quota(
  p_tenant_id uuid,
  p_metric text,
  p_amount integer DEFAULT 1,
  p_idempotency_key text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_correlation_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_month date;
  v_plan text;
  v_limit integer;
  v_current_usage integer;
  v_new_usage integer;
  v_existing_event record;
  v_cfg record;
BEGIN
  -- Normalize month to first day of current month (UTC)
  v_current_month := date_trunc('month', timezone('utc', now()))::date;

  -- 1. Resolve Active Plan & Limits
  SELECT plan INTO v_plan
  FROM public.subscriptions
  WHERE tenant_id = p_tenant_id;

  IF NOT FOUND OR v_plan IS NULL THEN
    v_plan := 'starter';
  END IF;

  -- Normalize plan alias
  IF v_plan = 'business' THEN v_plan := 'ultra'; END IF;
  IF v_plan = 'free' THEN v_plan := 'starter'; END IF;

  -- Get limits from plans_config
  SELECT * INTO v_cfg
  FROM public.plans_config
  WHERE plan_key = v_plan AND is_active = true;

  IF FOUND THEN
    v_limit := CASE
      WHEN p_metric = 'ai_credits_used' THEN v_cfg.ai_credits_limit
      WHEN p_metric = 'whatsapp_messages_used' THEN v_cfg.whatsapp_limit
      WHEN p_metric = 'automation_actions_used' THEN v_cfg.automation_limit
      ELSE 999999
    END;
  ELSE
    -- Fallback static limits
    v_limit := CASE
      WHEN v_plan = 'ultra' THEN
        CASE WHEN p_metric = 'ai_credits_used' THEN 5000 WHEN p_metric = 'whatsapp_messages_used' THEN 5000 ELSE 1500 END
      WHEN v_plan = 'pro' THEN
        CASE WHEN p_metric = 'ai_credits_used' THEN 1500 WHEN p_metric = 'whatsapp_messages_used' THEN 1500 ELSE 800 END
      ELSE
        CASE WHEN p_metric = 'ai_credits_used' THEN 500 WHEN p_metric = 'whatsapp_messages_used' THEN 300 ELSE 250 END
    END;
  END IF;

  -- 2. Idempotency Check: if idempotency key provided and already recorded, return original outcome
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT * INTO v_existing_event
    FROM public.usage_events
    WHERE tenant_id = p_tenant_id
      AND metric = p_metric
      AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      -- Get current usage without incrementing
      SELECT COALESCE(
        CASE
          WHEN p_metric = 'ai_credits_used' THEN ai_credits_used
          WHEN p_metric = 'whatsapp_messages_used' THEN whatsapp_messages_used
          WHEN p_metric = 'automation_actions_used' THEN automation_actions_used
          ELSE 0
        END, 0
      ) INTO v_current_usage
      FROM public.subscription_usage
      WHERE tenant_id = p_tenant_id AND month = v_current_month;

      v_current_usage := COALESCE(v_current_usage, 0);

      RETURN jsonb_build_object(
        'allowed', (v_existing_event.status = 'applied'),
        'current_usage', v_current_usage,
        'limit', v_limit,
        'remaining', GREATEST(0, v_limit - v_current_usage),
        'duplicate', true
      );
    END IF;
  END IF;

  -- 3. Lock or Initialize Monthly Usage Row
  -- Safe UPSERT ensures the row exists before FOR UPDATE lock
  INSERT INTO public.subscription_usage (tenant_id, month, ai_credits_used, whatsapp_messages_used, automation_actions_used)
  VALUES (p_tenant_id, v_current_month, 0, 0, 0)
  ON CONFLICT (tenant_id, month) DO NOTHING;

  -- Lock row FOR UPDATE to prevent race conditions
  SELECT
    CASE
      WHEN p_metric = 'ai_credits_used' THEN ai_credits_used
      WHEN p_metric = 'whatsapp_messages_used' THEN whatsapp_messages_used
      WHEN p_metric = 'automation_actions_used' THEN automation_actions_used
      ELSE 0
    END INTO v_current_usage
  FROM public.subscription_usage
  WHERE tenant_id = p_tenant_id AND month = v_current_month
  FOR UPDATE;

  v_current_usage := COALESCE(v_current_usage, 0);

  -- 4. Verify Quota Availability
  IF (v_current_usage + p_amount) > v_limit THEN
    -- Log rejected event in audit ledger if idempotency key present
    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
      INSERT INTO public.usage_events (tenant_id, metric, amount, idempotency_key, status, source, correlation_id)
      VALUES (p_tenant_id, p_metric, p_amount, p_idempotency_key, 'rejected', p_source, p_correlation_id)
      ON CONFLICT (tenant_id, metric, idempotency_key) DO NOTHING;
    END IF;

    RETURN jsonb_build_object(
      'allowed', false,
      'current_usage', v_current_usage,
      'limit', v_limit,
      'remaining', GREATEST(0, v_limit - v_current_usage),
      'duplicate', false
    );
  END IF;

  -- 5. Atomic Increment
  v_new_usage := v_current_usage + p_amount;

  IF p_metric = 'ai_credits_used' THEN
    UPDATE public.subscription_usage
    SET ai_credits_used = v_new_usage
    WHERE tenant_id = p_tenant_id AND month = v_current_month;
  ELSIF p_metric = 'whatsapp_messages_used' THEN
    UPDATE public.subscription_usage
    SET whatsapp_messages_used = v_new_usage
    WHERE tenant_id = p_tenant_id AND month = v_current_month;
  ELSIF p_metric = 'automation_actions_used' THEN
    UPDATE public.subscription_usage
    SET automation_actions_used = v_new_usage
    WHERE tenant_id = p_tenant_id AND month = v_current_month;
  END IF;

  -- 6. Record in Audit Ledger
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    INSERT INTO public.usage_events (tenant_id, metric, amount, idempotency_key, status, source, correlation_id)
    VALUES (p_tenant_id, p_metric, p_amount, p_idempotency_key, 'applied', p_source, p_correlation_id)
    ON CONFLICT (tenant_id, metric, idempotency_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'current_usage', v_new_usage,
    'limit', v_limit,
    'remaining', GREATEST(0, v_limit - v_new_usage),
    'duplicate', false
  );
END;
$$;

-- Security Definer Permissions for consume_tenant_quota
REVOKE ALL ON FUNCTION public.consume_tenant_quota(uuid, text, integer, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_tenant_quota(uuid, text, integer, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.consume_tenant_quota(uuid, text, integer, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_tenant_quota(uuid, text, integer, text, text, text) TO service_role;

-- 5. Atomic Tenant Subscription Sync Function
CREATE OR REPLACE FUNCTION public.sync_tenant_subscription(
  p_tenant_id uuid,
  p_plan text,
  p_status text,
  p_mercadopago_subscription_id text DEFAULT NULL,
  p_expires_at timestamp with time zone DEFAULT NULL,
  p_event_timestamp timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_sub record;
  v_tenant record;
  v_effective_expires_at timestamp with time zone;
  v_updated_at timestamp with time zone;
  v_norm_plan text;
BEGIN
  -- 1. Ensure Tenant Exists
  SELECT * INTO v_tenant
  FROM public.tenants
  WHERE id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant % does not exist', p_tenant_id;
  END IF;

  -- Normalize plan alias
  v_norm_plan := p_plan;
  IF v_norm_plan = 'business' THEN v_norm_plan := 'ultra'; END IF;
  IF v_norm_plan = 'free' THEN v_norm_plan := 'starter'; END IF;

  -- 2. Lock & Check Existing Subscription
  SELECT * INTO v_current_sub
  FROM public.subscriptions
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  -- 3. Stale Event Protection: if event timestamp is older than current updated_at, reject out-of-order overwrite
  IF v_current_sub.id IS NOT NULL AND p_event_timestamp IS NOT NULL AND v_current_sub.updated_at IS NOT NULL THEN
    IF p_event_timestamp < v_current_sub.updated_at THEN
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'stale_event',
        'current_plan', v_current_sub.plan,
        'current_status', v_current_sub.status,
        'expires_at', v_current_sub.expires_at,
        'updated_at', v_current_sub.updated_at
      );
    END IF;
  END IF;

  -- 4. Preserve existing expiration if duplicate/same event or if p_expires_at is not extending
  v_effective_expires_at := p_expires_at;
  IF v_current_sub.id IS NOT NULL AND v_current_sub.mercadopago_subscription_id = p_mercadopago_subscription_id AND v_current_sub.plan = v_norm_plan AND v_current_sub.status = p_status THEN
    IF v_current_sub.expires_at IS NOT NULL AND (p_expires_at IS NULL OR p_expires_at = v_current_sub.expires_at) THEN
      v_effective_expires_at := v_current_sub.expires_at;
    END IF;
  END IF;

  v_updated_at := COALESCE(p_event_timestamp, timezone('utc', now()));

  -- 5. Atomic Upsert of subscriptions
  INSERT INTO public.subscriptions (
    tenant_id,
    plan,
    status,
    mercadopago_subscription_id,
    expires_at,
    updated_at
  )
  VALUES (
    p_tenant_id,
    v_norm_plan,
    p_status,
    p_mercadopago_subscription_id,
    v_effective_expires_at,
    v_updated_at
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    plan = EXCLUDED.plan,
    status = EXCLUDED.status,
    mercadopago_subscription_id = EXCLUDED.mercadopago_subscription_id,
    expires_at = EXCLUDED.expires_at,
    updated_at = EXCLUDED.updated_at;

  -- 6. Atomic Update of tenants.plan
  UPDATE public.tenants
  SET plan = v_norm_plan::public.tenant_plan,
      updated_at = timezone('utc', now())
  WHERE id = p_tenant_id;

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'plan', v_norm_plan,
    'status', p_status,
    'mercadopago_subscription_id', p_mercadopago_subscription_id,
    'expires_at', v_effective_expires_at,
    'updated_at', v_updated_at
  );
END;
$$;

-- Security Definer Permissions for sync_tenant_subscription
REVOKE ALL ON FUNCTION public.sync_tenant_subscription(uuid, text, text, text, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_tenant_subscription(uuid, text, text, text, timestamptz, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.sync_tenant_subscription(uuid, text, text, text, timestamptz, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_tenant_subscription(uuid, text, text, text, timestamptz, timestamptz) TO service_role;

COMMIT;
