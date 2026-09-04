# PLAN DE RECUPERACIÓN ANTE DESASTRES (DISASTER RECOVERY)

## 1. Alcance y Escenarios de Desastre

Este plan cubre la respuesta y mitigación inmediata ante escenarios de fallo catastrófico que afecten la disponibilidad o integridad de Klyvo:
1. **Caída Total de Proveedor de Base de Datos (Supabase / AWS Region).**
2. **Caída Total de Plataforma Frontend / Serverless (Vercel).**
3. **Corrupción Masiva o Pérdida Accidental de Datos.**
4. **Desconexión o Bloqueo Prolongado de API de Mercado Libre.**

---

## 2. Objetivos de Continuidad del Negocio
- **RPO Objetivo (Recovery Point Objective):**
  - `< 1 hora`: Objetivo condicionado a que Point-in-Time Recovery (PITR) esté contratado y habilitado en el proyecto Supabase de producción.
  - `< 24 horas`: Garantizado mediante backups automáticos y snapshots diarios.
- **RTO Objetivo (Recovery Time Objective):** Máximo 30 minutos para restablecer servicio en modo degradado o sobre réplica secundaria.
- **Canal de Comunicación de Crisis:** Canal privado de Slack `#klyvo-incident-command` + Status Page interna.

---

## 3. Matriz de Roles y Responsabilidades

| Rol | Responsable Principal | Suplente | Funciones |
| :--- | :--- | :--- | :--- |
| **Incident Commander (IC)** | Tech Lead | Senior Backend Dev | Lidera la toma de decisiones, declara estado de contingencia y aprueba acciones destructivas. |
| **Database Lead** | Database Admin / Backend Lead | DevOps Engineer | Ejecuta PITR, restauraciones de volcado y verificación de integridad referencial. |
| **Platform / Infra Lead** | DevOps Engineer | Fullstack Engineer | Gestiona DNS, despliegues en Vercel, rotación de claves y activación de kill switches. |
| **Customer Comms** | Product Lead | Customer Success | Comunica estado del incidente a usuarios activos y gestiona soporte. |

---

## 4. Procedimientos de Recuperación por Escenario

### Escenario A: Caída Mayor de Supabase
1. Declarar incidente de severidad SEV-1.
2. Activar página de mantenimiento temporal en Vercel redirigiendo a `/maintenance` o activando kill switches globales (`KLYVO_DISABLE_MELI_SYNC=true`, `KLYVO_DISABLE_WHATSAPP_AGENT=true`).
3. Si el downtime supera 15 minutos y el proveedor no reporta resolución:
   - Proveer un nuevo cluster PostgreSQL en región alternativa (AWS RDS / Supabase backup project).
   - Restaurar el último snapshot diario o ejecutar PITR hasta el minuto previo al fallo.
   - Actualizar variables de entorno en Vercel (`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
   - Redesplegar entorno en Vercel.
   - Ejecutar health checks `/api/health/live` y `/api/health/ready`.
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
