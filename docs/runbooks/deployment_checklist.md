# DEPLOYMENT CHECKLIST & FORWARD RECOVERY — KLYVO

Este checklist y guía operativa establece el orden obligatorio de despliegue y las estrategias de mitigación ante incidencias para garantizar cero downtime y compatibilidad retroactiva con el usuario real.

---

## 1. ORDEN OBLIGATORIO DE DESPLIEGUE

Cada release a producción debe seguir rigurosamente esta secuencia secuencial:

```mermaid
graph LR
    A["1. CI Verde (GitHub Actions)"] --> B["2. Revisar Migraciones Pendientes"]
    B --> C["3. Backup / PITR Confirmado"]
    C --> D["4. Aplicar Migraciones Aditivas"]
    D --> E["5. Verificación DB (Permisos / RLS)"]
    E --> F["6. Deploy de Código (Vercel)"]
    F --> G["7. Health Checks (/live & /ready)"]
    G --> H["8. Smoke Tests Funcionales"]
# DEPLOYMENT CHECKLIST & FORWARD RECOVERY — LIBRETAX
<!-- Sprint 7/8 Operational Reliability & Incident Management -->

---

## 1. Pre-Deployment Checklist (Staging -> Production)

El siguiente checklist DEBE completarse y verificarse antes de promocionar cualquier cambio a la rama `main` o disparar un despliegue en Vercel/Supabase:

### A. Integridad de Código y Tipos
- [ ] `npm run typecheck` pasa sin ningún error de TypeScript (`tsc --noEmit`).
- [ ] `npm run test:ci` pasa el 100% de los tests unitarios deterministas.
- [ ] `npm run audit:release` verifica que todas las 12 funciones de Inngest, los 11 endpoints de API críticos y las 44 tablas con RLS estén en orden.
- [ ] Ningún archivo `.env` o `.env.local` ha sido commiteado o rastreado por Git (`git ls-files | grep -E '^\.env'`).

### B. Migraciones de Base de Datos (Supabase)
- [ ] Todas las migraciones en `supabase/migrations/` son **aditivas e idempotentes** (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
- [ ] No existen instrucciones destructivas (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`) sin un plan de migración en dos fases documentado.
- [ ] Se ejecutó el preflight check en staging (`supabase/diagnostics/production_preflight.sql`).
- [ ] Las 44 tablas tienen `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` y `ALTER TABLE ... FORCE ROW LEVEL SECURITY;`.

### C. Variables de Entorno en Vercel
- [ ] Se ejecutó `npm run check:env` verificando que todas las variables requeridas (CRÍTICAS) y funcionales estén presentes.
- [ ] Los secrets de producción (`SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_SECRET_KEY`, `CRON_SECRET`, `HEALTHCHECK_TOKEN`) son independientes y diferentes a los de staging/test.
- [ ] `NODE_ENV=production` configurado en el proyecto de producción.

---

## 2. Fast Forward-Recovery Playbook

Si tras el despliegue se detecta un fallo que no justifique un rollback completo (o durante el tiempo en que se evalúa), aplicar las siguientes mitigaciones inmediatas:

| Síntoma | Diagnóstico Rápido | Mitigación Inmediata | Instrucción de Ejecución |
|---|---|---|---|
| **Saturación de API de Mercado Libre** | Rate limit excedido o bucle de sync | Activar Kill Switch | **Kill Switch:** Setear `LIBRETAX_DISABLE_MANUAL_SYNCS=true` en Vercel. Pausa peticiones sin afectar lectura de dashboard. |
| **Fallo en Job de Background** | Inngest / worker fallando | Pausar función en Inngest | **Desactivar Jobs:** Pausar función específica en Inngest dashboard mientras se investiga el bug. |
| **Inconsistencia en Feature Flag** | Nueva lógica causando discrepancias | Apagar Flag | **Volver Flags a `false`:** Desactivar el flag en `public.tenant_feature_flags` o variable de entorno (`billing_webhook_v2=false`). |
| **Error en Schema de Base de Datos** | Constraint demasiado estricto o bug en RPC | **Forward Migration** | **Forward Migration:** Aplicar un nuevo script SQL correctivo (`ALTER TABLE ... DROP CONSTRAINT`, `CREATE OR REPLACE FUNCTION`). NUNCA eliminar tablas con datos vivos. |

---

## 3. REGLA ESTRICTA DE MIGRACIONES
> [!CAUTION]
> **NUNCA incluir scripts destructivos ni DROP TABLES dentro de `supabase/migrations/`**.
> Los scripts de emergencia y rollback destructivo deben residir exclusivamente en `docs/security/rollback/` para uso manual bajo autorización explícita del Incident Commander.
