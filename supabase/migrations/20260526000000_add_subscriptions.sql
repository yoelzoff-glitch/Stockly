-- CREATE subscriptions TABLE

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE,
  plan text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  mercadopago_subscription_id text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their tenant's subscription"
  ON public.subscriptions
  FOR SELECT
  USING ( tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()) );
