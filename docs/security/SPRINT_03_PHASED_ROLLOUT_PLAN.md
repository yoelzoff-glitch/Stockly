# Plan de Despliegue Gradual por Lotes — Sprint 3 RLS

Para garantizar cero indisponibilidad y protección absoluta del usuario real activo en producción, la aplicación de políticas y `FORCE RLS` se estructura en 5 lotes ordenados con validación preflight y postflight.

---

## Lote 1: Cimientos y Funciones de Seguridad
- **Archivos**: `20260903000000_sprint03_a_foundations.sql`
- **Componentes**: Schema `private`, funciones con `SET search_path = ''` (`current_tenant_id`, `current_tenant_role`, `current_profile_is_active`, `belongs_to_tenant`, `has_tenant_role`).
- **Preflight**:
  ```sql
  SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'private';
  ```
- **Postflight**:
  ```sql
  SELECT proname, prosecdef FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE pg_namespace.nspname = 'private';
  ```

---

## Lote 2: Tablas de Configuración y Cuentas
- **Tablas**: `profiles`, `tenants`, `subscriptions`, `subscription_usage`, `plans_config`.
- **Preflight**:
  ```sql
  SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('profiles', 'tenants', 'subscriptions', 'plans_config');
  ```
- **Postflight**:
  Verificar que usuarios autenticados resuelvan correctamente su `tenant_id` y perfiles activos.

---

## Lote 3: Tablas Operativas Principales y Ventas
- **Tablas**: `products`, `orders`, `order_items`, `shipments`, `order_cancellations`, `inventory_items`, `inventory_movements`, `purchase_orders`, `purchase_order_items`, `monthly_expenses`.
- **Preflight**:
  Comprobar la existencia de índices en claves foráneas.
- **Postflight**:
  Validar flujo de visualización de catálogo y exportación de ventas (`/api/sales/export`).

---

## Lote 4: Tablas de Dominio Secundario y Automatización
- **Tablas**: `messages`, `alerts`, `ai_actions`, `action_workflows`, `workflow_steps`, `price_adjustment_workflows`, `price_adjustment_details`, `promotions`, `promotion_items`, `coupons`, `product_components`, `product_sku_components`, `product_extra_costs`, `product_price_history`, `stock_movements`, `tenant_progress`, `tenant_preferences`, `audit_logs`.
- **Preflight**:
  Validar que subconsultas `EXISTS` apunten a tablas padre con RLS activo.
- **Postflight**:
  Validar ejecución de workflows y creación de acciones del Command Center.

---

## Lote 5: Hardening de Credenciales e Integraciones
- **Tablas**: `meli_accounts`, `whatsapp_numbers`, `tenant_feature_flags`, `operation_runs`.
- **Acción**: `REVOKE SELECT` de tokens a `authenticated`, concesión de columnas operativas no sensibles.
- **Preflight**:
  Confirmar que todos los servicios de sincronización (`src/services/meli/*`) y Server Actions utilicen `createAdminClient()`.
- **Postflight**:
  Confirmar que la vista de configuración (`/dashboard/settings`, `/dashboard/integrations`) cargue el estado sin exponer `access_token`.
