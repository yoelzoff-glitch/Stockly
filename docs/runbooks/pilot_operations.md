# RUNBOOK: OPERACIÓN DEL PROGRAMA PILOTO (PILOT OPERATIONS)

## 1. Visión General del Piloto

Este runbook define los procedimientos operativos, checklists de incorporación, monitoreo diario y protocolos de respuesta ante incidentes para la fase de prueba piloto con 3 a 5 cuentas reales de Mercado Libre en Klyvo.

---

## 2. Checklist de Incorporación de un Nuevo Tenant (Onboarding)

### 2.1 Pre-Requisitos de la Cuenta de Mercado Libre
- [ ] La cuenta debe ser de tipo vendedor activo (MercadoLíder, Platinum, Gold o estándar).
- [ ] Credenciales OAuth listas para autorizar en Mercado Libre.
- [ ] No tener sincronizaciones concurrentes conflictivas con otros ERPs sobre los mismos ítems.

### 2.2 Procedimiento de Alta
1. **Registro:** El usuario se registra en `/register` creando su perfil y tenant correspondiente.
2. **Conexión OAuth:** Acceder a `/dashboard/integrations` y hacer clic en **Conectar Mercado Libre**.
3. **Validación de Token:** Verificar en `public.meli_accounts` que el registro figure con `status = 'connected'` y `token_expires_at` a 6 horas en el futuro.
4. **Disparo de Primera Sincronización:**
   - Se encola automáticamente el evento `meli/tenant.sync-products.requested` y `meli/tenant.sync-orders.requested`.
5. **Verificación de Progreso:**
   - Confirmar en `/dashboard/products` que el catálogo cargó correctamente (incluso si la cuenta tiene 0 ventas).
   - Validar en `/dashboard/sales` que las órdenes de los últimos 30 días se reflejen fielmente.

---

## 3. Monitoreo Diario Durante el Piloto

Cada mañana durante la fase piloto, el operador de turno debe verificar:

| Componente | Qué Inspeccionar | Estado Esperado | Acción si Falla |
| :--- | :--- | :--- | :--- |
| **Inngest Dashboard** | Pestaña *Functions* y *Runs* | 0 funciones en estado `failed` | Revisar logs de la función específica y correlation ID. |
| **`operation_runs`** | `SELECT status, count(*) FROM operation_runs WHERE started_at > now() - interval '24 hours' GROUP BY status;` | `completed > 98%`, `failed < 2%` | Ejecutar script de reconciliación (`reconcileTenantSyncState`). |
| **Tokens MELI** | `SELECT nickname, token_expires_at, status FROM meli_accounts;` | Todos con `token_expires_at > now()` | Disparar job manual de refresh token (`refreshMeliTokensJob`). |
| **DLQ Webhooks** | `SELECT count(*) FROM webhook_events WHERE status = 'dead_letter';` | `0` | Inspeccionar payload fallido y reintentar si fue transitorio. |
| **Sentry** | Tasa de errores HTTP 500 | `< 0.5%` de requests | Identificar si el error es de un tenant aislado. |

---

## 4. Diagnóstico y Resolución de Incidencias

### 4.1 Detección de una Venta que no Aparece
Si un vendedor reporta que una venta realizada en Mercado Libre no figura en Klyvo:
1. Obtener el `meli_order_id` de la venta.
2. Buscar en la base de datos si el webhook llegó:
   ```sql
   SELECT id, status, received_at, payload 
   FROM public.webhook_events 
   WHERE payload->>'resource' LIKE '%/orders/<ORDER_ID>%';
   ```
3. **Si el webhook existe en `dead_letter`:** Revisar el `last_error_message` en la fila y re-despachar el evento a Inngest.
4. **Si el webhook no existe:** Disparar una sincronización puntual de la orden:
   ```bash
   # Vía llamada autenticada o job específico
   POST /api/meli/sync-orders con { orderId: "<ORDER_ID>" }
   ```

### 4.2 Tokens de Mercado Libre Vencidos
Si un tenant no pudo refrescar su token automáticamente (e.g. contraseña de Mercado Libre cambiada por el usuario):
1. El estado de la cuenta pasará a `disconnected` o `expired`.
2. Las tareas de fondo abortarán inmediatamente en modo *fail-fast* (sin reintentos destructivos).
3. Notificar al usuario para ingresar a `/dashboard/integrations` y hacer clic en **Reconectar cuenta**.

### 4.3 Desconexión de Cuenta sin Pérdida Histórica
Cuando un usuario decide desconectar su cuenta de Mercado Libre:
1. La acción actualiza `public.meli_accounts.status = 'disconnected'`.
2. **NUNCA se borran** las órdenes (`public.orders`), movimientos (`public.inventory_movements`) ni productos históricos.
3. Se desactivan los webhooks y cron workers para ese tenant específico.

---

## 5. Criterios de Detención del Piloto (Kill Switches)

Se detendrá temporalmente el piloto si se cumple cualquiera de las siguientes condiciones:
1. **Discrepancia en Stock:** Modificación accidental o deducción incorrecta de stock en Mercado Libre.
2. **Saturación de Cuotas de API:** Mercado Libre responde 429 de forma masiva afectando a múltiples tenants.
3. **Falla en Aislamiento Multitenant:** Cualquier indicio de fuga de datos entre cuentas.

### Acciones Inmediatas de Detención:
```bash
# Activar kill switches en variables de Vercel
KLYVO_DISABLE_MELI_SYNC=true
KLYVO_DISABLE_MELI_WRITES=true
```
