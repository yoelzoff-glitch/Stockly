-- Migration: Add usd_exchange_rate to tenants
BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS usd_exchange_rate NUMERIC DEFAULT 1500;

UPDATE public.tenants
SET usd_exchange_rate = COALESCE((metadata->>'usd_exchange_rate')::numeric, 1500)
WHERE usd_exchange_rate IS NULL;

COMMIT;
