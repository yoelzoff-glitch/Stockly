-- SPRINT 11: PRIVATE DEMO TENANT IDENTIFICATION & ISOLATION
-- Flags demonstration tenants and adds strict label constraints.

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS demo_label text;

DO $$ BEGIN
  ALTER TABLE public.tenants
  ADD CONSTRAINT chk_tenants_demo_label
  CHECK (
    is_demo = false
    OR demo_label IS NOT NULL
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Index for fast lookup and exclusion filters in periodic background dispatchers
CREATE INDEX IF NOT EXISTS idx_tenants_is_demo ON public.tenants (is_demo) WHERE is_demo = true;

-- Enforce column-level security: 'authenticated' can NEVER update is_demo or demo_label
REVOKE UPDATE (is_demo, demo_label) ON public.tenants FROM authenticated, anon;
