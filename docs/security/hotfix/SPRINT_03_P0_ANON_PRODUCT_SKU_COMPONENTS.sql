-- SPRINT 3 P0 HOTFIX
-- Objetivo: cerrar la política que permite a anon operar sobre
-- public.product_sku_components porque auth.uid() IS NULL es verdadero para anon.
--
-- Ejecutar de forma independiente antes del rollout completo de Sprint 3.
-- No modifica datos ni afecta a service_role (service_role omite RLS).

BEGIN;

DROP POLICY IF EXISTS
  "Solo los servicios de sistema pueden insertar/actualizar/borrar"
  ON public.product_sku_components;

REVOKE ALL PRIVILEGES
  ON TABLE public.product_sku_components
  FROM anon;

COMMIT;

-- Verificación posterior: ambas consultas deben devolver cero filas.
SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'product_sku_components'
  AND policyname = 'Solo los servicios de sistema pueden insertar/actualizar/borrar';

SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'product_sku_components'
  AND grantee = 'anon';
