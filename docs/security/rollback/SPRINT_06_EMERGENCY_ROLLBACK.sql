-- =====================================================================
-- SPRINT 6: EMERGENCY ROLLBACK SCRIPT
-- Reverts: 20260906000000_sprint06_scalability.sql
-- =====================================================================

BEGIN;

-- 1. Drop Indexes
DROP INDEX IF EXISTS public.idx_operation_runs_tenant_op_started;
DROP INDEX IF EXISTS public.idx_alerts_tenant_unread_created;
DROP INDEX IF EXISTS public.idx_products_tenant_status_updated;
DROP INDEX IF EXISTS public.idx_stock_movements_tenant_created;
DROP INDEX IF EXISTS public.idx_order_items_tenant_meli_item;
DROP INDEX IF EXISTS public.idx_orders_tenant_status_date_created;
DROP INDEX IF EXISTS public.idx_orders_tenant_date_created;

-- 2. Drop RPC Functions
DROP FUNCTION IF EXISTS public.get_dashboard_aggregates_v2(uuid, integer);
DROP FUNCTION IF EXISTS public.check_rate_limit_bucket(uuid, text, integer, integer, integer);
DROP FUNCTION IF EXISTS public.release_operation_lease(uuid, text, text);
DROP FUNCTION IF EXISTS public.renew_operation_lease(uuid, text, text, integer);
DROP FUNCTION IF EXISTS public.acquire_operation_lease(uuid, text, text, integer);

-- 3. Drop Tables
DROP TABLE IF EXISTS public.rate_limit_buckets CASCADE;
DROP TABLE IF EXISTS public.operation_leases CASCADE;

COMMIT;
