-- Read-only preflight. Run before the two Vercel background migrations.
-- The dashboard's contextual schema export omits indexes, functions and grants.

-- Before migration: background_jobs and claim_background_job should be absent.
SELECT to_regclass('public.background_jobs') AS existing_background_jobs;
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'claim_background_job';

-- All three standard Supabase roles must exist. service_role normally bypasses RLS.
SELECT rolname, rolbypassrls FROM pg_roles
WHERE rolname IN ('anon', 'authenticated', 'service_role');

-- Existing runtime dependencies: inspect actual signatures and service permissions.
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS arguments,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND (
  p.proname IN ('acquire_operation_lease', 'renew_operation_lease',
    'release_operation_lease', 'persist_meli_shipment')
  OR p.proname LIKE '%meli%token%' OR p.proname LIKE '%watermark%'
)
ORDER BY p.proname;

-- Required unique keys used by existing upsert/idempotency operations:
-- meli_sync_state(tenant_id, resource_type), webhook_events(provider, event_key),
-- operation_leases(tenant_id, operation_type).
SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('meli_sync_state', 'webhook_events', 'operation_leases')
ORDER BY tablename, indexname;
