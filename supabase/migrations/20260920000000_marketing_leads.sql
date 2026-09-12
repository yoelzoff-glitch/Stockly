-- ==============================================================================
-- SPRINT: MARKETING LEADS & MEETING REQUESTS
-- Migration: 20260920000000_marketing_leads.sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,
  company text,
  intent text NOT NULL CHECK (intent IN ('meeting', 'contact')),
  source text NOT NULL DEFAULT 'landing_popup',
  page_path text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for performance and sorting
CREATE INDEX IF NOT EXISTS idx_marketing_leads_created_at ON public.marketing_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_intent ON public.marketing_leads (intent);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_email ON public.marketing_leads (email);

-- Enable Row Level Security (RLS)
ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

-- Platform Admin access policy for Super Admin review
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'marketing_leads' AND policyname = 'Platform admins can read marketing leads'
  ) THEN
    CREATE POLICY "Platform admins can read marketing leads"
      ON public.marketing_leads
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.platform_admins pa
          WHERE pa.user_id = auth.uid() AND pa.is_active = true
        )
      );
  END IF;
END $$;
