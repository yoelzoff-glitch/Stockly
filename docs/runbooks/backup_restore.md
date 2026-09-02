# RUNBOOK: BACKUP, RESTAURACIÓN Y PROCEDIMIENTO DE ROLLBACK

## 1. Visión General y Objetivos
Este runbook detalla los procedimientos obligatorios para la protección y recuperación de datos de la base de datos de producción de Klyvo (Supabase / PostgreSQL), así como el protocolo de reversión (*rollback*) ante incidentes en despliegues o migraciones.

### Métricas de Recuperación Objetivo
* **RPO (Recovery Point Objective):** < 1 hora (con PITR activo) / < 24 horas (con backups diarios automáticos).
* **RTO (Recovery Time Objective):** < 2 horas para restauración en entorno secundario o restauración de esquema.

---

## 2. Verificación de Backups Automáticos en Supabase
1. Acceder al dashboard de Supabase: `https://supabase.com/dashboard/project/<PROJECT_REF>/database/backups/scheduled`.
2. Verificar que los **Daily Backups** muestren estado `Success` en las últimas 24 horas.
3. Si el proyecto cuenta con el plan Pro/Team, verificar el estado de **Point in Time Recovery (PITR)** para habilitar recuperación a cualquier minuto específico.

---

## 3. Generación de Backup Manual previo a Migraciones
Antes de aplicar cualquier script SQL en producción, se debe generar un volcado manual local o en almacenamiento seguro cifrado.

### 3.1 Vía Supabase CLI
```bash
# Exportar solo la estructura del schema
supabase db dump --db-url "$DATABASE_URL" -f "klyvo_schema_pre_migration_$(date +%Y%m%d_%H%M%S).sql"

# Exportar solo los datos (excluyendo schema)
supabase db dump --db-url "$DATABASE_URL" --data-only -f "klyvo_data_pre_migration_$(date +%Y%m%d_%H%M%S).sql"
```

### 3.2 Vía `pg_dump` Nativo
```bash
pg_dump "$DATABASE_URL" \
  --format=custom \
  --file="klyvo_backup_pre_migration_$(date +%Y%m%d_%H%M%S).dump" \
  --exclude-table-data='public.audit_logs'
```

> [!CAUTION]
> **SEGURIDAD ESTRICTA DE ARCHIVOS DE BACKUP:**
> * **NUNCA** guardes archivos `.sql`, `.dump` o `.env` en el repositorio Git.
> * Verifica que `.gitignore` contenga `*.sql`, `*.dump`, `*.tar`, `*.bak`.
> * Almacena los backups temporales en volúmenes cifrados y elimínalos tras 7 días de validación.

---

## 4. Tablas Críticas de Alto Cuidado
Durante cualquier proceso de auditoría o rollback, las siguientes tablas contienen estado operacional vivo:

1. **`public.meli_accounts`**: Contiene tokens de acceso y refresco de Mercado Libre. Su corrupción desconecta al vendedor.
2. **`public.orders` y `public.order_items`**: Historial transaccional y deducciones de stock asociadas.
3. **`public.inventory_items` y `public.inventory_movements`**: Balance de stock en tiempo real y costos.
4. **`public.subscriptions` y `public.plans_config`**: Acceso comercial y límites contratados.

---

## 5. Procedimiento de Restauración en Proyecto Temporal
Para verificar la integridad de un backup sin tocar producción:

1. Crear un proyecto temporal en Supabase o una base de datos PostgreSQL local:
   ```bash
   docker run --name klyvo-restore-test -e POSTGRES_PASSWORD=testpassword -p 54322:5432 -d postgres:15
   ```
2. Restaurar el dump:
   ```bash
   pg_restore -d "postgresql://postgres:testpassword@localhost:54322/postgres" -v "klyvo_backup_pre_migration_YYYYMMDD_HHMMSS.dump"
   ```
3. Ejecutar consultas de validación de registros:
   ```sql
   SELECT count(*) FROM public.tenants;
   SELECT count(*) FROM public.orders;
   SELECT count(*) FROM public.products;
   SELECT count(*) FROM public.inventory_items;
   ```

---

## 6. Procedimiento de Rollback

### 6.1 Rollback de Código en Producción (Vercel / Next.js)
1. En el dashboard de despliegues de Vercel (o plataforma host), seleccionar el despliegue previo (*Instant Rollback*).
2. O bien, revertir el commit en `main`:
   ```bash
   git revert HEAD --no-edit
   git push origin main
   ```

### 6.2 Rollback de Migraciones de Sprint 1
Dado que las migraciones del Sprint 1 son estrictamente aditivas, su rollback consiste en la eliminación controlada de las dos tablas nuevas (sin alterar ninguna tabla preexistente):

```sql
-- ROLLBACK SPRINT 1 (Ejecutar en Supabase SQL Editor solo si es necesario)
DROP TABLE IF EXISTS public.operation_runs CASCADE;
DROP TABLE IF EXISTS public.tenant_feature_flags CASCADE;
```

---

## 7. Checklists de Operación

### Checklist Previo a Migración
- [ ] Backup automático de Supabase confirmado en últimas 24h.
- [ ] Dump manual ejecutado y almacenado de forma segura.
- [ ] Script `supabase/diagnostics/production_preflight.sql` ejecutado y revisado.
- [ ] Validación de que la migración utiliza `IF NOT EXISTS` y no modifica datos existentes.
- [ ] Notificación al equipo sobre el inicio de la ventana de mantenimiento.

### Checklist Posterior a Migración
- [ ] Tablas nuevas creadas con permisos correctos para `service_role`.
- [ ] RLS activo y sin permisos para `anon` / `authenticated`.
- [ ] Verificación de endpoints `/api/health/live` y `/api/health/ready`.
- [ ] Smoke test con usuario real en dashboard.
- [ ] Verificación de logs de sincronización sin errores 500.
