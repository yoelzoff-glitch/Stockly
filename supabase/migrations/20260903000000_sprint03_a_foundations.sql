-- SPRINT 3 — MIGRACIÓN A: FUNDACIONES Y MODELO CENTRAL DE AUTORIZACIÓN SQL
-- PREFLIGHT:
-- 1. Crea el schema privado seguro 'private' no expuesto a PostgREST.
-- 2. Define funciones auxiliares con SET search_path = '' y permisos mínimos individuales.

CREATE SCHEMA IF NOT EXISTS private;

-- Revoke public access to private schema
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- 1. Helper function: current_tenant_id()
CREATE OR REPLACE FUNCTION private.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.tenant_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.is_active = true
  LIMIT 1;
$$;

-- 2. Helper function: current_tenant_role()
CREATE OR REPLACE FUNCTION private.current_tenant_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.is_active = true
  LIMIT 1;
$$;

-- 3. Helper function: current_profile_is_active()
CREATE OR REPLACE FUNCTION private.current_profile_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1),
    false
  );
$$;

-- 4. Helper function: belongs_to_tenant(t_id uuid)
CREATE OR REPLACE FUNCTION private.belongs_to_tenant(t_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (t_id IS NOT NULL AND t_id = private.current_tenant_id());
$$;

-- 5. Helper function: has_tenant_role(roles text[])
CREATE OR REPLACE FUNCTION private.has_tenant_role(roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (private.current_tenant_role() = ANY(roles));
$$;

-- Permisos individuales estrictos por función (sin usar broad ALL FUNCTIONS)
REVOKE EXECUTE ON FUNCTION private.current_tenant_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.current_tenant_id() FROM anon;
GRANT EXECUTE ON FUNCTION private.current_tenant_id() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION private.current_tenant_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.current_tenant_role() FROM anon;
GRANT EXECUTE ON FUNCTION private.current_tenant_role() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION private.current_profile_is_active() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.current_profile_is_active() FROM anon;
GRANT EXECUTE ON FUNCTION private.current_profile_is_active() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION private.belongs_to_tenant(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.belongs_to_tenant(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION private.belongs_to_tenant(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION private.has_tenant_role(text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.has_tenant_role(text[]) FROM anon;
GRANT EXECUTE ON FUNCTION private.has_tenant_role(text[]) TO authenticated, service_role;
