# Ejecución temporal en Vercel

Estado: implementación local; requiere migraciones y despliegue. Inngest se
conserva para rollback, pero queda deshabilitado por defecto.

## Presupuesto de trabajo

- Un respaldo cada **45 minutos exactos**, 32 invocaciones diarias. Las cuatro
  expresiones de `vercel.json` cubren el ciclo; `*/45` no significa cada 45 minutos.
- Ventas y envíos: webhook, con cola persistente y recuperación por cron.
- Productos: los avisos sólo marcan el catálogo pendiente. Se revisa cada 45
  minutos y se sincroniza sólo si cambió o lleva seis horas sin actualización.
- Renovación de tokens: revisión cada 45 minutos; sólo renueva los próximos a
  vencer según la ventana existente de 90 minutos.
- Histórico de órdenes: una vez al día, conservando la ventana de siete días.
- Barrido de envíos: cada seis horas. Cancelaciones: cada tres horas.
- Limpieza de usuarios: diaria. Suscripciones: revisión horaria, atendida en el
  siguiente tick disponible. Reposición Full conserva su programación diaria.
- Máximo dos trabajos simultáneos en toda la aplicación. Mantenimiento pesado
  sólo comienza con un cupo libre adicional, reservado para eventos urgentes.
- Cada webhook inicia como máximo tres trabajos urgentes; no ejecuta barridos
  históricos. Cada cron inicia como máximo veinte trabajos.
- Presupuesto para iniciar nuevos pasos: 30 segundos en webhook y 180 segundos
  en cron. No es un timeout de las llamadas ya iniciadas; Vercel limita la función
  completa a 300 segundos. Una interrupción conserva los pasos completados y el
  trabajo se recupera tras vencer el lease.
- Envío de tareas por lotes en una escritura; consultas de estado de productos
  por lote. No se escribe telemetría por cada catálogo sin cambios.
- Recibos de trabajos completados: siete días; pasos liberados al completar y
  limpieza diaria. Fallos y pendientes no se eliminan.

## Activación

1. Aplicar únicamente las migraciones de esta función, en orden:
   `20261117000000_vercel_background_jobs.sql` y
   `20261117000001_background_budget.sql`. No aplicar cambios ajenos pendientes.
2. Configurar `CRON_SECRET` aleatorio en producción. Mantener
   `LIBRETAX_BACKGROUND_PROVIDER=vercel` (también es el valor predeterminado).
3. Confirmar que el plan existente de Vercel permite cron subdiario. Hobby sólo
   admite cron diario; esta configuración no compra ni cambia ningún plan.
4. Desplegar y pausar el registro de la aplicación en Inngest para evitar sus
   invocaciones residuales. `/api/inngest` rechaza ejecuciones en modo Vercel.
5. Invocar `/api/cron/background` con `Authorization: Bearer $CRON_SECRET` desde
   un cliente seguro. Verificar órdenes, envíos, watermark y trabajos pendientes.
6. Verificar la siguiente ejecución programada. La recuperación inicial y la
   revisión diaria cubren siete días; períodos anteriores necesitan una reparación
   explícita. Los webhooks antiguos de Inngest no se trasladan automáticamente.

El intervalo limita el respaldo: ante una notificación perdida o fallida puede
haber al menos 45 minutos de demora, más el tiempo de la cola. No se promete
coste cero: el consumo real depende del volumen y duración de las llamadas.

## Rollback

Detener/drenar primero la cola Vercel, cambiar el proveedor a `inngest`, desplegar
y registrar nuevamente Inngest. No habilitar ambos consumidores a la vez. Los
crons Vercel no procesan trabajo si el proveedor está configurado como Inngest.
