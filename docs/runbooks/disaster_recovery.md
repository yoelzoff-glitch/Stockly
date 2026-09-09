# PLAN DE RECUPERACIÓN ANTE DESASTRES (DISASTER RECOVERY)

## 1. Alcance y Escenarios de Desastre

Este plan cubre la respuesta y mitigación inmediata ante escenarios de fallo catastrófico que afecten la disponibilidad o integridad de Klyvo:
1. **Caída Total de Proveedor de Base de Datos (Supabase / AWS Region).**
2. **Caída Total de Plataforma Frontend / Serverless (Vercel).**
3. **Corrupción Masiva o Pérdida Accidental de Datos.**
4. **Desconexión o Bloqueo Prolongado de API de Mercado Libre.**

Este plan cubre la respuesta y mitigación inmediata ante escenarios de fallo catastrófico que afecten la disponibilidad o integridad de LibretaX:

1. **Caída total o corrupción de Base de Datos (Supabase/PostgreSQL).**
2. **Caída del Runtime de Aplicación (Vercel).**
3. **Saturación / Degradación de APIs Externas (Mercado Libre / OpenAI / Inngest).**
4. **Fuga de Credenciales o Compromiso de Seguridad.**

---

## 1. EQUIPO DE COMUNICACIÓN Y CONTACTOS DE CRISIS

- **Canal de Comunicación de Crisis:** Canal privado de Slack `#libretax-incident-command` + Status Page interna.
- **Roles:**
  - **Incident Commander (IC):** Responsable de coordinar la resolución y tomar decisiones de mitigación/rollback.
  - **Database Lead:** Responsable de PITR, backups y consistencia de datos.
  - **App/Infrastructure Lead:** Responsable de Vercel, Inngest, variables de entorno y routing.
  - **Communications Lead:** Responsable de redactar comunicados para tenants y usuarios afectados.

---

## 2. PROCEDIMIENTOS DE RECUPERACIÓN POR ESCENARIO

### Escenario 1: Caída o Bloqueo Masivo de Mercado Libre API (429 / 5xx)
**Síntomas:** Sincronizaciones fallando masivamente, colas de Inngest saturadas, alta latencia en endpoints de sync.
**Procedimiento:**
1. Activar kill switch de sincronización en Vercel:
   ```bash
   LIBRETAX_DISABLE_MANUAL_SYNCS=true
   LIBRETAX_DISABLE_MELI_WRITES=true
   ```
2. Activar página de mantenimiento temporal en Vercel redirigiendo a `/maintenance` o activando kill switches globales (`LIBRETAX_DISABLE_MANUAL_SYNCS=true`, `LIBRETAX_DISABLE_WHATSAPP_AGENT=true`).
3. Si el downtime supera 15 minutos y el proveedor no reporta resolución:
   - Proveer un nuevo cluster PostgreSQL en región alternativa (AWS RDS / Supabase backup project).
   - Restaurar el último snapshot diario o ejecutar PITR hasta el minuto previo al fallo.
   - Actualizar variables de entorno en Vercel (`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
   - Redesplegar entorno en Vercel.
   - Reanudar sincronizaciones en modo gradual.

### Escenario B: Corrupción o Pérdida Parcial de Datos
1. Inmediatamente aislar el tenant afectado para evitar propagación de escrituras inconsistentes.
2. Identificar el momento exacto del fallo en `public.operation_runs` y Sentry.
3. Restaurar una copia PITR a una base de datos temporal (PostgreSQL descartable).
4. Extraer las filas de las tablas no reconstruibles (`inventory_items`, `subscriptions`, etc.) previas al evento y aplicarlas selectivamente en producción mediante transacción atómica.
5. Ejecutar resincronización de órdenes y productos desde Mercado Libre para recuperar el delta transaccional.

### Escenario C: Caída de Vercel (Edge / Serverless)
1. Conmutar registros DNS (Cloudflare) hacia infraestructura alternativa de respaldo o página estática de estado.
2. Monitorear status.vercel.com.
3. Una vez restablecido, verificar que no existan requests en vuelo colgadas en colas de Inngest.

---

## 5. Validación Periódica
- **Simulacro Semestral de Disaster Recovery:** Ejecución de restauración completa en base de datos secundaria utilizando datos sintéticos con verificación de RTO/RPO.
- **Pipeline Automático de CI:** Validación continua del ciclo de backup/restauración mediante [`scripts/test-backup-restore.ts`](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/scripts/test-backup-restore.ts).
