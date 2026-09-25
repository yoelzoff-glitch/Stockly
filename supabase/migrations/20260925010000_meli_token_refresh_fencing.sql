-- Safe, additive hardening for Mercado Libre token rotation.
-- Deploy this migration before the application code that calls these RPCs.

CREATE OR REPLACE FUNCTION public.check_meli_token_refresh_lease(
  p_tenant_id uuid,
  p_account_id uuid,
  p_operation_type text,
  p_lease_owner text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner text;
  v_expires_at timestamptz;
BEGIN
  IF p_tenant_id IS NULL OR p_account_id IS NULL
     OR p_operation_type IS NULL OR p_lease_owner IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_parameters');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.meli_accounts
    WHERE id = p_account_id AND tenant_id = p_tenant_id
  ) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'account_not_found');
  END IF;

  SELECT lease_owner, expires_at
  INTO v_owner, v_expires_at
  FROM public.operation_leases
  WHERE tenant_id = p_tenant_id
    AND operation_type = btrim(p_operation_type);

  IF NOT FOUND OR v_owner IS DISTINCT FROM p_lease_owner THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'lease_not_owned');
  END IF;

  IF v_expires_at <= clock_timestamp() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'lease_expired');
  END IF;

  RETURN jsonb_build_object('valid', true, 'expires_at', v_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.persist_meli_token_rotation(
  p_tenant_id uuid,
  p_account_id uuid,
  p_operation_type text,
  p_lease_owner text,
  p_expected_version integer,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamptz,
  p_refreshed_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner text;
  v_lease_expires_at timestamptz;
  v_new_version integer;
  v_actual_version integer;
BEGIN
  IF p_tenant_id IS NULL OR p_account_id IS NULL
     OR p_operation_type IS NULL OR p_lease_owner IS NULL
     OR p_expected_version IS NULL OR p_expected_version < 1
     OR p_access_token IS NULL OR length(p_access_token) = 0
     OR p_refresh_token IS NULL OR length(p_refresh_token) = 0
     OR p_expires_at IS NULL OR p_expires_at <= clock_timestamp()
     OR p_refreshed_at IS NULL THEN
    RETURN jsonb_build_object('persisted', false, 'reason', 'invalid_parameters');
  END IF;

  -- Lock the lease row. An expired lease cannot be taken by another worker while
  -- ownership is checked and the account update is committed.
  SELECT lease_owner, expires_at
  INTO v_owner, v_lease_expires_at
  FROM public.operation_leases
  WHERE tenant_id = p_tenant_id
    AND operation_type = btrim(p_operation_type)
  FOR UPDATE;

  IF NOT FOUND OR v_owner IS DISTINCT FROM p_lease_owner THEN
    RETURN jsonb_build_object('persisted', false, 'reason', 'lease_not_owned');
  END IF;

  IF v_lease_expires_at <= clock_timestamp() THEN
    RETURN jsonb_build_object('persisted', false, 'reason', 'lease_expired');
  END IF;

  UPDATE public.meli_accounts
  SET access_token = p_access_token,
      refresh_token = p_refresh_token,
      token_expires_at = p_expires_at,
      token_version = p_expected_version + 1,
      status = 'connected',
      sync_error = NULL,
      retry_count = 0,
      next_retry_at = NULL,
      last_failure_reason = NULL,
      last_failure_category = NULL,
      last_success_refresh = p_refreshed_at,
      updated_at = p_refreshed_at
  WHERE id = p_account_id
    AND tenant_id = p_tenant_id
    AND token_version = p_expected_version
  RETURNING token_version INTO v_new_version;

  IF FOUND THEN
    RETURN jsonb_build_object('persisted', true, 'token_version', v_new_version);
  END IF;

  SELECT token_version INTO v_actual_version
  FROM public.meli_accounts
  WHERE id = p_account_id AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'persisted', false,
    'reason', CASE WHEN v_actual_version IS NULL THEN 'account_not_found' ELSE 'version_conflict' END,
    'actual_version', v_actual_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_meli_token_refresh_lease(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_meli_token_refresh_lease(uuid, uuid, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.persist_meli_token_rotation(uuid, uuid, text, text, integer, text, text, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_meli_token_rotation(uuid, uuid, text, text, integer, text, text, timestamptz, timestamptz)
  TO service_role;

-- Fix the missing-row race and make every path monotonic with a single
-- INSERT ... ON CONFLICT statement. The WHERE clause prevents stale writers.
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
  v_watermark timestamptz;
  v_advanced boolean := false;
BEGIN
  IF p_tenant_id IS NULL OR p_resource_type IS NULL
     OR length(btrim(p_resource_type)) = 0 OR p_new_watermark IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_parameters');
  END IF;

  INSERT INTO public.meli_sync_state (
    tenant_id, resource_type, last_successful_sync_at, updated_at
  )
  VALUES (
    p_tenant_id, btrim(p_resource_type), p_new_watermark, clock_timestamp()
  )
  ON CONFLICT (tenant_id, resource_type) DO UPDATE
  SET last_successful_sync_at = EXCLUDED.last_successful_sync_at,
      updated_at = clock_timestamp()
  WHERE public.meli_sync_state.last_successful_sync_at IS NULL
     OR EXCLUDED.last_successful_sync_at > public.meli_sync_state.last_successful_sync_at
  RETURNING last_successful_sync_at INTO v_watermark;

  IF FOUND THEN
    v_advanced := true;
  ELSE
    SELECT last_successful_sync_at INTO v_watermark
    FROM public.meli_sync_state
    WHERE tenant_id = p_tenant_id
      AND resource_type = btrim(p_resource_type);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'advanced', v_advanced,
    'watermark', v_watermark
  );
END;
$$;

REVOKE ALL ON FUNCTION public.advance_meli_sync_watermark(uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_meli_sync_watermark(uuid, text, timestamptz)
  TO service_role;
