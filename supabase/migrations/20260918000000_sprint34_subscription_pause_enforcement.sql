-- ==============================================================================
-- SPRINT 34 MIGRATION: Subscription Pause & Enforcement Infrastructure
-- ==============================================================================

-- 1. Add pause fields to subscriptions
ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS paused_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS pause_reason text,
  ADD COLUMN IF NOT EXISTS paused_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Update operative subscription unique partial index to include 'paused'
DROP INDEX IF EXISTS public.idx_subscriptions_one_active_per_tenant;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_active_per_tenant 
  ON public.subscriptions (tenant_id) 
  WHERE status IN ('trialing', 'active', 'past_due', 'paused');

CREATE INDEX IF NOT EXISTS idx_subscriptions_paused_status 
  ON public.subscriptions (tenant_id, status) 
  WHERE status = 'paused';

-- 3. Atomic RPC: pause_tenant_subscription
CREATE OR REPLACE FUNCTION public.pause_tenant_subscription(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_reason text DEFAULT 'manual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sub record;
  v_now timestamp with time zone := now();
BEGIN
  -- Lock operative subscription deterministically
  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE tenant_id = p_tenant_id
    AND status IN ('active', 'trialing', 'past_due', 'paused')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_sub.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No active or operative subscription found for this tenant.'
    );
  END IF;

  -- Idempotency: if already paused, return success with already_paused flag
  IF v_sub.status = 'paused' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_paused', true,
      'subscription_id', v_sub.id,
      'status', 'paused'
    );
  END IF;

  -- Update subscription to paused
  UPDATE public.subscriptions
  SET
    status = 'paused',
    paused_at = v_now,
    pause_reason = p_reason,
    paused_by = p_actor_user_id,
    updated_at = v_now
  WHERE id = v_sub.id;

  -- Insert subscription_event
  INSERT INTO public.subscription_events (
    tenant_id,
    subscription_id,
    event_type,
    metadata,
    created_at
  ) VALUES (
    p_tenant_id,
    v_sub.id,
    'subscription_paused',
    jsonb_build_object(
      'reason', p_reason,
      'actor_user_id', p_actor_user_id,
      'source', 'super_admin'
    ),
    v_now
  );

  -- Insert platform_admin_audit_log
  INSERT INTO public.platform_admin_audit_log (
    actor_user_id,
    target_tenant_id,
    target_subscription_id,
    action,
    metadata,
    created_at
  ) VALUES (
    p_actor_user_id,
    p_tenant_id,
    v_sub.id,
    'subscription_paused',
    jsonb_build_object(
      'reason', p_reason,
      'previous_status', v_sub.status
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_paused', false,
    'subscription_id', v_sub.id,
    'status', 'paused',
    'paused_at', v_now
  );
END;
$$;

-- 4. Atomic RPC: reactivate_tenant_subscription
CREATE OR REPLACE FUNCTION public.reactivate_tenant_subscription(
  p_tenant_id uuid,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sub record;
  v_now timestamp with time zone := now();
BEGIN
  -- Lock paused subscription
  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE tenant_id = p_tenant_id
    AND status = 'paused'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_sub.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No paused subscription found for this tenant.'
    );
  END IF;

  -- Update subscription to active
  UPDATE public.subscriptions
  SET
    status = 'active',
    paused_at = NULL,
    pause_reason = NULL,
    paused_by = NULL,
    updated_at = v_now
  WHERE id = v_sub.id;

  -- Insert subscription_event
  INSERT INTO public.subscription_events (
    tenant_id,
    subscription_id,
    event_type,
    metadata,
    created_at
  ) VALUES (
    p_tenant_id,
    v_sub.id,
    'subscription_reactivated',
    jsonb_build_object(
      'actor_user_id', p_actor_user_id,
      'source', 'super_admin'
    ),
    v_now
  );

  -- Insert platform_admin_audit_log
  INSERT INTO public.platform_admin_audit_log (
    actor_user_id,
    target_tenant_id,
    target_subscription_id,
    action,
    metadata,
    created_at
  ) VALUES (
    p_actor_user_id,
    p_tenant_id,
    v_sub.id,
    'subscription_reactivated',
    jsonb_build_object(
      'previous_status', 'paused'
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_sub.id,
    'status', 'active'
  );
END;
$$;
