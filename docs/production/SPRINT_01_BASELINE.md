# BASELINE FUNCIONAL Y TÉCNICO DE PRODUCCIÓN (SPRINT 01)

## 1. Introducción y Propósito
Este documento establece la línea base (*baseline*) del comportamiento del sistema SaaS Klyvo en producción. Describe el estado funcional exacto de todos los flujos críticos antes de la introducción de las mejoras de seguridad, observabilidad y arquitectura de los Sprints 1 a 8.

Cualquier cambio futuro debe ser contrastado contra los comportamientos, tablas y métricas aquí descritos para prevenir regresiones que impacten al usuario en producción.

---

## 2. Inventario de Flujos Críticos

### 2.1 Login
* **Punto de entrada:** `/login`, `/auth/callback`, `src/app/login/page.tsx`, `src/middleware.ts`.
* **Servicios involucrados:** Supabase Auth (`supabase.auth.signInWithPassword`, `supabase.auth.exchangeCodeForSession`).
* **Tablas afectadas:** `auth.users`, `public.profiles`.
* **APIs externas:** Supabase GoTrue API.
* **Efectos secundarios:** Establecimiento de cookies de sesión (`sb-*-auth-token`), redirección al `/dashboard`.
* **Comportamiento esperado:** Usuario autenticado accede al dashboard con su sesión activa. Credenciales inválidas muestran mensaje descriptivo sin exponer datos internos.
* **Métrica / Evidencia de regresión:** Tasa de éxito en login > 99%. Ausencia de bucles de redirección en `/login`.

---

### 2.2 Registro
* **Punto de entrada:** `/register`, `src/app/register/page.tsx`.
* **Servicios involucrados:** Supabase Auth (`supabase.auth.signUp`), triggers de creación de perfil/tenant.
* **Tablas afectadas:** `auth.users`, `public.tenants`, `public.profiles`, `public.subscriptions`, `public.tenant_preferences`.
* **APIs externas:** Supabase GoTrue API.
* **Efectos secundarios:** Creación de tenant inicial con plan por defecto (`starter`), perfil con rol `owner`.
* **Comportamiento esperado:** Creación atómica del usuario y su tenant asociado.
* **Métrica / Evidencia de regresión:** Registro exitoso sin usuarios "huérfanos" (sin tenant asignado).

---

### 2.3 Onboarding
* **Punto de entrada:** `/onboarding`, `src/app/onboarding/page.tsx`.
* **Servicios involucrados:** `src/services/tenants/updateTenant.ts`, `tenant_progress` trackers.
* **Tablas afectadas:** `public.tenants`, `public.tenant_progress`, `public.tenant_preferences`.
* **APIs externas:** Ninguna directa (previo a conectar canales).
* **Efectos secundarios:** Registro de pasos completados (`step: 'connect_meli'`, `step: 'inventory_setup'`).
* **Comportamiento esperado:** Persistencia del progreso de onboarding; redirección al dashboard al finalizar.
* **Métrica / Evidencia de regresión:** `tenant_progress` actualizado correctamente sin bloquear navegación.

---

### 2.4 Dashboard y Métricas
* **Punto de entrada:** `/dashboard`, `/dashboard/sales`, `/dashboard/products`, Server Components en `src/app/dashboard/*`.
* **Servicios involucrados:** `src/services/analytics/*`, `src/services/profitability/*`, `src/lib/dates.ts`.
* **Tablas afectadas:** Sólo lectura sobre `public.orders`, `public.order_items`, `public.products`, `public.monthly_expenses`, `public.subscriptions`.
* **APIs externas:** Ninguna (renderiza datos persistidos).
* **Efectos secundarios:** Ninguno (operación de sólo lectura).
* **Comportamiento esperado:** Visualización consistente de facturación, ganancias estimadas, márgenes porcentuales y volumen de órdenes dentro del rango de fechas seleccionado (zona horaria `America/Argentina/Buenos_Aires`).
* **Métrica / Evidencia de regresión:** Totales numéricos idénticos ante iguales rangos de fechas. Tiempo de respuesta TTFB < 1.5s.

---

### 2.5 Sincronización Manual de Productos
* **Punto de entrada:** `POST /api/meli/sync-products`, botón de sincronización en `/dashboard/products`.
* **Servicios involucrados:** `src/services/meli/syncProducts.ts`, `src/services/meli/client.ts`, `src/services/profitability/calculateRealProfitability.ts`.
* **Tablas afectadas:** `public.products`, `public.product_price_history`, `public.product_components`.
* **APIs externas:** Mercado Libre REST API (`/users/{user_id}/items/search`, `/items?ids=...`, `/items/{id}/shipping_options`).
* **Efectos secundarios:** Actualización de catálogo de publicaciones, cálculo de margen base y margen real, inserción en historial de precios si varió el valor.
* **Comportamiento esperado:** Productos existentes actualizan `price`, `available_quantity`, `status`, `last_synced_at`. Nuevos productos se insertan.
* **Métrica / Evidencia de regresión:** Recuento de productos activos en Klyvo coincide con publicaciones activas en Mercado Libre.

---

### 2.6 Sincronización Manual de Órdenes
* **Punto de entrada:** `POST /api/meli/sync-orders`, botón de sincronización en `/dashboard/sales`.
* **Servicios involucrados:** `src/services/meli/syncOrders.ts`, `src/services/inventory/decrementInternalStockFromOrder.ts`.
* **Tablas afectadas:** `public.orders`, `public.order_items`, `public.shipments`, `public.inventory_items`, `public.inventory_movements`.
* **APIs externas:** Mercado Libre REST API (`/orders/search`, `/shipments/{id}`).
* **Efectos secundarios:** Inserción de órdenes y sus ítems; deducción de stock interno atada a `internal_stock_processed = true`.
* **Comportamiento esperado:** Órdenes cerradas/pagadas registradas sin duplicación; movimientos de stock generados una única vez por orden.
* **Métrica / Evidencia de regresión:** Cero órdenes duplicadas (`meli_order_id` único por tenant).

---

### 2.7 Sincronización Programada (Inngest Cron Jobs)
* **Punto de entrada:** Handlers de Inngest en `src/jobs/*` vía `/api/inngest`.
* **Servicios involucrados:** `syncProductsJob.ts`, `syncOrdersJob.ts`, `questionsJob.ts`, `massPromotionsJob.ts`, `competitorAnalysisJob.ts`, `cleanupZombieUsersJob.ts`, `applySubscriptionDowngradesJob.ts`.
* **Tablas afectadas:** Múltiples tablas operativas según el job.
* **APIs externas:** Mercado Libre, OpenAI, Gemini.
* **Efectos secundarios:** Ejecución periódica según cron expressions en Inngest Cloud / Dev Server.
* **Comportamiento esperado:** Ejecución no bloqueante por tenant con reintentos configurados.
* **Métrica / Evidencia de regresión:** Tasa de éxito de jobs en Inngest Dashboard > 98%.

---

### 2.8 Procesamiento de Webhooks
* **Punto de entrada:** `POST /api/meli/webhook`, `POST /api/mercadopago/webhook`, `POST /api/whatsapp/webhook`.
* **Servicios involucrados:** Handlers de notificación en tiempo real, `syncOrders.ts`, `syncProducts.ts`, `src/services/messages/*`.
* **Tablas afectadas:** `public.orders`, `public.products`, `public.subscriptions`, `public.messages`, `public.whatsapp_numbers`.
* **APIs externas:** Mercado Libre, Mercado Pago, Meta WhatsApp Cloud API.
* **Efectos secundarios:** Actualización reactiva de estado de órdenes, cambios de publicación, recepción de mensajes de chat o confirmaciones de pago de suscripción.
* **Comportamiento esperado:** Retorno de HTTP 200 rápido a los proveedores (< 1.5s) y procesamiento asíncrono o inmediato según flujo.
* **Métrica / Evidencia de regresión:** Ausencia de timeouts HTTP 504 o reintentos masivos de webhooks externos.

---

### 2.9 Renovación de Tokens de Mercado Libre
* **Punto de entrada:** `src/jobs/refreshMeliTokensJob.ts`, `src/services/meli/refreshToken.ts`.
* **Servicios involucrados:** `refreshToken.ts`.
* **Tablas afectadas:** `public.meli_accounts`.
* **APIs externas:** Mercado Libre OAuth (`https://api.mercadolibre.com/oauth/token`).
* **Efectos secundarios:** Actualización de `access_token`, `refresh_token` y `token_expires_at` (~6 horas de vigencia).
* **Comportamiento esperado:** Renovación proactiva de tokens próximos a expirar sin requerir re-autenticación del usuario.
* **Métrica / Evidencia de regresión:** Cero errores `401 Unauthorized` por tokens expirados en llamadas MeLi de usuarios activos.

---

### 2.10 Cálculo de Rentabilidad y Precios
* **Punto de entrada:** `src/services/profitability/calculateRealProfitability.ts`, `src/services/pricing/calculateTargetPrice.ts`.
* **Servicios involucrados:** Motor matemático de costos, comisiones, envíos, impuestos y promociones.
* **Tablas afectadas:** `public.products` (`margin_amount`, `margin_percent`, `profit_real_estimated`, `profit_real_margin`, `profitability_status`).
* **APIs externas:** Ninguna (algoritmo interno determinista).
* **Efectos secundarios:** Cálculo y persistencia de métricas financieras.
* **Comportamiento esperado:** 
  - Retorna estado `missing_cost`, `missing_fee` o `missing_shipping` si faltan componentes esenciales.
  - Retorna `margin_amount` y `margin_percent` con 2 decimales ante datos completos.
* **Métrica / Evidencia de regresión:** Resultados exactos verificados por suite de tests unitarios deterministas.

---

### 2.11 Inventario Interno y BOM (Bill of Materials)
* **Punto de entrada:** `/dashboard/inventory`, `src/services/inventory/*`.
* **Servicios involucrados:** `src/services/products/sku/normalizeSku.ts`, `parseCompositeSku.ts`.
* **Tablas afectadas:** `public.inventory_items`, `public.product_components`, `public.inventory_movements`, `public.purchase_orders`.
* **APIs externas:** Ninguna.
* **Efectos secundarios:** Asociación de publicaciones con componentes base de stock (ej. combo 2x = 2 unidades del componente).
* **Comportamiento esperado:** Mapeo consistente vía `sku_normalized`.
* **Métrica / Evidencia de regresión:** Integridad referencial entre `product_components` e `inventory_items`.

---

### 2.12 Descuento de Stock por Venta
* **Punto de entrada:** `src/services/inventory/decrementInternalStockFromOrder.ts`.
* **Servicios involucrados:** Procesador de órdenes cerradas.
* **Tablas afectadas:** `public.orders`, `public.inventory_items`, `public.inventory_movements`.
* **APIs externas:** Ninguna.
* **Efectos secundarios:** Inserción de `inventory_movements` con `movement_type: 'sale_confirmed'`, deducción de `current_stock`, marca de `orders.internal_stock_processed = true`.
* **Comportamiento esperado:** Ejecución idempotente: no descontar stock más de una vez por orden.
* **Métrica / Evidencia de regresión:** Sin movimientos duplicados con el mismo `reference_id` (order_id).

---

### 2.13 Reversión por Cancelación
* **Punto de entrada:** `src/services/inventory/revertInternalStockFromCancelledOrder.ts`.
* **Servicios involucrados:** Manejador de órdenes canceladas.
* **Tablas afectadas:** `public.orders`, `public.order_cancellations`, `public.inventory_items`, `public.inventory_movements`.
* **APIs externas:** Mercado Libre (`/orders/{id}`).
* **Efectos secundarios:** Inserción en `order_cancellations`, creación de movimiento de stock `movement_type: 'return'`, incremento de `current_stock`.
* **Comportamiento esperado:** Reversión atómica y una sola vez por orden cancelada previamente procesada.
* **Métrica / Evidencia de regresión:** Coincidencia entre órdenes canceladas y movimientos de retorno asociados.

---

### 2.14 Acciones de IA y Confirmación de Cambios
* **Punto de entrada:** `src/services/ai/agent.ts`, `src/services/ai/actions/confirm.ts`, `/api/ai/*`.
* **Servicios involucrados:** OpenAI API / Google Gemini, ejecutor de acciones con guardrails.
* **Tablas afectadas:** `public.action_workflows`, `public.ai_actions`, `public.workflow_steps`, `public.products`.
* **APIs externas:** OpenAI (`gpt-4o-mini`), Mercado Libre (`PUT /items/{id}`).
* **Efectos secundarios:** Generación de propuestas de ajuste de precio/título/stock que requieren confirmación explícita del usuario antes de impactar en Mercado Libre.
* **Comportamiento esperado:** Sin ejecución no supervisada; registro de cambios en `product_price_history`.
* **Métrica / Evidencia de regresión:** Cero llamadas de modificación a Mercado Libre sin `ai_actions.status = 'completed'`.

---

### 2.15 Exportaciones
* **Punto de entrada:** `GET /api/sales/export`, `GET /api/export/*`.
* **Servicios involucrados:** `xlsx` generator.
* **Tablas afectadas:** Lectura de `public.orders`, `public.order_items`, `public.products`.
* **APIs externas:** Ninguna.
* **Efectos secundarios:** Generación y descarga de archivo `.xlsx` o `.csv`.
* **Comportamiento esperado:** Descarga con `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` y datos consistentes con la vista web.
* **Métrica / Evidencia de regresión:** Formato de archivo válido y datos concordantes con filtros.

---

### 2.16 Suscripciones y Facturación
* **Punto de entrada:** `/dashboard/billing`, `src/integrations/mercadopago/client.ts`, `src/services/billing/checkLimits.ts`.
* **Servicios involucrados:** Mercado Pago Preapproval API, tracker de límites de suscripción.
* **Tablas afectadas:** `public.subscriptions`, `public.subscription_usage`, `public.plans_config`.
* **APIs externas:** Mercado Pago Subscriptions API (`/preapproval_plan`, `/preapproval`).
* **Efectos secundarios:** Bloqueo de features al superar límites mensuales de plan; actualización de estado de suscripción vía webhooks de Mercado Pago.
* **Comportamiento esperado:** Respeto estricto de los límites configurados en `plans_config` sin alterar el acceso de usuarios con suscripción activa.
* **Métrica / Evidencia de regresión:** Consistencia entre estado en Mercado Pago y `subscriptions.status`.

---

## 3. Matriz de Seguridad y Políticas de No Regresión

| Componente | Nivel de Riesgo | Estrategia de Mitigación en Sprint 1 |
| :--- | :--- | :--- |
| **Autenticación y Sesiones** | Crítico | Mantener cliente Supabase y cookies sin alterar. Sin cambios en middleware. |
| **Cálculo de Rentabilidad** | Crítico | Envolver con tests unitarios deterministas. Cero cambios en fórmulas. |
| **Sincronización MeLi** | Crítico | Mantener `meliFetch` idéntico. Agregar Correlation ID y Operation Runs no bloqueantes. |
| **Inventario y Stock** | Crítico | No alterar lógica transaccional hasta Sprint 5. Auditar con queries de solo lectura. |
| **Webhooks** | Crítico | Mantener modo tolerante actual. No activar validación fail-closed hasta Sprint 4. |
| **Feature Flags / Kill Switches**| Alto | Nacer desactivados (`false`). Fallbacks silenciosos ante fallos de BD o config. |
