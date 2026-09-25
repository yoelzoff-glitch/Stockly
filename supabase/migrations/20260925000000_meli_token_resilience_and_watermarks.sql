-- =====================================================================
-- SPRINT URGENT: MELI TOKEN RESILIENCE, STRUCTURED RETRY & WATERMARKS
-- Migration: 20260925000000_meli_token_resilience_and_watermarks.sql
-- Description: Adds optimistic locking (token_version), structured retry
--              telemetry to meli_accounts, and monotonic watermark function.
-- Safe: Additive only, IF NOT EXISTS, RLS preserved, search_path strictly empty.
-- =====================================================================

-- 1. STRUCTURED RETRY & OPTIMISTIC CONCURRENCY COLUMNS ON meli_accounts
ALTER TABLE public.meli_accounts
ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_retry_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_failure_reason text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_failure_category text DEFAULT NULL;

-- 2. BACKFILL LEGACY STATES (MIGRATE REGEX TO STRUCTURED)
UPDATE public.meli_accounts
SET last_failure_category = 'rate_limit',
    last_failure_reason = sync_error
WHERE sync_error ILIKE '%429%' 
   OR sync_error ILIKE '%local_rate_limited%'
   OR sync_error ILIKE '%limitando temporalmente%';

-- 3. INDEX FOR FAST AUTOMATIC CRON RECOVERY OF ACTIVE OR RETRYABLE ACCOUNTS
CREATE INDEX IF NOT EXISTS idx_meli_accounts_recovery_check
ON public.meli_accounts (status, next_retry_at)
WHERE refresh_token IS NOT NULL;

-- 4. ATOMIC MONOTONIC WATERMARK ADVANCEMENT FUNCTION
CREATE OR REPLACE FUNCTION public.advance_meli_sync_watermark(
  p_tenant_id uuid,
  p_resource_type text,
  p_new_watermark timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_watermark timestamptz;
  v_advanced boolean := false;
BEGIN
  IF p_tenant_id IS NULL OR p_resource_type IS NULL OR p_new_watermark IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_parameters');
  END IF;

  SELECT last_successful_sync_at INTO v_current_watermark
  FROM public.meli_sync_state
  WHERE tenant_id = p_tenant_id AND resource_type = btrim(p_resource_type)
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.meli_sync_state (
      tenant_id, resource_type, last_successful_sync_at, updated_at
    )
    VALUES (
      p_tenant_id, btrim(p_resource_type), p_new_watermark, now()
    );
    v_advanced := true;
  ELSIF v_current_watermark IS NULL OR p_new_watermark >= v_current_watermark THEN
    UPDATE public.meli_sync_state
    SET last_successful_sync_at = p_new_watermark,
        updated_at = now()
    WHERE tenant_id = p_tenant_id AND resource_type = btrim(p_resource_type);
    v_advanced := true;
  ELSE
    -- An older or delayed execution finished after a newer execution: DO NOT roll back!
    v_advanced := false;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'advanced', v_advanced,
    'watermark', COALESCE(GREATEST(v_current_watermark, p_new_watermark), p_new_watermark)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.advance_meli_sync_watermark(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_meli_sync_watermark(uuid, text, timestamptz) TO service_role;
