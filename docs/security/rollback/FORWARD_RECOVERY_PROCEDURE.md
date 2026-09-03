# Procedimiento de Forward Recovery — Sprint 3 (RLS y Aislamiento Multi-Tenant)

En entornos de producción donde la base de datos ya haya recibido tráfico con el nuevo modelo o donde revertir tablas cree inconsistencias en datos relacionales, se debe aplicar el protocolo de **Forward Recovery** en lugar de un rollback ciego.

---

## 1. Detección y Diagnóstico de Incidencias

### A. Error de Autorización Inesperado (403 Forbidden / PostgREST empty rows)
- **Síntoma**: Un usuario legítimo no puede ver sus registros en una vista o consulta.
- **Diagnóstico**:
  ```sql
  SELECT p.id, p.tenant_id, p.role, p.is_active, t.name
  FROM public.profiles p
  JOIN public.tenants t ON t.id = p.tenant_id
  WHERE p.id = '<USER_UUID>';
  ```
- **Acción Inmediata**:
  Si `p.is_active` es `false`, verificar el estado de la cuenta. Si el rol es insuficiente, comprobar el feature flag `strict_tenant_authorization` (debe permanecer en `false` durante la transición).

### B. Bloqueo de Columnas (Privilege Violation)
- **Síntoma**: Un Server Component o Server Action intenta actualizar un campo administrativo en `tenants` o `profiles` y PostgreSQL rechaza el query con error de privilegios.
- **Acción Inmediata**:
  Verificar que la mutación se ejecute server-side mediante `createAdminClient()` o a través de los helpers autorizados tras validar el contexto con `requireTenantContext()`.

---

## 2. Acciones de Corrección en Caliente (Hotfix Forward)

1. **Ajuste de Política RLS sin Bloquear la Base**:
   ```sql
   -- Ejemplo: Actualizar política de lectura
   CREATE OR REPLACE POLICY "<policy_name>" ON public.<table_name>
     FOR SELECT TO authenticated
     USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active());
   ```

2. **Revisión de Índices para Evitar Locks**:
   Si una consulta de aislamiento experimenta contención, crear el índice de soporte de forma concurrente:
   ```sql
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_<table_name>_tenant_id ON public.<table_name>(tenant_id);
   ```

---

## 3. Contacto y Escalada
- No ejecutar `DROP SCHEMA private CASCADE` en caliente.
- Para cualquier ajuste, registrar la traza mediante correlation ID (`x-correlation-id`) y consultar los registros de auditoría en `public.operation_runs`.
