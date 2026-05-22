# Spec: Sprint 15 (Módulo Ventas Avanzadas y Configuración)

**Estado:** En Revisión
**Autor:** Antigravity IA
**Fecha:** 22 Mayo 2026

---

## 1. Contexto y Objetivos
- **Problema:** Stockly tiene múltiples entidades (productos, órdenes, Mercado Libre, preferencias) y actualmente la tabla de Ventas es muy básica. Tampoco existe un lugar unificado donde el "Owner" del tenant pueda controlar la configuración integral del negocio.
- **Objetivo:** 
  1. Transformar la página actual de ventas en un dashboard comercial completo con gráficos y filtros avanzados.
  2. Implementar una página de Configuración robusta dividida por categorías (Cuenta, Negocio, ML, WhatsApp, IA, Notificaciones, Seguridad).

## 2. Requerimientos
- **Funcionales:**
  - Tablero de KPIs en Ventas (Hoy, Semana, Mes, Ticket Promedio).
  - Exportación de listado de ventas a CSV.
  - CRUD de configuraciones del usuario y del tenant en `/dashboard/settings`.
  - Opciones específicas para la Inteligencia Artificial (Margen Mínimo de rentabilidad para acciones, Estrategia Conservadora/Agresiva).
- **Fuera de Alcance:** Integrar Stripe (usaremos Mercado Pago como facturación, ya definido antes), y la activación real de 2FA/MFA (quedará como placeholder visual).

## 3. Diseño Técnico

### 3.1. Base de Datos
No se crearán tablas nuevas completas, pero modificaremos las existentes o crearemos una de preferencias:
- **`tenant_preferences` (Nueva Tabla):** 
  - `tenant_id` (PK, FK)
  - `ai_min_margin_percent` (numeric)
  - `ai_pricing_strategy` (enum: 'conservative', 'balanced', 'aggressive')
  - `auto_suggestions_enabled` (boolean)
  - `notifications` (jsonb: `{ email: true, whatsapp: true, low_stock: true }`)
- Alternativa: Almacenar estas preferencias dentro de la columna `metadata` ya existente en la tabla `tenants`. (Para iterar más rápido en este sprint, elegiremos guardar en `tenants.metadata`).

### 3.2. Endpoints / Server Actions
- **`GET /api/sales/export`**: Route handler que reciba los filtros de búsqueda por query string, valide el tenant_id, genere un CSV en memoria y lo devuelva con cabeceras `Content-Type: text/csv` y `Content-Disposition`.
- **Server Actions en `src/actions/settings.ts`**:
  - `updateAccount(data)` -> Actualiza `profiles`.
  - `updateBusiness(data)` -> Actualiza `tenants`.
  - `updatePreferences(data)` -> Actualiza `tenants.metadata`.

### 3.3. Componentes Frontend
- **`/dashboard/orders` (o `sales`)**:
  - Refactorizar a un layout de Dashboard complejo.
  - Componentes de gráficos (Recharts) reutilizables.
- **`/dashboard/settings`**:
  - Usar los componentes `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` de shadcn/ui.
  - Cada Tab alojará un `<form>` con su propio Submit button invocando una Server Action.

## 4. Diseño de UX/UI
- La sección de configuraciones mostrará indicadores visuales (ej. un punto verde si Mercado Libre está conectado).
- Al guardar cualquier pestaña, se emitirá un `toast.success` y los datos se refrescarán usando `revalidatePath`.

## 5. Consideraciones de Seguridad
- Las configuraciones del negocio y de IA SOLO pueden ser mutadas por un usuario cuyo rol en `profiles` (o `tenant_users` virtual) sea `owner` o `admin`. Se implementarán verificaciones dentro de las Server Actions.
