-- =====================================================================
-- SPRINT 4: WEBHOOK EVENTS, ATOMIC IDEMPOTENCY & DLQ REGISTRY
-- Migration: 20260904000000_sprint04_webhook_events.sql
-- =====================================================================

BEGIN;

-- 1. Create table for persistent webhook events
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL, -- 'mercadolibre' | 'mercadopago' | 'whatsapp'
  event_key text NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  topic text NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (
    status IN ('received', 'queued', 'processing', 'completed', 'retrying', 'dead_letter', 'ignored')
  ),
  attempts integer NOT NULL DEFAULT 0,
  payload_hash text NOT NULL,
  correlation_id text,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  last_error_code text,
  last_error_message text,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT webhook_events_provider_event_key_key UNIQUE (provider, event_key)
);

-- 2. Performance & Idempotency Indices
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_key
  ON public.webhook_events (provider, event_key);

CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant_status
  ON public.webhook_events (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status_received
  ON public.webhook_events (status, received_at);

-- 3. Enable RLS (Strict Backend-Only Isolation)
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events FORCE ROW LEVEL SECURITY;

-- 4. Revoke all permissions from public/anon/authenticated (Backend/service_role exclusive)
REVOKE ALL PRIVILEGES ON TABLE public.webhook_events FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.webhook_events FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.webhook_events FROM authenticated;

COMMIT;
