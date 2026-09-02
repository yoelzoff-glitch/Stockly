# SPRINT 3/8 — REPORTE DE ÍNDICES DE BASE DE DATOS Y RLS

## 1. Justificación y Análisis de Rendimiento
Para garantizar que las políticas RLS evaluadas en cada fila no generen cuellos de botella (table scans completos), es fundamental contar con índices B-Tree en las columnas `tenant_id` y en las foreign keys utilizadas en subconsultas `EXISTS`.

---

## 2. Inventario de Índices Recomendados

| Tabla | Columnas Indexadas | Propósito de la Consulta / Política | Riesgo de Lock en Producción | Estrategia de Creación |
| :--- | :--- | :--- | :--- | :--- |
| `products` | `(tenant_id, id)` | Búsquedas de producto y filtro RLS base | Bajo | `CREATE INDEX CONCURRENTLY IF NOT EXISTS` |
| `products` | `(tenant_id, meli_item_id)` | Sync de publicaciones y resolución rápida | Bajo | `CREATE INDEX CONCURRENTLY IF NOT EXISTS` |
| `products` | `(tenant_id, sku)` | Mapeo de inventario y costos por SKU | Bajo | `CREATE INDEX CONCURRENTLY IF NOT EXISTS` |
| `orders` | `(tenant_id, date_created DESC)` | Dashboard, exportación CSV y listados | Medio (tabla grande) | `CREATE INDEX CONCURRENTLY IF NOT EXISTS` |
| `orders` | `(tenant_id, meli_order_id)` | Sync e idempotencia de órdenes MeLi | Bajo | `CREATE INDEX CONCURRENTLY IF NOT EXISTS` |
| `order_items` | `(tenant_id, order_id)` | Relación y cálculo de rentabilidad por orden | Medio | `CREATE INDEX CONCURRENTLY IF NOT EXISTS` |
| `shipments` | `(order_id)` | Evaluación de subconsulta `EXISTS` en política RLS | Medio | `CREATE INDEX CONCURRENTLY IF NOT EXISTS` |
| `order_cancellations` | `(tenant_id, order_id)` | Reversión de stock y trazabilidad | Bajo | `CREATE INDEX CONCURRENTLY IF NOT EXISTS` |
| `product_price_history` | `(product_id, created_at DESC)` | Subconsulta `EXISTS` en RLS e historial | Bajo | `CREATE INDEX CONCURRENTLY IF NOT EXISTS` |
| `stock_movements` | `(product_id, created_at DESC)` | Subconsulta `EXISTS` en RLS y auditoría | Bajo | `CREATE INDEX CONCURRENTLY IF NOT EXISTS` |
| `purchase_order_items` | `(purchase_order_id)` | Subconsulta `EXISTS` en política RLS | Bajo | `CREATE INDEX CONCURRENTLY IF NOT EXISTS` |
| `promotion_items` | `(promotion_id)` | Subconsulta `EXISTS` en política RLS | Bajo | `CREATE INDEX CONCURRENTLY IF NOT EXISTS` |
| `coupons` | `(meli_account_id)` | Subconsulta `EXISTS` en política RLS | Bajo | `CREATE INDEX CONCURRENTLY IF NOT EXISTS` |
| `monthly_expenses` | `(tenant_id, date DESC)` | Reportes contables y finanzas | Bajo | `CREATE INDEX CONCURRENTLY IF NOT EXISTS` |
| `tenant_feature_flags` | `(tenant_id, flag_key)` | Cache lookups y control de flags | Mínimo | `CREATE UNIQUE INDEX IF NOT EXISTS` |
| `operation_runs` | `(tenant_id, created_at DESC)` | Panel de observabilidad de jobs | Mínimo | `CREATE INDEX CONCURRENTLY IF NOT EXISTS` |

---

## 3. Guía de Ejecución Concurrente
Para tablas con tráfico activo en producción (`orders`, `products`, `order_items`, `shipments`), los índices deben crearse fuera de bloques transaccionales (`DO $$ ... $$`) utilizando la cláusula `CONCURRENTLY` para evitar bloqueos exclusivos en lecturas y escrituras durante la creación.
