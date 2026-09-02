-- =====================================================================
-- KLYVO PRODUCTION PREFLIGHT DIAGNOSTIC SCRIPT (READ-ONLY)
-- Sprint 1/8 Safety Baseline
-- 
-- INSTRUCTIONS:
-- 1. Run this script in the Supabase SQL Editor of your target project.
-- 2. It contains ONLY read-only SELECT queries.
-- 3. It DOES NOT select any secrets, access tokens, passwords, or personal PII.
-- 4. Review the outputs against the documented expectations below.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLAS EXISTENTES EN EL SCHEMA PUBLIC
-- Interpretación: Verifica las tablas creadas en producción vs el repositorio.
-- ---------------------------------------------------------------------
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;


-- ---------------------------------------------------------------------
-- 2. ESTADO DE ROW LEVEL SECURITY (RLS) POR TABLA
-- Interpretación: TODAS las tablas de negocio deben tener rowsecurity = true.
-- Si alguna tabla devuelve 'RLS_DISABLED', debe ser atendida con prioridad.
-- ---------------------------------------------------------------------
SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled,
    CASE 
        WHEN rowsecurity THEN 'OK (Protected)' 
        ELSE 'WARNING: RLS_DISABLED' 
    END AS status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY rowsecurity ASC, tablename ASC;


-- ---------------------------------------------------------------------
-- 3. POLÍTICAS RLS ACTIVAS
-- Interpretación: Lista qué comandos (SELECT, INSERT, UPDATE, DELETE, ALL)
-- están permitidos y para qué roles por tabla.
-- ---------------------------------------------------------------------
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- ---------------------------------------------------------------------
-- 4. GRANTS POR ROL (anon, authenticated, service_role)
-- Interpretación: Tablas críticas como tenant_feature_flags y operation_runs
-- no deben tener grants para anon ni authenticated.
-- ---------------------------------------------------------------------
SELECT 
    table_schema,
    table_name,
    grantee,
    string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY table_schema, table_name, grantee
ORDER BY table_name, grantee;


-- ---------------------------------------------------------------------
-- 5. FUNCIONES SECURITY DEFINER Y SEARCH_PATH
-- Interpretación: Funciones SECURITY DEFINER deben tener search_path seguro
-- para prevenir secuestro de búsqueda de schema (search path injection).
-- ---------------------------------------------------------------------
SELECT 
    n.nspname AS schema_name,
    p.proname AS function_name,
    p.prosecdef AS is_security_definer,
    p.proconfig AS configuration_settings
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.prosecdef = true
ORDER BY p.proname;


-- ---------------------------------------------------------------------
-- 6. TABLAS MULTI-TENANT (Con columna tenant_id)
-- Interpretación: Verifica qué tablas tienen aislamiento de tenant explícito.
-- ---------------------------------------------------------------------
SELECT 
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable
FROM information_schema.columns c
JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
WHERE c.table_schema = 'public' 
  AND c.column_name = 'tenant_id'
  AND t.table_type = 'BASE TABLE'
ORDER BY c.table_name;


-- ---------------------------------------------------------------------
-- 7. TABLAS CON COLUMNAS DE CREDENCIALES O TOKENS
-- Interpretación: Identifica tablas sensibles para auditoría de cifrado y RLS.
-- (No selecciona el contenido de los tokens, sólo la estructura).
-- ---------------------------------------------------------------------
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND column_name ~* '(token|secret|password|key|auth)'
ORDER BY table_name, column_name;


-- ---------------------------------------------------------------------
-- 8. CONSTRAINTS Y FOREIGN KEYS
-- Interpretación: Comprueba la integridad referencial y las claves foráneas.
-- ---------------------------------------------------------------------
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;


-- ---------------------------------------------------------------------
-- 9. ÍNDICES EXISTENTES EN TABLAS PÚBLICAS
-- Interpretación: Verifica la cobertura de índices en tenant_id y claves de búsqueda.
-- ---------------------------------------------------------------------
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;


-- =====================================================================
-- CHECKS DE INTEGRIDAD DE DATOS Y ANOMALÍAS
-- =====================================================================

-- ---------------------------------------------------------------------
-- 10. DUPLICADOS POTENCIALES DE ÓRDENES
-- Esperado: 0 filas. Si existen duplicados, reportar cantidad.
-- ---------------------------------------------------------------------
SELECT 
    tenant_id,
    meli_order_id,
    COUNT(*) AS duplicate_count
FROM public.orders 
GROUP BY tenant_id, meli_order_id 
HAVING COUNT(*) > 1;


-- ---------------------------------------------------------------------
-- 11. DUPLICADOS DE ÍTEMS DE ORDEN
-- Esperado: 0 filas.
-- ---------------------------------------------------------------------
SELECT 
    order_id,
    meli_item_id,
    COALESCE(sku, '') AS sku_coalesced,
    COUNT(*) AS duplicate_count
FROM public.order_items 
GROUP BY order_id, meli_item_id, COALESCE(sku, '')
HAVING COUNT(*) > 1;


-- ---------------------------------------------------------------------
-- 12. MOVIMIENTOS DE INVENTARIO DUPLICADOS
-- Esperado: 0 filas para movimientos de tipo venta con el mismo reference_id.
-- ---------------------------------------------------------------------
SELECT 
    tenant_id,
    reference_id,
    movement_type,
    COUNT(*) AS movement_count
FROM public.inventory_movements 
WHERE reference_id IS NOT NULL 
  AND movement_type IN ('sale_confirmed', 'sale_reserved', 'return')
GROUP BY tenant_id, reference_id, movement_type 
HAVING COUNT(*) > 1;


-- ---------------------------------------------------------------------
-- 13. ÓRDENES PROCESADAS SIN MOVIMIENTO DE STOCK ASOCIADO
-- Interpretación: Órdenes marcadas como processed donde no se encuentra movimiento.
-- ---------------------------------------------------------------------
SELECT 
    o.id AS order_id,
    o.tenant_id,
    o.meli_order_id,
    o.date_created,
    o.internal_stock_processed
FROM public.orders o
LEFT JOIN public.inventory_movements im 
  ON im.reference_id = o.id AND im.movement_type = 'sale_confirmed'
WHERE o.internal_stock_processed = true 
  AND im.id IS NULL
ORDER BY o.date_created DESC
LIMIT 50;


-- ---------------------------------------------------------------------
-- 14. ÍTEMS CON STOCK NEGATIVO
-- Interpretación: Ítems cuyo inventario interno cayó por debajo de cero.
-- ---------------------------------------------------------------------
SELECT 
    id,
    tenant_id,
    sku,
    sku_normalized,
    current_stock,
    updated_at
FROM public.inventory_items 
WHERE current_stock < 0
ORDER BY current_stock ASC;


-- ---------------------------------------------------------------------
-- 15. ACCIONES DE IA O WORKFLOWS PENDIENTES ANTIGUOS (> 7 DÍAS)
-- Interpretación: Acciones que quedaron en estado pending y nunca fueron resueltas.
-- ---------------------------------------------------------------------
SELECT 
    id,
    tenant_id,
    action_type,
    status,
    created_at
FROM public.ai_actions 
WHERE status = 'pending' 
  AND created_at < NOW() - INTERVAL '7 days'
ORDER BY created_at ASC;
