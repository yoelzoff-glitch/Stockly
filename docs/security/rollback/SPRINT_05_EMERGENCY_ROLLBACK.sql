-- =====================================================================
-- SPRINT 5: EMERGENCY ROLLBACK SCRIPT
-- File: docs/security/rollback/SPRINT_05_EMERGENCY_ROLLBACK.sql
-- WARNING: This script reverts all Sprint 5 database modifications.
-- =====================================================================

BEGIN;

-- 1. Drop atomic quota consumption RPC function
DROP FUNCTION IF EXISTS public.consume_tenant_quota(uuid, text, integer, text, text, text);

-- 2. Drop usage_events table and associated indices
DROP TABLE IF EXISTS public.usage_events CASCADE;

COMMIT;
