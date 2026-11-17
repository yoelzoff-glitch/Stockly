-- Optional sales VAT estimate. Tenant-scoped; only owners/admins configure it.
CREATE TABLE public.sales_vat_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  rate numeric(5,2) NOT NULL DEFAULT 21 CHECK (rate IN (0, 2.5, 5, 10.5, 21, 27))
);
ALTER TABLE public.sales_vat_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.sales_vat_settings TO authenticated;
GRANT ALL ON public.sales_vat_settings TO service_role;
CREATE POLICY sales_vat_read ON public.sales_vat_settings FOR SELECT TO authenticated
  USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
CREATE POLICY sales_vat_insert ON public.sales_vat_settings FOR INSERT TO authenticated
  WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
    AND private.has_tenant_role(ARRAY['owner', 'admin']));
CREATE POLICY sales_vat_update ON public.sales_vat_settings FOR UPDATE TO authenticated
  USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
    AND private.has_tenant_role(ARRAY['owner', 'admin']))
  WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
    AND private.has_tenant_role(ARRAY['owner', 'admin']));
