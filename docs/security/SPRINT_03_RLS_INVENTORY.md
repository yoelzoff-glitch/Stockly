# SPRINT 3/8 — INVENTARIO DE SEGURIDAD Y POLÍTICAS RLS EN BASE DE DATOS

## 1. Resumen de Superficie de Datos
Este inventario clasifica todas las tablas utilizadas por la aplicación Klyvo en `src/`, determinando la estrategia de Row Level Security (RLS), la fuente de aislamiento del tenant, operaciones CRUD permitidas y protección de datos sensibles.

---

## 2. Inventario Detallado de Tablas

| Tabla | PK / Identificador | ¿Tiene `tenant_id` directo? | Relación de Tenant | Operaciones Usadas | Datos Sensibles / Secretos | Acceso Cliente (`authenticated`) | Acceso `service_role` | Categoría RLS |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`profiles`** | `id` (UUID -> `auth.users`) | Sí (`tenant_id`) | Directo | `SELECT`, `UPDATE` | `role`, `is_active`, `tenant_id` (admin) | `SELECT` (mismo tenant), `UPDATE` (solo `full_name`, `avatar_url`) | Completo | **Protegida / Restricción de Columnas** |
| **`tenants`** | `id` (UUID) | Es el tenant (`id`) | Directo (`id`) | `SELECT`, `UPDATE` | `activation_token`, `plan`, `status` | `SELECT` (propio tenant), `UPDATE` (solo `name`, `currency`, `timezone`, `metadata`) | Completo | **Categoría A (Directa)** |
| **`products`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Precios, costos, stock | Completo (Scoping por tenant) | Completo | **Categoría A (Directa)** |
| **`orders`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT`, `UPDATE` | Datos de compradores | `SELECT` (Scoping por tenant) | Completo | **Categoría A (Directa)** |
| **`order_items`** | `id` (UUID) | Sí (`tenant_id`) | Directo / FK `orders.id` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Precios unitarios | `SELECT` (Scoping por tenant) | Completo | **Categoría A / B (Directa + FK)** |
| **`shipments`** | `id` (UUID) | No (FK `order_id`) | FK `orders.id` -> `tenant_id` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Direcciones de envío | `SELECT` (vía `EXISTS orders`) | Completo | **Categoría B (Relación Padre)** |
| **`order_cancellations`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT`, `UPDATE` | Motivos de cancelación | `SELECT` (Scoping por tenant) | Completo | **Categoría A (Directa)** |
| **`meli_accounts`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT`, `UPDATE` | `access_token`, `refresh_token` (**CRÍTICO**) | `SELECT` (solo columnas no sensibles: `id`, `status`, `token_expires_at`, `sync_error`) | Completo con tokens | **Categoría A / Tokens Protegidos** |
| **`whatsapp_numbers`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT`, `UPDATE` | `verify_token`, `app_secret` (**CRÍTICO**) | `SELECT` (solo `phone_number`, `status`, `display_name`) | Completo con credenciales | **Categoría A / Tokens Protegidos** |
| **`messages`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT`, `DELETE` | Contenido de chats, teléfonos | `SELECT`, `DELETE` (Scoping por tenant) | Completo | **Categoría A (Directa)** |
| **`alerts`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT`, `UPDATE` | Notificaciones operativas | `SELECT`, `UPDATE` (`is_read`) | Completo | **Categoría A (Directa)** |
| **`ai_actions`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT`, `UPDATE` | Payloads de comandos IA | `SELECT`, `UPDATE` (Scoping por tenant) | Completo | **Categoría A (Directa)** |
| **`action_workflows`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT`, `UPDATE` | Workflows masivos | `SELECT`, `UPDATE` (Scoping por tenant) | Completo | **Categoría A (Directa)** |
| **`price_adjustment_workflows`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT`, `UPDATE` | Parámetros de precios | `SELECT`, `INSERT`, `UPDATE` | Completo | **Categoría A (Directa)** |
| **`price_adjustment_details`** | `id` (UUID) | No (FK `workflow_id`)| FK `price_adjustment_workflows.id` | `SELECT`, `INSERT` | Ajustes por producto | `SELECT` (vía `EXISTS workflow`) | Completo | **Categoría B (Relación Padre)** |
| **`audit_logs`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT` | Trazas de auditoría | `SELECT` (Scoping por tenant), sin `UPDATE`/`DELETE` | Completo | **Categoría A (Directa - Inmutable)** |
| **`product_components`** | `id` (UUID) | Sí (`tenant_id`) | Directo / FK `products.id` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | BOM / Estructura de combos | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Completo | **Categoría A / B** |
| **`product_sku_components`** | `id` (UUID) | Sí (`tenant_id`) | Directo / FK `products.id` | `SELECT`, `INSERT`, `DELETE` | Mapeo de SKUs | `SELECT`, `INSERT`, `DELETE` | Completo | **Categoría A / B** |
| **`product_extra_costs`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Costos operativos fijos/porcentuales | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Completo | **Categoría A (Directa)** |
| **`product_price_history`** | `id` (UUID) | No (FK `product_id`)| FK `products.id` -> `tenant_id` | `SELECT`, `INSERT` | Historial de precios | `SELECT` (vía `EXISTS products`) | Completo | **Categoría B (Relación Padre)** |
| **`stock_movements`** | `id` (UUID) | No (FK `product_id`)| FK `products.id` -> `tenant_id` | `SELECT`, `INSERT` | Historial de movimientos stock | `SELECT` (vía `EXISTS products`) | Completo | **Categoría B (Relación Padre)** |
| **`inventory_items`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Stock físico de depósito y costos | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Completo | **Categoría A (Directa)** |
| **`inventory_movements`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT` | Movimientos físicos de stock | `SELECT`, `INSERT` | Completo | **Categoría A (Directa)** |
| **`purchase_orders`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Órdenes de compra a proveedores | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Completo | **Categoría A (Directa)** |
| **`purchase_order_items`** | `id` (UUID) | No (FK `purchase_order_id`) | FK `purchase_orders.id` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Líneas de orden de compra | `SELECT`, `INSERT`, `UPDATE`, `DELETE` (vía `EXISTS`) | Completo | **Categoría B (Relación Padre)** |
| **`promotions`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Campañas promocionales | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Completo | **Categoría A (Directa)** |
| **`promotion_items`** | `id` (UUID) | No (FK `promotion_id`) | FK `promotions.id` -> `tenant_id` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Productos en promoción | `SELECT`, `INSERT`, `UPDATE`, `DELETE` (vía `EXISTS`) | Completo | **Categoría B (Relación Padre)** |
| **`coupons`** | `id` (UUID) | No (FK `meli_account_id`)| FK `meli_accounts.id` -> `tenant_id`| `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Cupones de descuento | `SELECT`, `INSERT`, `UPDATE`, `DELETE` (vía `EXISTS`) | Completo | **Categoría B (Relación Padre)** |
| **`monthly_expenses`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Gastos fijos/variables | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Completo | **Categoría A (Directa)** |
| **`subscriptions`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT`, `UPDATE` | Estado de suscripción y planes | `SELECT` (Scoping por tenant) | Completo | **Categoría A (Directa)** |
| **`subscription_usage`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT`, `UPDATE` | Consumo mensual de IA | `SELECT` (Scoping por tenant) | Completo | **Categoría A (Directa)** |
| **`tenant_progress`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT`, `UPDATE` | Onboarding progress | `SELECT`, `UPDATE` | Completo | **Categoría A (Directa)** |
| **`tenant_preferences`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT`, `UPDATE` | Preferencias operativas | `SELECT`, `UPDATE` | Completo | **Categoría A (Directa)** |
| **`tenant_feature_flags`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT` | Flags de seguridad | **REVOKE ALL** a `authenticated`/`anon` | Exclusivo `service_role` | **Categoría C (Backend-Only)** |
| **`operation_runs`** | `id` (UUID) | Sí (`tenant_id`) | Directo | `SELECT`, `INSERT`, `UPDATE` | Traza de ejecuciones | **REVOKE ALL** a `authenticated`/`anon` | Exclusivo `service_role` | **Categoría C (Backend-Only)** |
| **`plans_config`** | `id` (UUID) | No (Tabla Global) | Global | `SELECT` | Configuración pública de planes | `SELECT` público (`anon`, `authenticated`) | Completo | **Categoría D (Pública Solo Lectura)** |

---

## 3. Estrategia de Grants y Privilegios

1. **`anon` (No autenticado)**:
   - `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;`
   - `GRANT SELECT ON public.plans_config TO anon;` (Pública intencional).

2. **`authenticated` (Usuarios logueados)**:
   - `GRANT SELECT, INSERT, UPDATE, DELETE` en tablas de aplicación filtradas por RLS.
   - `REVOKE ALL` en tablas de infraestructura (`tenant_feature_flags`, `operation_runs`).
   - `REVOKE SELECT (access_token, refresh_token, app_secret, verify_token)` en `meli_accounts` y `whatsapp_numbers`.
   - `REVOKE UPDATE (tenant_id, role, is_active, id, email)` en `profiles`.
   - `REVOKE UPDATE (plan, status, id, activation_token)` en `tenants`.

3. **`service_role` (Backend / Inngest / Webhooks)**:
   - Acceso irrestricto de bypass RLS mediante `BYPASSRLS` en PostgreSQL.
