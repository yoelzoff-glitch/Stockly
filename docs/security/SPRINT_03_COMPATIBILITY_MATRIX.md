# SPRINT 3/8 — MATRIZ DE COMPATIBILIDAD OPERATIVA Y RLS

## 1. Alcance de Verificación
Esta matriz valida que todas las vistas, acciones y flujos del usuario activo en producción continúen funcionando sin interrupciones bajo el modelo de aislamiento de datos y Row Level Security.

---

## 2. Matriz de Flujos de la Aplicación

| Flujo / Pantalla | Tablas Involucradas | Cliente / Mecanismo | Política / Rol | Estado de Compatibilidad | Riesgo Residual |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Login y Sesión** | `auth.users`, `profiles` | `getUser()` + `requireTenantContext` | `profiles_select_own_tenant` | ✅ 100% Compatible | Ninguno |
| **Onboarding** | `tenants`, `profiles`, `tenant_progress` | Server Action / `service_role` | `profiles_update_own_row` | ✅ 100% Compatible | Ninguno |
| **Dashboard y Métricas** | `orders`, `products`, `monthly_expenses`, `alerts` | Server Component / API | `*_tenant_select` con `current_tenant_id()` | ✅ 100% Compatible | Ninguno |
| **Catálogo de Productos**| `products`, `product_components` | Server Component / API | `products_tenant_select` | ✅ 100% Compatible | Ninguno |
| **Ventas y Detalle** | `orders`, `order_items`, `shipments` | Server Component / API | `orders_tenant_select`, `shipments_tenant_select` | ✅ 100% Compatible | Ninguno |
| **Exportación CSV** | `orders` | `/api/sales/export` + `requireTenantContext` | `orders_tenant_select` | ✅ 100% Compatible | Ninguno |
| **Rentabilidad / Costos** | `products`, `monthly_expenses`, `product_extra_costs` | API / Client | `*_tenant_select` | ✅ 100% Compatible | Ninguno |
| **Importación de Costos**| `products` | `/api/products/import-costs` + `requireTenantRole` | `products_tenant_update` | ✅ 100% Compatible | Ninguno |
| **Command Center (IA)** | `ai_actions`, `products` | Server Action + `requireTenantContext` | `ai_actions_tenant_update` | ✅ 100% Compatible | Ninguno |
| **Workflows de Precios** | `price_adjustment_workflows`, `price_adjustment_details` | `/api/workflows/execute` + `requireTenantRole` | `price_adjustment_*` | ✅ 100% Compatible | Ninguno |
| **Integración MeLi** | `meli_accounts` | Server Actions / `/api/meli/*` | `meli_accounts_tenant_select` (tokens no expuestos a browser) | ✅ 100% Compatible | Ninguno |
| **Configuración Cuenta** | `profiles` | Server Action `updateProfile` | `profiles_update_own_row` (solo `full_name`, `avatar_url`) | ✅ 100% Compatible | Ninguno |
| **Configuración Negocio**| `tenants`, `tenant_preferences` | Server Action `updateTenant` | `tenants_update_own` (solo campos seguros) | ✅ 100% Compatible | Ninguno |
| **Alertas Inteligentes** | `alerts` | Server Action / API | `alerts_tenant_update` | ✅ 100% Compatible | Ninguno |
| **Jobs Inngest / Sync** | `orders`, `products`, `shipments`, `operation_runs` | Inngest Background / `service_role` | `BYPASSRLS` legítimo con filtro tenant | ✅ 100% Compatible | Ninguno |
| **Webhooks MeLi / MP** | `orders`, `subscriptions` | Webhook / `service_role` | `BYPASSRLS` legítimo (Sprint 4 HMAC) | ✅ 100% Compatible | Pendiente Sprint 4 |
| **WhatsApp** | `whatsapp_numbers`, `messages` | Desactivado (`KLYVO_DISABLE_WHATSAPP_AGENT=true`) | Tokens protegidos | ✅ Seguro / Inactivo | Ninguno |
