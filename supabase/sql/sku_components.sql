-- supabase/sql/sku_components.sql
-- Migración para soporte de SKU compuesto y componentes de SKU (Sprint 27)

CREATE TABLE IF NOT EXISTS product_sku_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    component_sku TEXT NOT NULL,
    component_normalized TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de búsqueda y filtro
CREATE INDEX IF NOT EXISTS idx_product_sku_components_tenant ON product_sku_components(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_sku_components_product ON product_sku_components(product_id);
CREATE INDEX IF NOT EXISTS idx_product_sku_components_normalized ON product_sku_components(component_normalized);

-- Unique Constraint
ALTER TABLE product_sku_components ADD CONSTRAINT unique_tenant_product_component UNIQUE (tenant_id, product_id, component_normalized);

-- RLS (Row Level Security)
ALTER TABLE product_sku_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver los componentes de SKU de su tenant"
    ON product_sku_components FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Solo los servicios de sistema pueden insertar/actualizar/borrar"
    ON product_sku_components FOR ALL
    USING (auth.uid() IS NULL); -- Supabase Service Role ignorará RLS.
