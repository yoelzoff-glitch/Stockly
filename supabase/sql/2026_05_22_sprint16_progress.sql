CREATE TABLE public.tenant_progress (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  step text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  
  CONSTRAINT tenant_progress_pkey PRIMARY KEY (id),
  CONSTRAINT tenant_progress_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT tenant_progress_tenant_id_step_key UNIQUE (tenant_id, step)
);

-- RLS
ALTER TABLE public.tenant_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view progress for their tenant" 
ON public.tenant_progress FOR SELECT 
USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update progress for their tenant" 
ON public.tenant_progress FOR UPDATE 
USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert progress for their tenant" 
ON public.tenant_progress FOR INSERT 
WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
