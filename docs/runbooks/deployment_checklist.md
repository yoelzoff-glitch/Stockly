# DEPLOYMENT CHECKLIST — KLYVO PRODUCTION

Este checklist debe ser ejecutado en cada despliegue a producción para asegurar compatibilidad y cero downtime para los usuarios activos.

---

## 1. PRE-DEPLOYMENT
- [ ] **1.1 Validaciones Locales:**
  - `npm run verify:sprint1` (ejecuta typecheck y suite de tests unitarios).
  - `npm run check:env` (verifica que las variables necesarias estén configuradas).
- [ ] **1.2 Base de Datos:**
  - Backup reciente verificado en Supabase.
  - Ejecución de `supabase/diagnostics/production_preflight.sql` en modo lectura.
  - Aplicación de migraciones aditivas en Supabase SQL Editor.
  - Confirmación de que las nuevas tablas existen y están vacías.
- [ ] **1.3 Configuración y Secretos:**
  - `HEALTHCHECK_TOKEN` configurado en las variables de entorno de producción.
  - Kill switches en `false` o no definidos (`KLYVO_DISABLE_*`).

---

## 2. DEPLOYMENT EXECUTION
- [ ] **2.1 Despliegue de Código:**
  - Merge a `main` o deploy manual en Vercel.
  - Monitoreo del build sin advertencias bloqueantes.

---

## 3. POST-DEPLOYMENT VERIFICATION
- [ ] **3.1 Health Checks:**
  - `curl -i https://app.klyvo.com/api/health/live` (debe responder HTTP 200 con `status: "ok"`).
  - `curl -i -H "Authorization: Bearer <TOKEN>" https://app.klyvo.com/api/health/ready` (debe responder HTTP 200 con `status: "ready"`).
- [ ] **3.2 Smoke Tests Funcionales:**
  - Login exitoso del usuario de producción.
  - Dashboard carga ventas, productos y métricas de margen sin discrepancias.
  - Sincronización manual de productos y órdenes ejecutada con éxito.
  - Inngest Dashboard muestra jobs periódicos ejecutando normalmente.
  - Webhooks de Mercado Libre y Mercado Pago respondiendo HTTP 200.
- [ ] **3.3 Observabilidad y Tablas Nuevas:**
  - Verificar que `operation_runs` recibe registros de sincronización con `status = 'completed'` y metadata sanitizada.
  - Verificar que ningún log expone tokens o datos sensibles.
  - Confirmar que ningún feature flag nuevo está activo.

---

## 4. PERIODO DE OBSERVACIÓN (24 HORAS)
- [ ] Monitorear tasa de errores 4xx/5xx en Sentry.
- [ ] Monitorear sincronizaciones periódicas de stock.
- [ ] Confirmar estabilidad antes de iniciar el siguiente sprint.
