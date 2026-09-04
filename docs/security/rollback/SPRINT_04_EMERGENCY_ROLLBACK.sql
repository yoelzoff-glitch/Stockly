-- =====================================================================
-- SPRINT 4 EMERGENCY ROLLBACK SCRIPT
-- Objective: Rollback webhook_events table and associated objects
-- Note: This script MUST NOT reside in supabase/migrations/
-- =====================================================================

BEGIN;

DROP TABLE IF EXISTS public.webhook_events CASCADE;

COMMIT;
