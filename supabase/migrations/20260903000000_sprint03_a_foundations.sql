-- SPRINT 3 — MIGRACIÓN A: FUNDACIONES Y MODELO CENTRAL DE AUTORIZACIÓN SQL
-- PREFLIGHT:
-- 1. Verifica la existencia de public.profiles y public.tenants.
-- 2. Crea el schema privado seguro 'private' no expuesto a la API REST pública de PostgREST.

CREATE SCHEMA IF NOT EXISTS private;

-- Revoke public access to private schema
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- 1. Helper function: current_tenant_id()
-- Extrae de forma segura y determinista el tenant_id del usuario autenticado (auth.uid())
CREATE OR REPLACE FUNCTION private.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

-- 2. Helper function: current_tenant_role()
-- Extrae el rol del usuario autenticado en su tenant
CREATE OR REPLACE FUNCTION private.current_tenant_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

-- 3. Helper function: current_profile_is_active()
-- Verifica si el perfil del usuario autenticado se encuentra activo
CREATE OR REPLACE FUNCTION private.current_profile_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT is_active FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

-- 4. Helper function: belongs_to_tenant(t_id uuid)
-- Valida si el UUID de tenant provisto coincide exactamente con el tenant activo del usuario
CREATE OR REPLACE FUNCTION private.belongs_to_tenant(t_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT (t_id IS NOT NULL AND t_id = private.current_tenant_id());
$$;

-- 5. Helper function: has_tenant_role(roles text[])
-- Valida si el usuario activo posee uno de los roles permitidos en la lista
CREATE OR REPLACE FUNCTION private.has_tenant_role(roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT (private.current_tenant_role() = ANY(roles));
$$;

-- Permisos de ejecución mínimos necesarios
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated, service_role;

-- POST-CHECK:
-- SELECT private.current_tenant_id();
