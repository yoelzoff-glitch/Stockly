# Recuperación de ventas y envíos — regresión Sprint 40

## Qué corrige

- Respaldo incremental cada 5 minutos, sin descartar ticks por su minuto real de ejecución. `LIBRETAX_ORDERS_RECONCILIATION_MODE=reduced` deja de demorar las ventas.
- Cada venta sincroniza sus propios envíos, reutilizando la respuesta de ML. No reactiva el barrido completo de 30 días.
- Errores de ML, páginas incompletas, lecturas de snapshots, escrituras de ítems y envíos generan fallos/reintentos; no se presentan como éxito ni avanzan el cursor.
- Los webhooks de órdenes recorren processing/retrying/completed/dead_letter. Una respuesta tardía del receptor no vuelve un evento completado a queued.
- Si llega primero el envío, se reintenta; la sincronización posterior de la orden también lo recupera.
- `persist_meli_shipment` serializa por orden, verifica tenant y shipment, conserva el ID existente y revierte íntegramente ante una escritura fallida. Las filas duplicadas del mismo pedido se consolidan dentro de esa transacción.
- La pantalla de detalle muestra rentabilidad pendiente cuando falta el envío/costo; no interpreta ese faltante como envío gratuito.

## Orden de despliegue (obligatorio)

1. Desde esta rama y con el proyecto Supabase correcto vinculado, revisar `npx supabase db push --dry-run` y aplicar `npx supabase db push`. La nueva migración es `20260922000000_reliable_order_shipments.sql`. Requiere las migraciones previas, incluyendo `meli_sync_state` del Sprint 40. No ejecutar el esquema completo de fixtures en producción.
2. Desplegar el código y confirmar en Inngest la sincronización del registro `/api/inngest`. Debe aparecer `orders-history-recovery`, además de los workers de órdenes y envíos.
3. Mantener `LIBRETAX_INCREMENTAL_ORDERS_SYNC=true` y `LIBRETAX_SHIPMENTS_FROM_ORDERS_FULL_SYNC=false`. No es necesario activar los barridos completos de envíos/cancelaciones.
4. El siguiente tick de 5 minutos encola la sincronización reciente y, en otra función, una reparación de los últimos 7 días por cuenta conectada. Cada orden histórica usa un step separado. Sólo se marca `orders_shipments_repair_v41` al completar todas sus órdenes/envíos. Las cuentas demo o con suscripción inactiva no se procesan.
5. Verificar las dos órdenes del incidente por su ID real en ML, incluyendo importe, ítems, modalidad, destino y costo del envío. Los IDs no fueron proporcionados para esta validación local.

Para iniciar la reparación sin esperar el cron, enviar desde Inngest (reemplazar TENANT_ID por el UUID verificado):

```json
{
  "name": "meli/orders.repair.requested",
  "data": {
    "tenantId": "TENANT_ID",
    "dateFrom": "2026-09-18T00:00:00.000Z",
    "repair": true
  }
}
```

Para una recuperación manual posterior/otra ventana, omitir `repair` (no usa ni modifica la marca de reparación única). El reconciliador profundo sigue ejecutándose cada 4 horas pero ahora despacha esta función, con reintentos por orden y sin cambiar el cursor incremental.

## Confirmación en producción

- Nueva orden disponible en la API de ML: comprobar webhook y worker completados y aparición en LibretaX. Objetivo operativo: menos de 10 minutos; el respaldo corre cada 5 minutos. Una caída de ML/Inngest/Supabase o datos que ML aún no publicó impide garantizar ese tiempo.
- Comprobar `webhook_events` por tenant/topic/resource (`event_data`) y `operation_runs` por tenant/operation_type. Un failed/dead_letter debe investigarse; no es una sincronización exitosa.
- Comprobar marca `meli_sync_state.resource_type = 'orders_shipments_repair_v41'` y estado de `orders-history-recovery` en Inngest.
- Comparar el costo almacenado con ML. Esta corrección conserva el criterio existente `shipping_option.list_cost/base_cost` y las zonas Flex; no redefine el modelo de cargos/subsidios de ML.
- Medir egress tras el despliegue. La frecuencia de respaldo aumenta, pero se conservan consultas incrementales, ausencia de syncs al navegar y envíos dirigidos.

## Validación local

```bash
npm run typecheck
npm test
npm run test:shipments:integration
node --import tsx scripts/audit-egress.ts
node --import tsx scripts/audit-inngest-registry.ts
node --import tsx scripts/audit-webhooks.ts
```

Las pruebas de servicios ejecutan código productivo con ML/Supabase simulados en sus límites. La prueba SQL ejecuta la migración y la función real en PostgreSQL embebido (PGlite): atomicidad, rollback, identidad, duplicados, aislamiento y permisos. Esto no reemplaza comprobar las dos órdenes reales después del despliegue.

La migración es aditiva; si se revierte sólo el código, se puede conservar la función SQL. Revertir al Sprint 40 reintroduce los defectos de sincronización descritos.
