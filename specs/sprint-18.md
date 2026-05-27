# Spec: Sprint 18 (Product Readiness, UX & Intelligence Center Real)

**Estado:** En Revisión
**Autor:** Antigravity IA
**Fecha:** 22 Mayo 2026

---

## 1. Contexto y Objetivos
- **Problema:** La aplicación tiene funciones principales operativas (Auth, Meli, IA, Billing), pero carece de refinamientos UX de nivel empresarial (paginación, filtros globales, tablas avanzadas) y algunas páginas (`/integrations`, `/intelligence`) tienen datos estáticos o básicos.
- **Objetivo:** Transformar Klyvo en un producto 100% "Client-Ready".
  
## 2. Alcance por Módulos

### 2.1. Módulo 1: Integraciones (Configuración Real)
- **WhatsApp:** Mostrar estado real (conectado/desconectado), número, webhook y opciones de acción.
- **OpenAI:** Permitir visualizar consumo, seleccionar modelo IA (GPT-4o, GPT-4o-mini, etc.) y guardarlo en `tenant_ai_settings` (o en la columna JSONB `metadata` de `tenants` existente).

### 2.2. Módulo 2: Filtros Globales
- **Componente:** `src/components/filters/global-date-filter.tsx`
- **Lógica:** Componente de UI que actualiza `searchParams` (`?range=7d`, `?range=30d`, etc.). Se consumirá a nivel de Server Components en las distintas páginas para filtrar consultas SQL.

### 2.3. Módulo 3 y 4: Paginación y Data Table Reutilizable
- **Componentes:** `src/components/ui/pagination.tsx` y `src/components/ui/data-table.tsx`
- **Características:** Server-side pagination, ordenamiento de columnas, y acciones de exportación (CSV implementado en servidor o cliente).

### 2.4. Módulo 5: Intelligence Center Real
- Refactor completo de `/dashboard/intelligence/page.tsx` para usar algoritmos reales basados en SQL:
  - **Stock Out:** Cálculo de `(stock / ventas_promedio_diarias)` para determinar `días restantes`.
  - **Dead Products:** Productos sin ventas recientes y cálculo de `valor inmovilizado` (stock * costo).
  - **Operador Insights:** Análisis sobre márgenes bajos o precios altos.
  - **Recomendaciones y Workflows sugeridos:** Componentes de acción directa.

### 2.5. Módulo 6: Performance y Seguridad
- Uso de `React Suspense` y Skeletons para carga progresiva.
- Políticas RLS y validación de `tenant_id` a nivel Servidor.

## 3. Consideraciones Técnicas
- Sin librerías de tablas complejas adicionales (se creará una tabla robusta custom sobre Tailwind/shadcn).
- Filtros usando `next/navigation` (`useRouter`, `useSearchParams`).
