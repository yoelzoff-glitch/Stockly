# RUNBOOK: GESTIÓN Y RESPUESTA A INCIDENTES (INCIDENT RESPONSE)

## 1. Protocolo de Gestión de Incidentes

Este runbook define los niveles de severidad, canales de escalamiento y procedimientos de respuesta ante alertas e incidentes operativos en Klyvo.

### Niveles de Severidad
- **SEV-1 (Crítica):** Plataforma caída, login bloqueado para todos los tenants, corrupción de base de datos o fallos generalizados en sincronización de stock con riesgo de sobreventa.
- **SEV-2 (Mayor):** Fallo en webhook de órdenes de Mercado Libre, degradación notable de latencia (P95 > 2s) o facturación bloqueada.
- **SEV-3 (Menor):** Fallos intermitentes en consultas analíticas no críticas o errores aislados en exportación de reportes.

---

## 2. Matriz de Alertas Operacionales

| Alerta | Severidad | Umbral de Disparo | Ventana de Evaluación | Acción Inmediata | Runbook Asociado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Aumento de HTTP 500** | SEV-1 | `> 1%` del total de requests o `> 10` errores/min | 5 minutos | Revisar logs en Sentry y Vercel. Si fue introducido por el último deploy, ejecutar Instant Rollback en Vercel. | [deployment_checklist.md](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/docs/runbooks/deployment_checklist.md) |
| **P95 Elevado** | SEV-2 | `P95 > 1200ms` en endpoints del dashboard o API | 5 minutos | Verificar contención de conexiones o queries pesadas en PostgreSQL (`pg_stat_activity`). Activar modo sombra si aplica. | [SPRINT_06_BASELINE.md](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/docs/performance/SPRINT_06_BASELINE.md) |
| **Fallos Consecutivos de Sincronización** | SEV-1 | `> 3` fallos consecutivos en job de sincronización de stock por tenant | 15 minutos | Verificar estado de tokens de Mercado Libre en `meli_accounts`. Si hay rate limit externo, activar pausa de sincronización. | [disaster_recovery.md](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/docs/runbooks/disaster_recovery.md) |
| **Tokens de Mercado Libre por Expirar** | SEV-2 | Token con `expires_at < now() + 2 hours` sin refresh exitoso | 30 minutos | Ejecutar job manual de refresh token o solicitar re-autenticación OAuth al tenant vía notificación. | [SPRINT_04_WEBHOOK_THREAT_MODEL.md](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/docs/security/SPRINT_04_WEBHOOK_THREAT_MODEL.md) |
| **Webhooks en `dead_letter`** | SEV-2 | `> 0` eventos acumulados en `status = 'dead_letter'` | 15 minutos | Inspeccionar payloads fallidos en `public.webhook_events`. Corregir causa raíz y disparar re-procesamiento manual. | [SPRINT_04_WEBHOOK_THREAT_MODEL.md](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/docs/security/SPRINT_04_WEBHOOK_THREAT_MODEL.md) |
| **`operation_runs` Zombis** | SEV-2 | Registros con `status = 'running'` y `heartbeat_at < now() - 10 min` | 10 minutos | Ejecutar cleanup de leases y marcar runs como `failed` con motivo `worker_heartbeat_timeout`. | [leasesAndRateLimits.test.ts](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/tests/integration/leasesAndRateLimits.test.ts) |
| **Rate Limits Bloqueando Tráfico** | SEV-2 | `> 5%` de requests legítimos rechazados con 429 por bucket local | 5 minutos | Ajustar parámetros de ventana o tokens en `rate_limit_buckets` o mantener temporalmente en modo sombra. | [SPRINT_06_BASELINE.md](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/docs/performance/SPRINT_06_BASELINE.md) |
| **Diferencias en Facturación Shadow/Legacy** | SEV-2 | Divergencia detectada entre contador legacy y cuota atómica RPC | 1 hora | Auditar `public.tenant_usage` vs `public.subscriptions`. Mantener `billing_webhook_v2=false` hasta conciliar. | [audit-billing.ts](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/scripts/audit-billing.ts) |
| **Health Readiness en 503** | SEV-1 | `/api/health/ready` responde HTTP 503 de forma continua | 1 minuto | Verificar conectividad a Supabase/PostgreSQL. Si la DB no responde, escalar a Database Lead para PITR/Failover. | [backup_restore.md](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/docs/runbooks/backup_restore.md) |

---

## 3. Procedimiento de Cierre y Post-Mortem
1. Tras resolver cualquier incidente SEV-1 o SEV-2:
   - Registrar fecha, hora, duración, impacto a usuarios reales y causa raíz (*Root Cause Analysis*).
   - Definir acciones correctivas preventivas (*Action Items*) con fecha y responsable asignado.
   - Documentar aprendizajes en el repositorio.
