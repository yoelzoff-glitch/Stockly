-- Create plans_config table to store subscription plan limits dynamically
CREATE TABLE IF NOT EXISTS public.plans_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key TEXT NOT NULL UNIQUE, -- 'starter', 'pro', 'ultra'
  display_name TEXT NOT NULL,
  ai_credits_limit INTEGER NOT NULL DEFAULT 500,
  automation_limit INTEGER NOT NULL DEFAULT 250,
  whatsapp_limit INTEGER NOT NULL DEFAULT 300,
  publications_limit INTEGER NOT NULL DEFAULT 100,
  price_monthly NUMERIC,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the initial plan limits matching the hardcoded defaults
INSERT INTO public.plans_config (plan_key, display_name, ai_credits_limit, automation_limit, whatsapp_limit, publications_limit)
VALUES 
  ('starter', 'Plan Starter', 500, 250, 300, 100),
  ('pro', 'Plan Pro', 1500, 800, 1500, 400),
  ('ultra', 'Plan Ultra', 5000, 1500, 5000, 1000)
ON CONFLICT (plan_key) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.plans_config ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Anyone can read plans_config" ON public.plans_config FOR SELECT USING (true);
