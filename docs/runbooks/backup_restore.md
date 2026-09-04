# RUNBOOK: BACKUP, RESTAURACIÓN Y RECUPERACIÓN DE DATOS

## 1. Visión General y Métricas Objetivas

Este runbook detalla los procedimientos obligatorios para la protección, validación y restauración de datos de Klyvo (Supabase / PostgreSQL), así como la estrategia de reconstrucción de estado ante pérdidas operacionales.

### Métricas de Recuperación Objetivo
* **RPO (Recovery Point Objective):**
  * `< 1 hora` con Point in Time Recovery (PITR) activo en Supabase.
  * `< 24 horas` mediante backups lógicos y snapshots automáticos diarios.
* **RTO (Recovery Time Objective):**
  * `< 30 minutos` para restauración de esquema y datos en entorno secundario o réplica de base de datos.
* **Responsable:** Líder de Ingeniería / Operador de Turno DevOps.

---

## 2. Inventario de Datos: Reconstructibles vs. No Reconstructibles

Ante un incidente mayor de pérdida de datos o corrupción, es crítico diferenciar qué información puede resincronizarse desde fuentes externas y cuál existe exclusivamente en la base de datos de Klyvo:

### 2.1 Datos Recuperables vía Resincronización (Mercado Libre API)
Los siguientes datos pueden reconstruirse automáticamente consultando la API de Mercado Libre con los tokens del tenant:
- Catálogo de publicaciones y productos sincronizados (`public.products`).
- Historial de órdenes de venta (`public.orders` y `public.order_items`).
- Preguntas y mensajes de post-venta (`public.chat_threads`, `public.messages`).
- Identificadores de compradores y estados de entrega.

### 2.2 Datos Exclusivos de Klyvo (NO RECONSTRUIBLES desde APIs externas)
Si estos datos se pierden sin un backup válido, **no pueden regenerarse automáticamente**:
1. **Costos unitarios y márgenes históricos** (`public.inventory_items.unit_cost`, composiciones de SKU).
2. **Historial de movimientos de inventario internos** (`public.inventory_movements` manuales o ajustes de merma).
3. **Configuraciones de planes, límites y suscripciones** (`public.subscriptions`, `public.plans_config`).
4. **Preferencias del tenant, roles y feature flags** (`public.tenant_feature_flags`, `public.profiles`).
5. **Logs de auditoría y registros de ejecución** (`public.operation_runs`, `public.webhook_events`).

> [!CAUTION]
> Toda política de backup debe priorizar la consistencia transaccional de las tablas de inventario, costos y suscripciones, ya que representan el valor analítico único de la plataforma.

---

## 3. Procedimiento de Verificación y Generación de Backups

### 3.1 Backups Automáticos en Supabase
1. Ingresar a `https://supabase.com/dashboard/project/<PROJECT_REF>/database/backups/scheduled`.
2. Verificar que el último respaldo diario figure en estado `Success`.
3. Validar que **Point-in-Time Recovery (PITR)** esté activo con retención de 7 días.

### 3.2 Generación de Backup Manual previo a Despliegues
```bash
# Dump estructurado con compresión y formato custom
pg_dump "$DATABASE_URL" \
  --format=custom \
  --file="dumps/klyvo_backup_pre_deploy_$(date +%Y%m%d_%H%M%S).dump" \
  --schema=public \
  --no-owner \
  --no-privileges
```

---

## 4. Procedimiento de Restauración Paso a Paso

1. **Aislamiento:** Activar kill switch de sincronización (`KLYVO_DISABLE_MELI_SYNC=true`) para evitar escrituras concurrentes durante la restauración.
2. **Creación de Instancia Destino:**
   - En entorno de contingencia o proyecto Supabase temporal:
   ```bash
   # O en PostgreSQL descartable de prueba:
   docker run --name klyvo-restore-instance -e POSTGRES_PASSWORD=recovery_pass -p 54322:5432 -d postgres:16
   ```
3. **Restauración del Volcado:**
   ```bash
   pg_restore -d "postgresql://postgres:recovery_pass@localhost:54322/postgres" --clean --if-exists -v "dumps/klyvo_backup.dump"
   ```
4. **Verificación de Consistencia Post-Restauración:**
   ```sql
   -- Validar conteo de tablas críticas
   SELECT 'tenants' as tbl, count(*) FROM public.tenants
   UNION ALL
   SELECT 'products', count(*) FROM public.products
   UNION ALL
   SELECT 'orders', count(*) FROM public.orders
   UNION ALL
   SELECT 'inventory_items', count(*) FROM public.inventory_items;
   ```
5. **Resincronización de Delta:**
   - Ejecutar job manual de sincronización para órdenes y productos creados entre la fecha del backup y el momento actual.
6. **Reanudación del Tráfico:** Desactivar kill switch y reanudar webhooks.

---

## 5. Prueba de Backup/Restore Automatizada
El script [`scripts/test-backup-restore.ts`](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/scripts/test-backup-restore.ts) (`npm run test:recovery`) ejecuta este ciclo completo de forma 100% determinista sobre datos sintéticos como parte del release gate de CI.
