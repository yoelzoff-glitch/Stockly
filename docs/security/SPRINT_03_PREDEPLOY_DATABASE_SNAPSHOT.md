# SPRINT 3 — PRE-DEPLOY DATABASE SNAPSHOT & SCHEMA BASELINE

## 1. Resumen de Políticas RLS Preexistentes (`pg_policies`)

| Tabla | Nombre de Política Preexistente | Comando | Definición / Expresión Previa | Estado para Sprint 3 |
| :--- | :--- | :--- | :--- | :--- |
| `monthly_expenses` | `"Users can read their tenant's monthly expenses"` | `SELECT` | `tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())` | **DEPRECADA / DROP REQUERIDO** (insegura: no verifica `is_active` ni schema `private`) |
| `monthly_expenses` | `"Users can insert their tenant's monthly expenses"` | `INSERT` | `tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())` | **DEPRECADA / DROP REQUERIDO** |
| `monthly_expenses` | `"Users can update their tenant's monthly expenses"` | `UPDATE` | `tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())` | **DEPRECADA / DROP REQUERIDO** |
| `monthly_expenses` | `"Users can delete their tenant's monthly expenses"` | `DELETE` | `tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())` | **DEPRECADA / DROP REQUERIDO** |
| `plans_config` | `"Anyone can read plans_config"` | `SELECT` | `true` | **REEMPLAZADA** por `plans_config_public_read` |

---

## 2. Privilegios de Tablas y Columnas (`information_schema.role_table_grants` & `column_privileges`)

### A. Tablas con Columnas Sensibles
- **`profiles`**:
  - Columnas administrativas: `tenant_id`, `role`, `is_active`, `id`, `email`.
  - Columnas editables por el usuario: `full_name`, `avatar_url`, `updated_at`.
  - Acción Sprint 3: `REVOKE UPDATE` general y conceder únicamente columnas editables a `authenticated`.
- **`tenants`**:
  - Columnas administrativas: `plan`, `status`, `id`, `activation_token`.
  - Columnas editables: `name`, `currency`, `timezone`, `updated_at`.
  - Acción Sprint 3: `REVOKE UPDATE` general y conceder únicamente columnas editables a `authenticated`.
- **`meli_accounts`**:
  - Columnas críticas: `access_token`, `refresh_token`.
  - Columnas operativas: `id`, `tenant_id`, `status`, `token_expires_at`, `sync_error`, `last_success_refresh`, `seller_id`, `nickname`.
  - Acción Sprint 3: `REVOKE SELECT` general y conceder únicamente columnas operativas a `authenticated`.
- **`whatsapp_numbers`**:
  - Columnas críticas: `access_token`, `verify_token`, `app_secret`.
  - Columnas operativas: `id`, `tenant_id`, `phone_number`, `status`, `display_name`, `created_at`, `updated_at`.
  - Acción Sprint 3: `REVOKE SELECT` general y conceder únicamente columnas operativas a `authenticated`.

---

## 3. Estado de RLS (`relrowsecurity` y `relforcerowsecurity`)
- Las tablas creadas en migraciones anteriores (`monthly_expenses`, `plans_config`, `tenant_feature_flags`, `operation_runs`) cuentan con RLS habilitado.
- El resto de las tablas operativas de la aplicación se habilitan y fuerzan explícitamente en la Migración C (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY; ALTER TABLE ... FORCE ROW LEVEL SECURITY;`).

---

## 4. Índices Existentes y Claves Foráneas
- `order_items`: `idx_order_items_tenant_order_meli` en `(tenant_id, meli_order_id, meli_item_id)`.
- `whatsapp_numbers`: `uq_whatsapp_numbers_tenant_phone` en `(tenant_id, phone_number)`.
- `order_cancellations`: `uq_order_cancellations_tenant_order` en `(tenant_id, meli_order_id)`.
- `tenant_feature_flags`: `uq_tenant_feature_flags_tenant_key` en `(tenant_id, flag_key)`.
- `operation_runs`: `idx_operation_runs_tenant_created` en `(tenant_id, created_at DESC)`.
