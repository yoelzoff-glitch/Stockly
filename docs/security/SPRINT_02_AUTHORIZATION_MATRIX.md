# SPRINT 2/8 — MATRIZ DE SUPERFICIE DE AUTORIZACIÓN Y AISLAMIENTO DE ENDPOINTS

## 1. Visión General
Este documento clasifica e inventaría toda la superficie de ejecución de Klyvo (Rutas API en `src/app/api/**`, Server Actions en `src/actions/**` y `src/app/dashboard/**`, y servicios con cliente administrativo `service_role`).

### Taxonomía de Clasificación:
* **Usuario Autenticado y Vinculado a Tenant**: Requiere sesión activa del usuario (`supabase.auth.getUser()`) y resolución obligatoria de su tenant en el servidor (`profiles.tenant_id`).
* **Pública Intencional**: Rutas sin datos sensibles ni estado que responden públicamente (ej. liveness).
* **Machine-to-Machine / Token de Servicio**: Protegidas por tokens dedicados o secretos de infraestructura (ej. readiness healthcheck).
* **Webhook Externo**: Reciben eventos desde proveedores externos (Mercado Libre, Mercado Pago, Meta WhatsApp). La validación estricta de firmas HMAC y secretos está programada para el Sprint 4.
* **OAuth Callback**: Maneja el retorno del flujo de autorización de terceros.
* **Inngest**: Handlers de colas y cron jobs firmados con `INNGEST_SIGNING_KEY`.

---

## 2. Matriz de Rutas API (`src/app/api/**`)

| Entrada | Método | Autenticación | Fuente del tenant | Usa service_role | Roles Permitidos (Permisivo / Estricto) | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/health/live` | `GET` | Pública Intencional | N/A | No | Todos | Exenta (Sprint 1) |
| `/api/health/ready` | `GET` | Token de Servicio (`HEALTHCHECK_TOKEN`) | N/A | Sí (DB Ping) | Servicio | Exenta (Sprint 1.1) |
| `/api/meli/webhook` | `POST` | Webhook Externo (Validación estricta en Sprint 4) | `meli_accounts.user_id` | Sí | MeLi Webhook | Exenta (Validación HMAC pendiente Sprint 4) |
| `/api/mercadopago/webhook` | `POST` | Webhook Externo (Validación estricta en Sprint 4) | `subscriptions.mp_preapproval_id` | Sí | MP Webhook | Exenta (Validación Secret pendiente Sprint 4) |
| `/api/whatsapp/webhook` | `GET` | Verificación Webhook (`WHATSAPP_VERIFY_TOKEN`) | N/A | No | Meta Webhook | Exenta |
| `/api/whatsapp/webhook` | `POST` | Webhook Externo (Validación estricta en Sprint 4) | `whatsapp_numbers.phone_number` | Sí | Meta Webhook | Exenta (Validación HMAC pendiente Sprint 4) |
| `/api/inngest` | `GET/POST/PUT` | Inngest Signing Key (`INNGEST_SIGNING_KEY`) | Contexto del Evento/Job | Sí | Inngest Server | Exenta |
| `/api/meli/callback` | `GET` | OAuth Callback + Sesión de Usuario | `profiles.tenant_id` | Sí | Permisivo: Todos / Estricto: `owner`, `admin` | Protegida |
| `/api/meli/connect` | `GET` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | No | Permisivo: Todos / Estricto: `owner`, `admin` | Protegida |
| `/api/ai/actions/confirm` | `POST` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | Sí | `owner`, `admin`, `user` | **Protegida (Sprint 2)** |
| `/api/ai/actions/cancel` | `POST` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | Sí | `owner`, `admin`, `user` | **Protegida (Sprint 2)** |
| `/api/pricing/simulate` | `POST` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | Sí | `owner`, `admin`, `user` | **Protegida (Sprint 2)** |
| `/api/pricing/create-workflow` | `POST` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | Sí | Permisivo: Todos / Estricto: `owner`, `admin` | **Protegida (Sprint 2)** |
| `/api/workflows/execute` | `POST` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | Sí | Permisivo: Todos / Estricto: `owner`, `admin` | **Protegida (Sprint 2)** |
| `/api/profitability/recalculate` | `POST` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | Sí | Permisivo: Todos / Estricto: `owner`, `admin` | **Protegida (Sprint 2)** |
| `/api/meli/disconnect` | `POST` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | Sí | Permisivo: Todos / Estricto: `owner`, `admin` | **Protegida (Sprint 2)** |
| `/api/meli/sync-products` | `POST` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | Sí | `owner`, `admin`, `user` | **Protegida (Sprint 2)** |
| `/api/meli/sync-orders` | `POST` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | Sí | `owner`, `admin`, `user` | **Protegida (Sprint 2)** |
| `/api/ai/chat` | `POST` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | Sí | `owner`, `admin`, `user` | **Protegida (Sprint 2)** |
| `/api/ai/chat/clear` | `DELETE` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | Sí | `owner`, `admin`, `user` | **Protegida (Sprint 2)** |
| `/api/ai/product-chat` | `POST` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | Sí | `owner`, `admin`, `user` | **Protegida (Sprint 2)** |
| `/api/ai/product-title-suggestions`| `POST` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | No | `owner`, `admin`, `user` | **Protegida (Sprint 2)** |
| `/api/ai/competitor-analysis` | `POST` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | No | `owner`, `admin`, `user` | **Protegida (Sprint 2)** |
| `/api/products/[id]/components` | `GET` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | No | `owner`, `admin`, `user` | **Protegida (Sprint 2)** |
| `/api/products/[id]/stats` | `GET` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | No | `owner`, `admin`, `user` | **Protegida (Sprint 2)** |
| `/api/products/[id]/history` | `GET` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | No | `owner`, `admin`, `user` | **Protegida (Sprint 2)** |
| `/api/products/import-costs` | `POST` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | Sí | Permisivo: Todos / Estricto: `owner`, `admin` | **Protegida (Sprint 2)** |
| `/api/sales/export` | `GET` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | No | `owner`, `admin`, `user` | **Protegida (Sprint 2)** |
| `/api/export` | `GET` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | No | `owner`, `admin`, `user` | **Protegida (Sprint 2)** |

---

## 3. Matriz de Server Actions (`src/actions/**` & `src/app/dashboard/**`)

| Archivo / Módulo | Acciones Expuestas | Autenticación | Fuente del tenant | Usa service_role | Roles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `src/actions/product-command-actions.ts` | `preparePriceChangeAction`, `prepareStockChangeAction`, `prepareStatusChangeAction`, `prepareTitleChangeAction`, `confirmCommandCenterAction`, `cancelCommandCenterAction` | Usuario Autenticado | Sesión (`requireTenantContext`) | Sí | `owner`, `admin`, `user` |
| `src/actions/auth.ts` | `signIn`, `signUp`, `signOut` | Pública / Supabase Auth | Flujo de Registro / Login | Sí (para onboarding inicial) | Todos |
| `src/actions/activation.ts` | `activateAccount`, `validateActivationToken` | Token de Activación | `tenants.activation_token` | Sí | Nuevo Usuario |
| `src/actions/meli-connection.ts` | `getMeliConnectionStatus` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | No | `owner`, `admin`, `user` |
| `src/actions/settings.ts` | `updateTenantSettings`, `getTenantSettings` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | Sí | `owner`, `admin` |
| `src/app/dashboard/products/actions.ts` | `updateProductCost`, `updateProductTags`, `bulkUpdateCosts` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | Sí | `owner`, `admin` |
| `src/app/dashboard/internal-stock/actions.ts` | `createInternalProduct`, `adjustInternalStock`, `registerSupplierPurchase` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | Sí | `owner`, `admin` |
| `src/app/dashboard/promotions/actions.ts` | `applyPromotion`, `removePromotion` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | Sí | `owner`, `admin` |
| `src/app/dashboard/purchases/actions.ts` | `createPurchaseOrder`, `updatePurchaseStatus` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | Sí | `owner`, `admin` |
| `src/app/dashboard/settings/costs/actions.ts` | `saveGeneralCostsConfig`, `saveCategoryCosts` | Usuario Autenticado | Sesión (`profiles.tenant_id`) | Sí | `owner`, `admin` |

---

## 4. Justificación de Excepciones sin Sesión de Usuario

1. **`/api/health/live`**: Endpoint de liveness para orquestadores (Kubernetes, AWS, Vercel). No ejecuta consultas a base de datos ni expone información interna.
2. **`/api/health/ready`**: Endpoint de readiness protegido por token Bearer / `x-healthcheck-token` (`HEALTHCHECK_TOKEN`). No depende de sesión de usuario ya que es consultado por sistemas de monitoreo automáticos.
3. **`/api/meli/webhook`, `/api/mercadopago/webhook`, `/api/whatsapp/webhook`**: Invocados directamente por servidores de Mercado Libre, Mercado Pago y Meta. No tienen sesión de usuario. Su validación criptográfica estricta (firmas HMAC / secretos) forma parte del alcance del **Sprint 4**.
4. **`/api/inngest`**: Invocado por el runtime de Inngest para ejecución de background jobs y crons. Autenticado mediante `INNGEST_SIGNING_KEY`.
5. **`/api/meli/callback`**: Endpoint de redirección OAuth donde Mercado Libre envía el `code` de autorización para vincular la cuenta.
