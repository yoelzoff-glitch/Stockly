# SPRINT 3/8 — MATRIZ DE COMPATIBILIDAD OPERATIVA Y RLS

## 1. Alcance y Estado de Verificación
Esta matriz documenta la compatibilidad teórica y estática de los flujos de la aplicación frente a las políticas RLS y privilegios de columna del Sprint 3.
*Nota de Seguridad*: La compatibilidad completa en entorno real queda sujeta a la ejecución de las migraciones en una base de datos staging/descartable previa al despliegue.

---

## 2. Matriz de Flujos de la Aplicación

| Flujo / Pantalla | Tablas Involucradas | Mecanismo | Política RLS Asociada | Estado de Verificación Estática | Riesgo Residual / Pre-Deploy Gate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Login y Sesión** | `auth.users`, `profiles` | `getUser()` + `requireTenantContext` | `profiles_select_own_tenant` | ✅ Auditado estáticamente | Requiere verificar que usuarios inactivos devuelvan 403 controlado. |
| **Onboarding** | `tenants`, `profiles`, `tenant_progress` | Server Action / `service_role` | `profiles_update_own_row` | ✅ Auditado estáticamente | Onboarding usa `service_role` para creación inicial. |
| **Dashboard y Métricas** | `orders`, `products`, `monthly_expenses`, `alerts` | Server Component / API | `*_tenant_select` con `current_tenant_id()` | ✅ Auditado estáticamente | Validado con queries acotadas por tenant. |
| **Catálogo de Productos**| `products`, `product_components` | Server Component / API | `products_tenant_select` | ✅ Auditado estáticamente | Sin lecturas cruzadas. |
| **Ventas y Detalle** | `orders`, `order_items`, `shipments` | Server Component / API | `orders_tenant_select`, `shipments_tenant_select` | ✅ Auditado estáticamente | Subconsulta `EXISTS` en `shipments` indexada. |
| **Exportación CSV** | `orders` | `/api/sales/export` + `requireTenantContext` | `orders_tenant_select` | ✅ Auditado estáticamente | Contrato 58211d3 verificado con tests. |
| **Rentabilidad / Costos** | `products`, `monthly_expenses`, `product_extra_costs` | API / Client | `*_tenant_select` | ✅ Auditado estáticamente | Validado con filtros por tenant. |
| **Importación de Costos**| `products` | `/api/products/import-costs` + `requireTenantRole` | `products_tenant_update` | ✅ Auditado estáticamente | Errores sanitizados a nivel fila. |
| **Command Center (IA)** | `ai_actions`, `products` | Server Action + `requireTenantContext` | `ai_actions_tenant_update` | ✅ Auditado estáticamente | Formateador puro verificado. |
| **Workflows de Precios** | `price_adjustment_workflows`, `price_adjustment_details` | `/api/workflows/execute` + `requireTenantRole` | `price_adjustment_*` | ✅ Auditado estáticamente | Requiere rol owner/admin. |
| **Integración MeLi** | `meli_accounts` | Server Actions / `/api/meli/*` | `meli_accounts_tenant_select` | ✅ Auditado estáticamente | Tokens protegidos: browser solo lee columnas seguras. |
| **Configuración Cuenta** | `profiles` | Server Action `updateProfile` | `profiles_update_own_row` | ✅ Auditado estáticamente | Solo actualiza `full_name`, `avatar_url`. Columnas administrativas bloqueadas. |
| **Configuración Negocio**| `tenants` | Server Action `updateTenant` | `tenants_update_own` | ✅ Auditado estáticamente | Solo actualiza `name`, `currency`, `timezone`. `metadata` y `plan` bloqueados. |
| **Alertas Inteligentes** | `alerts` | Server Action / API | `alerts_tenant_update` | ✅ Auditado estáticamente | Permite marcar `is_read`. |
| **Jobs Inngest / Sync** | `orders`, `products`, `shipments`, `operation_runs` | Inngest Background / `service_role` | `BYPASSRLS` legítimo con filtro tenant | ✅ Auditado estáticamente | Trazabilidad con `operation_runs`. |
| **Webhooks MeLi / MP** | `orders`, `subscriptions` | Webhook / `service_role` | `BYPASSRLS` legítimo | ⚠️ Validación estricta pendiente Sprint 4 | Pendiente validación criptográfica HMAC en Sprint 4. |
| **WhatsApp** | `whatsapp_numbers`, `messages` | Desactivado (`KLYVO_DISABLE_WHATSAPP_AGENT=true`) | Tokens protegidos | ✅ Inactivo / Seguro | Agente IA deshabilitado. |
