CREATE TABLE public.vat_reconciliations (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^(20[0-9]{2}|[3-9][0-9]{3})-(0[1-9]|1[0-2])$'),
  "values" jsonb NOT NULL CHECK (jsonb_typeof("values") = 'object' AND "values" ? 'month' AND "values"->>'month' = month),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  PRIMARY KEY (tenant_id, month)
);
ALTER TABLE public.vat_reconciliations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.vat_reconciliations TO authenticated;
GRANT ALL ON public.vat_reconciliations TO service_role;
CREATE POLICY vat_reconciliations_read ON public.vat_reconciliations FOR SELECT TO authenticated
  USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
CREATE POLICY vat_reconciliations_insert ON public.vat_reconciliations FOR INSERT TO authenticated
  WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
    AND private.has_tenant_role(ARRAY['owner', 'admin']) AND updated_by = auth.uid());
CREATE POLICY vat_reconciliations_update ON public.vat_reconciliations FOR UPDATE TO authenticated
  USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
    AND private.has_tenant_role(ARRAY['owner', 'admin']))
  WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
    AND private.has_tenant_role(ARRAY['owner', 'admin']) AND updated_by = auth.uid());
