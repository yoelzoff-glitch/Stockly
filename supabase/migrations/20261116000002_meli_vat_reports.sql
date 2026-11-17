CREATE TABLE public.meli_vat_reports (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.meli_accounts(id) ON DELETE CASCADE,
  month text NOT NULL,
  summary jsonb NOT NULL,
  fetched_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, account_id, month)
);
ALTER TABLE public.meli_vat_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meli_vat_reports FROM anon, authenticated;
GRANT SELECT ON public.meli_vat_reports TO authenticated;
GRANT ALL ON public.meli_vat_reports TO service_role;
CREATE POLICY meli_vat_reports_read ON public.meli_vat_reports FOR SELECT TO authenticated
  USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
