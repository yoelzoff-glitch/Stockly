# Spec: Sprint 16 (Activación Inteligente y Business Health Center)

**Estado:** En Revisión
**Autor:** Antigravity IA
**Fecha:** 22 Mayo 2026

---

## 1. Contexto y Objetivos
- **Problema:** Los nuevos usuarios pueden perderse y no saber qué acciones tomar para configurar todo el sistema (conectar ML, WhatsApp, usar IA). Por otro lado, los usuarios activos necesitan un resumen de la "salud" de su negocio para tomar decisiones rápidas sin tener que explorar múltiples vistas.
- **Objetivo:** 
  1. Construir un checklist interactivo de onboarding (`/dashboard/get-started`).
  2. Construir un Centro de Salud del Negocio (`/dashboard/health`) con métricas consolidadas.
  3. Actualizar el Home del dashboard para ser inteligente y mostrar un banner o alertas rápidas de ambos módulos.

## 2. Requerimientos
- **Módulo de Activación:**
  - Checklist con pasos clave (ML, Productos, Órdenes, Costos, WhatsApp, IA, Workflows, Preferencias).
  - Medición de progreso 0-100%.
  - Mostrar un banner en el home si el progreso no está completo.
- **Módulo de Health Center:**
  - Score (0-100) basado en reglas de negocio.
  - Clasificación: Excelente (90-100), Bueno (70-89), Atención (50-69), Crítico (0-49).
  - Desglose de problemas detectados visualmente por severidad (🔴 Crítico, 🟡 Advertencia).
  - Acciones rápidas recomendadas (Reponer, Recalcular rentabilidad, etc.).
- **Home Dashboard:**
  - Integrar estas métricas y mostrar "Stockly detectó X problemas".

## 3. Diseño Técnico

### 3.1. Base de Datos
- **`tenant_progress` (Nueva Tabla):**
  - `id` (uuid, PK)
  - `tenant_id` (uuid, FK a tenants)
  - `step` (string, ej: 'connect_meli', 'sync_products')
  - `completed` (boolean)
  - `completed_at` (timestamp)
  *Nota:* Se creará un archivo SQL de migración `2026_05_22_sprint16_progress.sql`.

### 3.2. Lógica del Health Score
- Se creará un servicio `src/services/health/calculateHealth.ts` que se ejecutará bajo demanda o se cacheará.
- **Penalizaciones sugeridas:**
  - `productos_sin_costo`: -5 puntos por cada 10% del catálogo sin costo (máx -20).
  - `stock_critico`: -5 puntos si > 10% del catálogo está bajo stock.
  - `ventas_caida`: -10 puntos si las ventas caen > 10% vs semana anterior.
  - `competencia`: -10 puntos si > 20% del catálogo tiene precio mayor a la competencia.
- Se devolverá un objeto con el Score Total, la Clasificación y el array de "Problemas detectados".

### 3.3. Componentes y UI
- **`/dashboard/get-started`**: Componente visual con Progress Bar (shadcn) y lista de tareas.
- **`/dashboard/health`**: Visualización de "Gauge" (medidor circular) para el score, lista de Issues y botones de Quick Actions.
- **`Sidebar`**: Agregar los nuevos enlaces.

## 4. Seguridad
- Toda la data cargada usará `tenant_id` atado a la sesión.
- Validaciones en las llamadas para que un usuario Viewer no pueda ejecutar "Acciones Rápidas".
