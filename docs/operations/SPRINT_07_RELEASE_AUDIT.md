# AUDITORÍA DEL RELEASE PIPELINE — SPRINT 7

## 1. Contexto y Objetivos
Este documento audita el pipeline de integración continua (CI), las verificaciones locales, los requerimientos de entorno y los mecanismos de despliegue y reversión de Klyvo.

---

## 2. Pipeline de GitHub Actions vs. Release Gate Local

### 2.1 Qué ejecuta actualmente GitHub Actions
En sprints previos, `.github/workflows/ci.yml` ejecutaba un subconjunto básico:
1. `npm ci`
2. Verificación de que no existen archivos `.env` reales en Git.
3. Escaneo estático de patrones de claves privadas y tokens hardcodeados.
4. `npm run typecheck` (TypeScript sin emisión).
5. `npm run test:ci` (Tests unitarios deterministas con runner nativo de Node.js).
6. `npm run audit:auth` (Auditoría estática de autorización y tenant ID en rutas).
7. `npm audit --omit=dev || true` (Auditoría de dependencias en modo informativo).

### 2.2 Verificaciones que existían únicamente en local
Hasta el Sprint 6, los siguientes gates críticos solo se ejecutaban localmente mediante `verify:sprint6:disposable` sobre PostgreSQL efímero (`embedded-postgres`):
- `audit:rls` (Auditoría estática de políticas RLS y filtros `tenant_id`).
- `audit:webhooks` (Auditoría de firma criptográfica y modos `observe`/`enforce`).
- `audit:billing` (Auditoría de límites de plan y cuotas atómicas).
- `audit:performance` (Auditoría de índices, claves foráneas y deduplicación de índices).
- `test:rls:integration` (Aislamiento multitenant real en base de datos con 2 tenants).
- `test:webhooks:integration` (Concurrencia real de 20 eventos simultáneos de webhook).
- `test:billing:integration` (Consumo concurrente de cuotas con 50 peticiones y mes vacío).
- `test:leases:integration` (50 clientes de lease compitiendo, rate limiter 50/20, roles `anon`/`authenticated` bloqueados vs `service_role`).
- `test:performance` (Prueba de carga sintética con 4 tenants y 24 workers concurrentes).
- `npm run build` (Compilación de producción Next.js).

**Objetivo Sprint 7:** Mudar todas estas verificaciones al pipeline de GitHub Actions mediante un service container de PostgreSQL 16 idéntico a Supabase.

---

## 3. Dependencias de PostgreSQL Descartable y Entorno

### 3.1 Local vs. CI
- **Local (Windows / macOS / Linux):** Utiliza `scripts/verify-with-disposable-db.js` apoyado en `embedded-postgres` en puerto `54322`, levantando un binario local de PostgreSQL descartable aislado en `.disposable-test-db/`.
- **GitHub Actions (Ubuntu):** Utiliza un **Service Container** nativo de Docker (`postgres:16-alpine`) en puerto `5432` con variables `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=password`, `POSTGRES_DB=postgres`.

### 3.2 Variables de Entorno Requeridas para CI y Tests
Para ejecutar el build y los tests sin exponer credenciales de producción ni contactar APIs externas:
| Variable | Valor en CI / Test | Propósito |
| :--- | :--- | :--- |
| `DATABASE_URL_TEST` | `postgresql://postgres:password@127.0.0.1:5432/postgres` | Conexión al PostgreSQL local descartable. |
| `KLYVO_RLS_TEST_DB` | `1` | Habilita tests reales de RLS. |
| `KLYVO_WEBHOOK_TEST_DB` | `1` | Habilita tests reales de Webhooks. |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://mock.supabase.co` | Requerido por el build de Next.js. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `mock-anon-key-ci-only` | Requerido por el build de Next.js. |
| `SUPABASE_SERVICE_ROLE_KEY` | `mock-service-role-key-ci-only` | Requerido por inicialización estática de admin client. |
| `HEALTHCHECK_TOKEN` | `ci-healthcheck-token-safe` | Validación de endpoint `/api/health/ready`. |
| `NODE_ENV` | `test` / `production` | Control de entorno de ejecución. |

---

## 4. Acoplamiento entre `git push origin main` y Deploy de Vercel

### 4.1 Mecanismo Actual
1. Un `git push origin main` activa automáticamente el pipeline de GitHub Actions y el despliegue automático de Vercel en paralelo.
2. Si el código en `main` depende de una columna o función SQL que aún no fue migrada en la base de datos de producción (Supabase), el nuevo build desplegado en Vercel comenzará a fallar con errores HTTP 500 para los usuarios reales.

### 4.2 Riesgo de Desplegar Código antes de Migración
- **Riesgo:** Incompatibilidad de esquema (*Schema drift*), fallos en queries de Next.js y bloqueos de interfaz para el usuario activo.
- **Regla Estricta de Mitigación (Backward/Forward Compatibility):**
  1. Todas las migraciones deben ser **100% aditivas** (`IF NOT EXISTS`, columnas `NULL` o con `DEFAULT`, funciones nuevas con nombres o sobrecargas seguras).
  2. Las migraciones deben aplicarse a Supabase **antes** de que el código que las consuma sea desplegado.
  3. El código debe diseñarse tolerante a la ausencia previa de nuevas columnas durante la ventana de despliegue (*graceful fallback*).

---

## 5. Procedimiento Actual de Rollback

### 5.1 Rollback de Código (Vercel) — RTO < 2 minutos
- **Acción:** Acceder al dashboard de Vercel -> Proyecto Klyvo -> Pestaña *Deployments* -> Seleccionar el despliegue anterior estable -> Clic en **Instant Rollback**.
- **Impacto:** Restablece inmediatamente el frontend y las funciones serverless sin necesidad de recompilar ni alterar el historial de Git en emergencia.

### 5.2 Rollback de Base de Datos
- Dado que las migraciones son aditivas, las tablas o columnas creadas en sprints anteriores (e.g. `operation_leases`, `rate_limit_buckets`, `operation_runs`) son inocuas para versiones anteriores del código.
- Se cuenta con scripts de rollback dedicados en `docs/security/rollback/` como último recurso manual si fuera estrictamente indispensable.
