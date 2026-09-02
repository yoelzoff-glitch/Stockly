# SPRINT 3/8 — MATRIZ DE AUDITORÍA DE SERVICE_ROLE (`createAdminClient`)

## 1. Propósito y Principios de Uso
El cliente `createAdminClient()` utiliza la clave `SUPABASE_SERVICE_ROLE_KEY` que cuenta con el atributo PostgreSQL `BYPASSRLS`. Su uso debe estar estrictamente justificado, precedido de autenticación del usuario o del sistema, y todas las operaciones deben estar acotadas al `tenant_id` resuelto en el servidor.

---

## 2. Inventario de Módulos que Utilizan `createAdminClient`

| Módulo / Archivo | Propósito Operativo | Tipo de Invocación | ¿Cómo se Resuelve el Tenant? | Filtro `tenant_id` Aplicado | ¿Expone Secretos al Cliente? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `src/services/meli/syncProducts.ts` | Sincronización de publicaciones y creación de componentes | Manual / Inngest | Parámetro `tenantId` derivado por el servidor | `.eq("tenant_id", tenantId)` en todas las queries | No |
| `src/services/meli/syncOrders.ts` | Sincronización de órdenes y stock | Manual / Inngest / Webhook | Parámetro `tenantId` derivado por el servidor | `.eq("tenant_id", tenantId)` en todas las queries | No |
| `src/services/meli/syncShipments.ts` | Sincronización de envíos | Inngest / Sync | Parámetro `tenantId` derivado | `.eq("tenant_id", tenantId)` | No |
| `src/services/meli/syncCancellations.ts`| Sincronización de cancelaciones | Inngest / Sync | Parámetro `tenantId` derivado | `.eq("tenant_id", tenantId)` | No |
| `src/services/meli/client.ts` | Obtención de tokens MeLi y ejecución de llamadas HTTP a MeLi | Core MeLi API | Parámetro `tenantId` explícito | `.eq("tenant_id", tenantId)` en `meli_accounts` | No |
| `src/services/meli/refreshToken.ts` | Renovación OAuth de access tokens | Background / Auto | Parámetro `tenantId` explícito | `.eq("tenant_id", tenantId)` | No |
| `src/services/inventory/*` | Deducción, reversión y recálculo de stock físico | Triggers / Sync / Commands | Parámetro `tenantId` explícito | `.eq("tenant_id", tenantId)` | No |
| `src/services/billing/checkLimits.ts` | Control de límites de plan y consumo mensual de IA | Server Actions / API | Parámetro `tenantId` explícito | `.eq("tenant_id", tenantId)` | No |
| `src/services/ai/workflows.ts` | Ejecución atómica de workflows aprobados | API `/api/workflows/execute` | `context.tenantId` derivado en servidor | `.eq("tenant_id", tenantId)` | No |
| `src/services/ai/tools/*` | Herramientas de agente para consulta de ventas y productos | Agente IA | Parámetro `tenantId` explícito | `.eq("tenant_id", tenantId)` | No |
| `src/lib/safety/operationRuns.ts` | Registro de auditoría de ejecuciones de sync | Logging Interno | `tenantId` explícito | `.eq("tenant_id", tenantId)` | No |
| `src/lib/safety/featureFlags.ts` | Consulta de feature flags por tenant | Middleware / Helpers | `tenantId` explícito | `.eq("tenant_id", tenantId)` | No |
| `src/app/api/whatsapp/webhook/*` | Ingesta de mensajes de WhatsApp | Webhook Externo | Lookup por número de teléfono en `whatsapp_numbers` | Aislado por tenant de la cuenta receptora | No (Sprint 4 validación estricta) |
| `src/app/api/mercadopago/webhook/*` | Ingesta de notificaciones de suscripción | Webhook Externo | Lookup por suscripción en `subscriptions` | Aislado por tenant de la suscripción | No (Sprint 4 validación estricta) |

---

## 3. Conclusiones de la Auditoría
1. **Ningún endpoint de usuario invoca `createAdminClient()` antes de verificar la sesión con `requireTenantContext` o `requireTenantRole`**.
2. **Ningún servicio administrativo confía en `tenant_id` recibido directamente del cliente sin comprobación `assertRequestedTenant()`**.
3. **Las tablas backend-only (`tenant_feature_flags`, `operation_runs`) son manipuladas exclusivamente mediante `service_role`**.
